'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const pkg = require('../package.json');
const { version } = pkg;
const { variants } = require('../config/variants');

// Never pair binaries from modified tracked sources with an unrelated HEAD archive.
const changed = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' }).trim();
if (changed) throw new Error('Commit all release sources before creating release assets.');
if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version)) throw new Error('Invalid release version.');
const directory = path.resolve('dist');
fs.mkdirSync(directory, { recursive: true });
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const requiredTargets = ['AppImage', 'deb'];
const artifacts = [];
for (const variant of Object.values(variants)) {
    for (const target of requiredTargets) {
        const filename = variant.artifactNames[target === 'AppImage' ? 'appImage' : target].replace('${version}', version);
        const metadataFile = `BUILD-METADATA.${variant.name}.${target}.json`;
        const metadataPath = path.join(directory, metadataFile);
        const artifactPath = path.join(directory, filename);
        if (!fs.existsSync(metadataPath) || !fs.existsSync(artifactPath)) throw new Error(`Missing ${variant.name} ${target} build or provenance; run npm run build:all.`);
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        const digest = crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex');
        if (metadata.variant !== variant.name || metadata.target !== target || metadata.version !== version || metadata.commit !== commit || metadata.artifact !== filename || metadata.sha256 !== digest) {
            throw new Error(`Stale or inconsistent ${variant.name} ${target} artifact: ${filename}`);
        }
        artifacts.push(filename);
    }
}
for (const target of ['rpm']) {
    const markerExists = Object.values(variants).some(variant => fs.existsSync(path.join(directory, `BUILD-METADATA.${variant.name}.rpm.json`)));
    if (!markerExists) continue;
    for (const variant of Object.values(variants)) {
        const filename = variant.artifactNames.rpm.replace('${version}', version);
        const metadataPath = path.join(directory, `BUILD-METADATA.${variant.name}.rpm.json`);
        const artifactPath = path.join(directory, filename);
        if (!fs.existsSync(metadataPath) || !fs.existsSync(artifactPath)) throw new Error('RPM releases require matching Personal and Business packages.');
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        const digest = crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex');
        if (metadata.variant !== variant.name || metadata.target !== target || metadata.version !== version || metadata.commit !== commit || metadata.artifact !== filename || metadata.sha256 !== digest) {
            throw new Error(`Stale or inconsistent ${variant.name} RPM artifact: ${filename}`);
        }
        artifacts.push(filename);
    }
}
const actualPackages = fs.readdirSync(directory).filter(name => /\.(AppImage|deb|rpm)$/.test(name)).sort();
if (actualPackages.sort().join('\n') !== artifacts.sort().join('\n')) throw new Error('Stale or unexpected variant package found in dist/. Start with an empty dist directory.');
const prefix = `whatsapp-electron-${version}`;
const tar = execFileSync('git', ['archive', '--format=tar', `--prefix=${prefix}/`, 'HEAD'], { maxBuffer: 64 * 1024 * 1024 });
fs.writeFileSync(path.join(directory, `${prefix}-source.tar.gz`), zlib.gzipSync(tar));
fs.writeFileSync(path.join(directory, 'BUILD-COMMIT.txt'), `${commit}\n`);
const files = fs.readdirSync(directory).filter(name => /\.(AppImage|deb|rpm|pkg\.tar\.zst|tar\.gz)$/.test(name) || name === 'BUILD-COMMIT.txt' || /^BUILD-METADATA\..+\.json$/.test(name)).sort();
const checksums = files.map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex')}  ${name}\n`).join('');
fs.writeFileSync(path.join(directory, 'SHA256SUMS'), checksums);
console.log(`Created corresponding source, commit provenance and checksums for ${files.length} files in dist/.`);
