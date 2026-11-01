'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const pkg = require('../package.json');
const { variants } = require('../config/variants');

function packageFor(variant) {
    return path.resolve(pkg.build.directories.output, variant.artifactNames.deb.replace('${version}', pkg.version));
}

const mode = process.env.PACKAGE_VARIANT_MODE || 'dual';
const selectedVariants = mode === 'personal' ? [variants.personal] : Object.values(variants);
const missing = selectedVariants.find(variant => !fs.existsSync(packageFor(variant)));
const hasDpkgDeb = spawnSync('dpkg-deb', ['--version'], { stdio: 'ignore' }).status === 0;

test(`${mode} DEB install, upgrade and removal simulation stays inside a temporary root`, { skip: !['personal', 'dual'].includes(mode) ? 'PACKAGE_VARIANT_MODE must be personal or dual' : missing ? `missing built package: ${missing.name}` : !hasDpkgDeb ? 'dpkg-deb unavailable' : false }, t => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsapp-package-lifecycle-'));
    t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
    const sandbox = path.join(temporary, 'root');
    const personalStage = path.join(temporary, 'personal');
    const businessStage = path.join(temporary, 'business');
    fs.mkdirSync(sandbox);
    fs.mkdirSync(personalStage);
    fs.mkdirSync(businessStage);
    const stages = new Map([[variants.personal.name, personalStage], [variants.business.name, businessStage]]);
    for (const variant of selectedVariants) {
        const stage = stages.get(variant.name);
        execFileSync('dpkg-deb', ['--extract', packageFor(variant), stage]);
        fs.cpSync(stage, sandbox, { recursive: true, dereference: false, force: true });
    }

    const personalFiles = filesUnder(personalStage);
    const businessFiles = selectedVariants.includes(variants.business) ? filesUnder(businessStage) : [];
    assert.deepEqual(personalFiles.filter(filename => businessFiles.includes(filename)), [], 'package payload paths must not overlap');

    const profiles = [variants.personal.profileDirectory, variants.business.profileDirectory].map(name => {
        const file = path.join(sandbox, 'home/acceptance/.config', name, 'profile-sentinel');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, name);
        return file;
    });

    for (const variant of selectedVariants) {
        const upgraded = makeHigherVersionPackage(packageFor(variant), temporary, variant);
        execFileSync('dpkg-deb', ['--extract', upgraded, sandbox]);
        assert.equal(execFileSync('dpkg-deb', ['-f', upgraded, 'Package'], { encoding: 'utf8' }).trim(), variant.packageName);
        assert.equal(execFileSync('dpkg-deb', ['-f', upgraded, 'Version'], { encoding: 'utf8' }).trim(), `${pkg.version.replace(/-/g, '~')}+acceptance1`);
    }
    assert.ok(personalFiles.every(filename => fs.existsSync(path.join(sandbox, filename))));
    assert.ok(businessFiles.every(filename => fs.existsSync(path.join(sandbox, filename))));
    assert.ok(profiles.every(filename => fs.readFileSync(filename, 'utf8') === path.basename(path.dirname(filename))));

    for (const removedVariant of selectedVariants) {
        const otherFiles = removedVariant === variants.personal ? businessFiles : personalFiles;
        const removedFiles = removedVariant === variants.personal ? personalFiles : businessFiles;
        const removalRoot = path.join(temporary, `remove-${removedVariant.name}`);
        fs.mkdirSync(removalRoot);
        for (const variant of selectedVariants) fs.cpSync(stages.get(variant.name), removalRoot, { recursive: true, dereference: false, force: true });
        const profileFiles = [variants.personal, variants.business].map(variant => {
            const file = path.join(removalRoot, 'home/acceptance/.config', variant.profileDirectory, 'profile-sentinel');
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, variant.profileDirectory);
            return { file, value: variant.profileDirectory };
        });
        // Model package-manager file removal only within the temporary root; maintainer scripts are inspected separately.
        for (const filename of removedFiles) fs.rmSync(path.join(removalRoot, filename), { force: true, recursive: true });
        assert.ok(otherFiles.every(filename => fs.existsSync(path.join(removalRoot, filename))));
        assert.ok(removedFiles.every(filename => !fs.existsSync(path.join(removalRoot, filename))));
        assert.ok(profileFiles.every(profile => fs.readFileSync(profile.file, 'utf8') === profile.value));
    }
});

function filesUnder(root) {
    const result = [];
    const visit = directory => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(filename);
            else result.push(path.relative(root, filename));
        }
    };
    visit(root);
    return result.sort();
}

function makeHigherVersionPackage(packageFile, temporary, variant) {
    const root = path.join(temporary, `${variant.name}-upgrade`);
    const control = path.join(temporary, `${variant.name}-control`);
    const output = path.join(temporary, `${variant.name}-upgrade.deb`);
    fs.mkdirSync(root);
    fs.mkdirSync(control);
    execFileSync('dpkg-deb', ['--extract', packageFile, root]);
    execFileSync('dpkg-deb', ['--control', packageFile, control]);
    const debian = path.join(root, 'DEBIAN');
    fs.mkdirSync(debian);
    for (const entry of fs.readdirSync(control)) fs.cpSync(path.join(control, entry), path.join(debian, entry), { recursive: true, dereference: false });
    const controlFile = path.join(debian, 'control');
    const contents = fs.readFileSync(controlFile, 'utf8');
    const currentVersion = execFileSync('dpkg-deb', ['-f', packageFile, 'Version'], { encoding: 'utf8' }).trim();
    execFileSync('dpkg', ['--compare-versions', `${currentVersion}+acceptance1`, 'gt', currentVersion]);
    assert.match(contents, new RegExp(`^Version: ${escapeRegExp(currentVersion)}$`, 'm'));
    fs.writeFileSync(controlFile, contents.replace(new RegExp(`^Version: ${escapeRegExp(currentVersion)}$`, 'm'), `Version: ${currentVersion}+acceptance1`));
    execFileSync('dpkg-deb', ['--build', root, output], { stdio: 'pipe' });
    return output;
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
