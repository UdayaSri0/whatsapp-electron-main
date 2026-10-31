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

function verifyPackages() {
    const version = pkg.version.replace(/-/g, '~');
    const packages = Object.values(variants).map(variant => {
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
    assertRemovalIsolation(packages[0].postrm, packages[1].postrm);
    console.log('DEB package names, desktop launchers and removal scripts are isolated; user profiles are preserved.');
}

if (require.main === module) verifyPackages();
module.exports = { assertRemovalIsolation, verifyPackages };
