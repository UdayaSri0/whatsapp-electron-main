'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validatedPrefs, writePreferences, restoredWindowBounds } = require('../src/preferences');

test('corrupt preference structures recover with visible defaults and bounded geometry', () => {
    for (const value of [null, [], 'bad', 42, { window: null }, { window: [] }]) {
        assert.deepEqual(validatedPrefs(value), validatedPrefs());
    }
    const prefs = validatedPrefs({ window: { width: -1, height: Infinity, x: '0', y: 1e9 }, minimizeToTray: 'yes' });
    assert.equal(prefs.window.width, 1280);
    assert.equal(prefs.window.height, 860);
    assert.equal(prefs.window.x, undefined);
    assert.equal(prefs.window.y, undefined);
    assert.equal(prefs.minimizeToTray, false);
    assert.equal(validatedPrefs({ minimizeToTray: true, startMinimized: true }).minimizeToTray, true);
});

test('atomic serialization preserves existing preferences without leaking temporary files', t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsapp-prefs-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const filename = path.join(dir, 'whatsapp-prefs.json');
    fs.writeFileSync(filename, '{broken');
    writePreferences(filename, { startMinimized: true, minimizeToTray: true, window: { x: -20, y: 30, width: 900, height: 700 } });
    const saved = JSON.parse(fs.readFileSync(filename, 'utf8'));
    assert.equal(saved.startMinimized, true);
    assert.equal(saved.window.x, -20);
    assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
    assert.deepEqual(fs.readdirSync(dir), ['whatsapp-prefs.json']);
});

const primary = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
const secondary = { workArea: { x: -1280, y: 0, width: 1280, height: 1024 } };
test('window restoration preserves negative monitor positions and recovers disconnected monitors', () => {
    assert.deepEqual(restoredWindowBounds({ x: -1200, y: 50, width: 1000, height: 800 }, [primary, secondary], primary),
        { x: -1200, y: 50, width: 1000, height: 800 });
    assert.deepEqual(restoredWindowBounds({ x: -1200, y: 50, width: 1000, height: 800 }, [primary], primary),
        { width: 1000, height: 800 });
    assert.deepEqual(restoredWindowBounds({ x: 1800, y: 900, width: 1000, height: 800 }, [primary], primary),
        { x: 920, y: 280, width: 1000, height: 800 });
});

test('restored window fits tiny displays and rejects fractional/oversized persisted bounds', () => {
    const tiny = { workArea: { x: 0, y: 0, width: 500, height: 400 } };
    assert.deepEqual(restoredWindowBounds({ width: 16385, height: 700.5 }, [tiny], tiny), { width: 500, height: 400 });
});

test('failed atomic replacement cleans temporary files and preserves the destination', t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsapp-prefs-failure-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const filename = path.join(dir, 'whatsapp-prefs.json');
    // A nonempty directory makes rename fail deterministically even as root.
    fs.mkdirSync(filename);
    fs.writeFileSync(path.join(filename, 'keep'), 'existing content');
    assert.throws(() => writePreferences(filename, { startMinimized: true }));
    assert.deepEqual(fs.readdirSync(dir), ['whatsapp-prefs.json']);
    assert.equal(fs.readFileSync(path.join(filename, 'keep'), 'utf8'), 'existing content');
});


test('device privacy preferences preserve explicit denials and migrate older profiles', t => {
    assert.equal(validatedPrefs().microphoneEnabled, true);
    assert.equal(validatedPrefs({ cameraEnabled: 'no' }).cameraEnabled, true);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsapp-private-devices-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const filename = path.join(dir, 'prefs.json');
    writePreferences(filename, { microphoneEnabled: false, cameraEnabled: false });
    const saved = validatedPrefs(JSON.parse(fs.readFileSync(filename, 'utf8')));
    assert.equal(saved.microphoneEnabled, false);
    assert.equal(saved.cameraEnabled, false);
});
