'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const pkg = require('../package.json');
const { variants } = require('../config/variants');

function assertRemovalIsolation(personal, business) {
    const personalExe = `/opt/WhatsApp/${variants.personal.executableName}`;
    const businessExe = `/opt/${variants.business.productName}/${variants.business.executableName}`;
    if (!personal.includes(personalExe) || personal.includes(businessExe)
        || !business.includes(businessExe) || business.includes(personalExe)) {
        throw new Error('DEB removal scripts do not target only their own application.');
    }
    if ([personal, business].some(script => /\/home\/|\.config\/|userData|user-data-dir/i.test(script))) {
        throw new Error('DEB removal scripts must not remove user profile data.');
    }
}

function controlScript(packageFile) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsapp-deb-control-'));
    try {
        execFileSync('dpkg-deb', ['--control', packageFile, directory], { stdio: 'pipe' });
        return fs.readFileSync(path.join(directory, 'postrm'), 'utf8');
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

function verifyPackages(mode = 'dual') {
    if (!['personal', 'dual'].includes(mode)) throw new Error('Package verification mode must be personal or dual.');
    const version = pkg.version.replace(/-/g, '~');
    const selected = mode === 'personal' ? [variants.personal] : Object.values(variants);
    const packages = selected.map(variant => {
        const filename = variant.artifactNames.deb.replace('${version}', pkg.version);
        const packageFile = path.resolve(pkg.build.directories.output, filename);
        const metadata = ['Package', 'Version', 'Architecture'].map(field =>
            execFileSync('dpkg-deb', ['-f', packageFile, field], { encoding: 'utf8' }).trim());
        const expected = [variant.packageName, version, 'amd64'];
        if (metadata.join('\n') !== expected.join('\n')) throw new Error(`Unexpected DEB metadata in ${filename}`);
        const contents = execFileSync('dpkg-deb', ['--contents', packageFile], { encoding: 'utf8' });
        if (!contents.includes(`./usr/share/applications/${variant.desktopFile}`)) throw new Error(`Missing isolated desktop launcher in ${filename}`);
        return { variant, packageFile, postrm: controlScript(packageFile) };
    });
    for (const { variant, postrm } of packages) {
        const other = Object.values(variants).find(candidate => candidate.name !== variant.name);
        const ownExecutable = `/opt/${variant.productName}/${variant.executableName}`;
        const otherExecutable = `/opt/${other.productName}/${other.executableName}`;
        if (!postrm.includes(ownExecutable) || postrm.includes(otherExecutable) || /\/home\/|\.config\/|userData|user-data-dir/i.test(postrm)) {
            throw new Error(`${variant.name} DEB removal script targets another application or user profile.`);
        }
    }
    if (mode === 'dual') assertRemovalIsolation(packages[0].postrm, packages[1].postrm);
    console.log(`${mode} DEB metadata, desktop launcher and removal isolation verified; user profiles are preserved.`);
}

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--mode')) throw new Error('Usage: verify-packages.js [--mode personal|dual]');
    verifyPackages(args[1] || 'dual');
}
module.exports = { assertRemovalIsolation, verifyPackages };
