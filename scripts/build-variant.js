'use strict';

const pkg = require('../package.json');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Arch, Platform, build } = require('electron-builder');
const { variants, buildConfig } = require('../config/variants');

const variant = variants[process.argv[2]];
if (!variant) throw new Error('Choose personal or business');
const targets = (process.argv[3] ? [process.argv[3]] : ['AppImage', 'deb']);
if (targets.some(target => !['AppImage', 'deb', 'rpm'].includes(target))) throw new Error('Unsupported Linux target');

const config = buildConfig(variant.name);

build({ targets: Platform.LINUX.createTarget(targets, Arch.x64), config, publish: 'never' })
    .then(() => {
        const output = path.resolve(pkg.build.directories.output);
        const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
        for (const target of targets) {
            const key = target === 'AppImage' ? 'appImage' : target;
            const filename = variant.artifactNames[key];
            const artifact = path.join(output, filename.replace('${version}', pkg.version));
            if (!fs.existsSync(artifact)) throw new Error(`Expected ${variant.name} ${target} artifact missing: ${artifact}`);
            const hash = crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex');
            const metadata = { variant: variant.name, target, version: pkg.version, commit, artifact: filename.replace('${version}', pkg.version), sha256: hash };
            fs.writeFileSync(path.join(output, `BUILD-METADATA.${variant.name}.${target}.json`), `${JSON.stringify(metadata, null, 2)}\n`);
        }
        console.log(`Built ${variant.name} ${targets.join(', ')} packages from ${commit}.`);
    })
    .catch(error => { console.error(error); process.exitCode = 1; });
