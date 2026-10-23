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
        if (name === 'build' || name.startsWith('build:')) assert.ok(command.includes('--publish never'), name);
    }
    assert.equal(pkg.build.linux.desktop.entry.StartupWMClass, 'WhatsApp');
    assert.match(pkg.build.linux.desktop.entry.Name, /unofficial/i);
});

test('release assets archive committed source, verify checksums and reject modified sources', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsapp-release-test-'));
    const git = args => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
    try {
        fs.mkdirSync(path.join(directory, 'scripts'));
        fs.copyFileSync('scripts/release-assets.js', path.join(directory, 'scripts/release-assets.js'));
        fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ version: '1.1.1' }));
        fs.writeFileSync(path.join(directory, 'LICENSE'), 'fixture GPL source license');
        fs.writeFileSync(path.join(directory, '.gitignore'), 'dist/\n');
        git(['init', '-q']);
        git(['add', '.']);
        git(['-c', 'user.name=Release Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Fixture source']);
        fs.mkdirSync(path.join(directory, 'dist'));
        fs.writeFileSync(path.join(directory, 'dist', 'fixture.deb'), 'fixture binary');
        const script = path.join(directory, 'scripts/release-assets.js');
        execFileSync(process.execPath, [script], { cwd: directory, stdio: 'pipe' });
        const dist = path.join(directory, 'dist');
        const archive = zlib.gunzipSync(fs.readFileSync(path.join(dist, 'whatsapp-electron-1.1.1-source.tar.gz')));
        assert.ok(archive.includes(Buffer.from('fixture GPL source license')));
        assert.equal(fs.readFileSync(path.join(dist, 'BUILD-COMMIT.txt'), 'utf8').trim(), git(['rev-parse', 'HEAD']).toString().trim());
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
