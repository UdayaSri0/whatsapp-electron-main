'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { execFileSync, spawnSync } = require('node:child_process');
const pkg = require('../package.json');
const lock = require('../package-lock.json');
const { variants } = require('../config/variants');
const { assertRemovalIsolation } = require('../scripts/verify-packages');

test('packaging preserves profile identity and upstream authorship', () => {
    assert.equal(pkg.name, 'whatsapp-electron');
    assert.equal(pkg.productName, 'WhatsApp');
    assert.equal(pkg.build.appId, 'com.dluebben.whatsapp-desktop');
    assert.equal(pkg.build.linux.executableName, 'whatsapp');
    assert.equal(pkg.author.name, 'UdayaSri0');
    assert.ok(pkg.contributors.some(person => person.name === 'Dominik Lübben'));
    assert.equal(pkg.build.linux.vendor, 'UdayaSri0');
    assert.equal(pkg.author.email, undefined);
    assert.equal(pkg.repository.url, 'git+https://github.com/UdayaSri0/whatsapp-electron-main.git');
});

test('all wrapper modules and GPL license are included in binary packages', () => {
    assert.ok(pkg.build.files.includes('src/**/*'));
    assert.ok(pkg.build.files.includes('config/variants.js'));
    assert.ok(pkg.build.files.includes('build/business/icon.png'));
    assert.ok(pkg.build.files.includes('LICENSE'));
    assert.ok(pkg.build.files.includes('NOTICE'));
    assert.match(fs.readFileSync('NOTICE', 'utf8'), /Dominik Lübben/);
    assert.equal(pkg.license, 'GPL-2.0-or-later');
    assert.ok(fs.readFileSync('LICENSE', 'utf8').includes('GNU GENERAL PUBLIC LICENSE'));
});

test('manifest and lock agree on supported build runtime and dependencies', () => {
    assert.deepEqual(pkg.engines, lock.packages[''].engines);
    assert.deepEqual(pkg.devDependencies, lock.packages[''].devDependencies);
    assert.equal(pkg.version, lock.version);
    assert.equal(pkg.version, lock.packages[''].version);
});

test('build targets never publish artifacts automatically', () => {
    for (const [name, command] of Object.entries(pkg.scripts)) {
        if (name === 'build' || name.startsWith('build:')) {
            if (command.includes('scripts/build-variant.js')) continue;
            if (name === 'build:all') continue;
            assert.ok(command.includes('--publish never'), name);
        }
    }
    assert.match(fs.readFileSync('scripts/build-variant.js', 'utf8'), /publish: 'never'/);
    assert.equal(pkg.build.linux.desktop.entry.StartupWMClass, 'WhatsApp');
    assert.match(pkg.build.linux.desktop.entry.Name, /unofficial/i);
});

test('variant package builds refuse modified build inputs before loading builder tools', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsapp-build-input-test-'));
    const git = args => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
    try {
        fs.mkdirSync(path.join(directory, 'scripts'));
        fs.mkdirSync(path.join(directory, 'config'));
        fs.mkdirSync(path.join(directory, 'src'));
        fs.copyFileSync('scripts/build-variant.js', path.join(directory, 'scripts/build-variant.js'));
        fs.copyFileSync('config/variants.js', path.join(directory, 'config/variants.js'));
        fs.copyFileSync('package.json', path.join(directory, 'package.json'));
        fs.writeFileSync(path.join(directory, 'src/main.js'), '/* source fixture */\n');
        git(['init', '-q']);
        git(['add', '.']);
        git(['-c', 'user.name=Build Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Fixture source']);
        fs.appendFileSync(path.join(directory, 'src/main.js'), '// uncommitted build change\n');
        const result = spawnSync(process.execPath, [path.join(directory, 'scripts/build-variant.js'), 'business'], { cwd: directory, encoding: 'utf8' });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Commit build inputs before creating package artifacts/);
        assert.doesNotMatch(result.stderr, /Cannot find module 'electron-builder'/);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('DEB removal scripts only remove their own binaries and preserve user profiles', () => {
    const personal = "update-alternatives --remove 'whatsapp' '/opt/WhatsApp/whatsapp'\nAPPARMOR_PROFILE_DEST='/etc/apparmor.d/whatsapp'";
    const business = "update-alternatives --remove 'whatsapp-business-unofficial' '/opt/Business Chat for WhatsApp (Unofficial)/whatsapp-business-unofficial'\nAPPARMOR_PROFILE_DEST='/etc/apparmor.d/whatsapp-business-unofficial'";
    assert.doesNotThrow(() => assertRemovalIsolation(personal, business));
    assert.throws(() => assertRemovalIsolation(personal, `${business}\nrm -rf /opt/WhatsApp/whatsapp`), /only their own/);
    assert.throws(() => assertRemovalIsolation(personal, `${business}\nrm -rf /home/user/.config/WhatsApp`), /user profile data/);
});

test('release assets archive committed source, verify checksums and reject modified sources', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsapp-release-test-'));
    const git = args => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
    try {
        fs.mkdirSync(path.join(directory, 'scripts'));
        fs.copyFileSync('scripts/release-assets.js', path.join(directory, 'scripts/release-assets.js'));
        fs.mkdirSync(path.join(directory, 'config'));
        fs.copyFileSync('config/variants.js', path.join(directory, 'config/variants.js'));
        fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({
            version: '1.1.1', build: { appId: 'com.example.personal', linux: { executableName: 'whatsapp', desktop: { entry: {} } }, appImage: {}, deb: {}, rpm: {} },
        }));
        fs.writeFileSync(path.join(directory, 'LICENSE'), 'fixture GPL source license');
        fs.writeFileSync(path.join(directory, '.gitignore'), 'dist/\n');
        git(['init', '-q']);
        git(['add', '.']);
        git(['-c', 'user.name=Release Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Fixture source']);
        fs.mkdirSync(path.join(directory, 'dist'));
        const commit = git(['rev-parse', 'HEAD']).toString().trim();
        for (const variant of Object.values(variants)) for (const target of ['AppImage', 'deb']) {
            const artifact = variant.artifactNames[target === 'AppImage' ? 'appImage' : target].replace('${version}', '1.1.1');
            const bytes = Buffer.from(`${variant.name} ${target}`);
            fs.writeFileSync(path.join(directory, 'dist', artifact), bytes);
            fs.writeFileSync(path.join(directory, `dist/BUILD-METADATA.${variant.name}.${target}.json`), JSON.stringify({
                variant: variant.name, target, version: '1.1.1', commit, artifact,
                sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
            }));
        }
        const script = path.join(directory, 'scripts/release-assets.js');
        const missing = path.join(directory, 'dist', variants.business.artifactNames.deb.replace('${version}', '1.1.1'));
        fs.renameSync(missing, `${missing}.missing`);
        const absent = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
        assert.notEqual(absent.status, 0);
        assert.match(absent.stderr, /Missing business deb/);
        fs.renameSync(`${missing}.missing`, missing);
        execFileSync(process.execPath, [script], { cwd: directory, stdio: 'pipe' });
        const dist = path.join(directory, 'dist');
        const archive = zlib.gunzipSync(fs.readFileSync(path.join(dist, 'whatsapp-electron-1.1.1-source.tar.gz')));
        assert.ok(archive.includes(Buffer.from('fixture GPL source license')));
        assert.equal(fs.readFileSync(path.join(dist, 'BUILD-COMMIT.txt'), 'utf8').trim(), commit);
        for (const line of fs.readFileSync(path.join(dist, 'SHA256SUMS'), 'utf8').trim().split('\n')) {
            const [hash, filename] = line.split('  ');
            assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dist, filename))).digest('hex'), hash);
        }
        fs.appendFileSync(path.join(directory, 'LICENSE'), '\nmodified');
        const result = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Commit all release sources/);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
