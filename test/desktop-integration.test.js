'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { installDesktopShortcut } = require('../src/desktop-integration');

function fixture(t) {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsapp-desktop-'));
    t.after(() => fs.rmSync(homeDir, { recursive: true, force: true }));
    const iconPath = path.join(homeDir, 'source.png');
    fs.writeFileSync(iconPath, 'test icon');
    return { homeDir, iconPath, appImagePath: '/home/user/WhatsApp 100%.AppImage' };
}

test('explicit shortcut creation is idempotent and escapes desktop field codes', t => {
    const options = fixture(t);
    const installed = installDesktopShortcut(options);
    assert.match(fs.readFileSync(installed.desktopFile, 'utf8'), /Exec=\/usr\/bin\/env -- "\/home\/user\/WhatsApp 100%%\.AppImage" %U/);
    assert.equal(fs.readFileSync(installed.iconFile, 'utf8'), 'test icon');
    const original = fs.statSync(installed.desktopFile).ino;
    assert.deepEqual(installDesktopShortcut(options), installed);
    assert.equal(fs.statSync(installed.desktopFile).ino, original);
});

test('empty and customized launchers and icons survive shortcut installation', t => {
    const options = fixture(t);
    const installed = installDesktopShortcut(options);
    for (const content of ['', 'my launcher']) {
        fs.writeFileSync(installed.desktopFile, content);
        fs.unlinkSync(installed.iconFile);
        assert.throws(() => installDesktopShortcut(options), /preserved/);
        assert.equal(fs.readFileSync(installed.desktopFile, 'utf8'), content);
        assert.equal(fs.existsSync(installed.iconFile), false);
        fs.writeFileSync(installed.iconFile, 'test icon');
    }
    fs.unlinkSync(installed.desktopFile);
    fs.writeFileSync(installed.iconFile, 'custom icon');
    assert.throws(() => installDesktopShortcut(options), /preserved/);
    assert.equal(fs.existsSync(installed.desktopFile), false);
    assert.equal(fs.readFileSync(installed.iconFile, 'utf8'), 'custom icon');
});

test('unreadable existing paths fail closed without altering the other file', t => {
    const options = fixture(t);
    const installed = installDesktopShortcut(options);
    fs.unlinkSync(installed.desktopFile);
    fs.mkdirSync(installed.desktopFile);
    fs.writeFileSync(installed.iconFile, 'existing icon');
    assert.throws(() => installDesktopShortcut(options));
    assert.equal(fs.statSync(installed.desktopFile).isDirectory(), true);
    assert.equal(fs.readFileSync(installed.iconFile, 'utf8'), 'existing icon');
});

test('failed icon installation rolls back newly created launcher and preserves dangling symlink', t => {
    const options = fixture(t);
    const installed = installDesktopShortcut(options);
    fs.unlinkSync(installed.desktopFile);
    fs.unlinkSync(installed.iconFile);
    const target = path.join(options.homeDir, 'missing.png');
    fs.symlinkSync(target, installed.iconFile);
    assert.throws(() => installDesktopShortcut(options), { code: 'EEXIST' });
    assert.equal(fs.existsSync(installed.desktopFile), false);
    assert.equal(fs.readlinkSync(installed.iconFile), target);
    assert.equal(fs.existsSync(target), false);
});

test('invalid AppImage paths create no shortcut files', t => {
    const options = fixture(t);
    for (const appImagePath of ['relative.AppImage', '/tmp/bad\npath', '/tmp/a=b.AppImage', '', undefined]) {
        assert.throws(() => installDesktopShortcut({ ...options, appImagePath }), /Invalid/);
    }
    assert.deepEqual(fs.readdirSync(options.homeDir), ['source.png']);
});
