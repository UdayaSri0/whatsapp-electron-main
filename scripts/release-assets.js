'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { version } = require('../package.json');

// Never pair binaries from modified tracked sources with an unrelated HEAD archive.
const changed = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' }).trim();
if (changed) throw new Error('Commit all release sources before creating release assets.');
if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version)) throw new Error('Invalid release version.');
const directory = path.resolve('dist');
fs.mkdirSync(directory, { recursive: true });
const prefix = `whatsapp-electron-${version}`;
const tar = execFileSync('git', ['archive', '--format=tar', `--prefix=${prefix}/`, 'HEAD'], { maxBuffer: 64 * 1024 * 1024 });
fs.writeFileSync(path.join(directory, `${prefix}-source.tar.gz`), zlib.gzipSync(tar));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
fs.writeFileSync(path.join(directory, 'BUILD-COMMIT.txt'), `${commit}\n`);
const files = fs.readdirSync(directory).filter(name => /\.(AppImage|deb|rpm|pkg\.tar\.zst|tar\.gz)$/.test(name) || name === 'BUILD-COMMIT.txt').sort();
const checksums = files.map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex')}  ${name}\n`).join('');
fs.writeFileSync(path.join(directory, 'SHA256SUMS'), checksums);
console.log(`Created corresponding source, commit provenance and checksums for ${files.length} files in dist/.`);
