'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getAutostartStatus, setAutostart } = require('../src/autostart');

function fixture(t) {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsapp-autostart-'));
    t.after(() => fs.rmSync(homeDir, { recursive: true, force: true }));
    return { homeDir, executablePath: '/opt/WhatsApp/whatsapp-electron' };
}

test('autostart reads without writes and explicit enable, update and disable are reversible', t => {
    const options = fixture(t);
    const initial = getAutostartStatus(options);
    assert.equal(initial.enabled, false);
    assert.deepEqual(fs.readdirSync(options.homeDir), []);
    assert.deepEqual(setAutostart({ ...options, enabled: false }), initial);
    setAutostart({ ...options, enabled: true });
    assert.equal(getAutostartStatus(options).enabled, true);
    assert.equal(fs.statSync(initial.filename).mode & 0o777, 0o600);
    const inode = fs.statSync(initial.filename).ino;
    setAutostart({ ...options, enabled: true });
    assert.equal(fs.statSync(initial.filename).ino, inode);
    setAutostart({ ...options, enabled: true, executablePath: '/new/app' });
    assert.match(fs.readFileSync(initial.filename, 'utf8'), /Exec="\/new\/app"/);
    setAutostart({ ...options, enabled: false });
    assert.equal(fs.existsSync(initial.filename), false);
});

test('autostart respects explicit XDG config directory and escapes AppImage paths', t => {
    const options = fixture(t);
    options.configDir = path.join(options.homeDir, 'custom-config');
    const result = setAutostart({ ...options, enabled: true, appImagePath: '/tmp/my % $ ` " \\ app.AppImage' });
    assert.equal(result.filename, path.join(options.configDir, 'autostart/whatsapp-electron.desktop'));
    const bytes = fs.readFileSync(result.filename, 'utf8');
    assert.match(bytes, /Exec=\/usr\/bin\/env -- /);
    assert.ok(bytes.includes('%%'));
    assert.equal(getAutostartStatus(options).enabled, true);
});

test('autostart preserves unrelated, empty, edited and symlink entries on enable and disable', t => {
    const options = fixture(t);
    const filename = getAutostartStatus(options).filename;
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    for (const bytes of ['', '[Desktop Entry]\nExec=/other/app\n']) {
        fs.writeFileSync(filename, bytes);
        for (const enabled of [true, false]) assert.throws(() => setAutostart({ ...options, enabled }), /preserved/);
        assert.equal(fs.readFileSync(filename, 'utf8'), bytes);
    }
    fs.unlinkSync(filename);
    setAutostart({ ...options, enabled: true });
    const modified = fs.readFileSync(filename, 'utf8').replace('/opt/', '/bad/');
    fs.writeFileSync(filename, modified);
    assert.throws(() => setAutostart({ ...options, enabled: false }), /preserved/);
    fs.unlinkSync(filename);
    const victim = path.join(options.homeDir, 'victim');
    fs.writeFileSync(victim, 'unchanged');
    fs.symlinkSync(victim, filename);
    assert.throws(() => setAutostart({ ...options, enabled: true }), /regular file/);
    assert.equal(fs.readFileSync(victim, 'utf8'), 'unchanged');
    fs.unlinkSync(filename);
    fs.mkdirSync(filename);
    assert.throws(() => setAutostart({ ...options, enabled: false }), /regular file/);
});

test('autostart rejects unsafe paths and concurrent writers without changing entry', t => {
    const options = fixture(t);
    for (const executablePath of ['relative', '/tmp/app\nExec=bad', '/tmp/a=b', '/tmp/app\u0000']) {
        assert.throws(() => setAutostart({ ...options, executablePath, enabled: true }), /Invalid/);
    }
    assert.throws(() => setAutostart({ ...options, enabled: 1 }), /boolean/);
    const { filename } = setAutostart({ ...options, enabled: true });
    const original = fs.readFileSync(filename);
    fs.writeFileSync(`${filename}.lock`, 'busy');
    assert.throws(() => setAutostart({ ...options, enabled: false }), { code: 'EEXIST' });
    assert.deepEqual(fs.readFileSync(filename), original);
    assert.equal(fs.readFileSync(`${filename}.lock`, 'utf8'), 'busy');
});

test('autostart never overwrites a file appearing during initial enable', t => {
    const options = fixture(t);
    const filename = getAutostartStatus(options).filename;
    const originalLink = fs.linkSync;
    fs.linkSync = function (source, target) {
        fs.writeFileSync(target, 'concurrent unrelated entry', { flag: 'wx' });
        return originalLink(source, target);
    };
    try {
        assert.throws(() => setAutostart({ ...options, enabled: true }), { code: 'EEXIST' });
    } finally { fs.linkSync = originalLink; }
    assert.equal(fs.readFileSync(filename, 'utf8'), 'concurrent unrelated entry');
    assert.deepEqual(fs.readdirSync(path.dirname(filename)), ['whatsapp-electron.desktop']);
});
