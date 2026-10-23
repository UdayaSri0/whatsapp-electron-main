'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { diagnosticText } = require('../src/diagnostics');

test('support diagnostics report runtime and privacy state without suggesting call success', () => {
    const text = diagnosticText({ version: '1.2.0-rc.1', electron: '43.7.0', chrome: '150.0.0.0', node: '24.0.0',
        platform: 'linux', arch: 'x64', sessionType: 'wayland', desktop: 'ubuntu:GNOME', identityMode: 'native',
        trayAvailable: true, microphoneEnabled: true, cameraEnabled: false });
    for (const expected of ['App: 1.2.0-rc.1', 'Session: wayland', 'Desktop: GNOME', 'identity: native',
        'Camera permission: disabled', 'visibility unverified', 'Screen sharing: blocked', 'calls: not verified']) {
        assert.ok(text.includes(expected), expected);
    }
});

test('diagnostics accept only selected fields and suppress arbitrary environment or account data', () => {
    const secret = 'private-token-/home/user/phone-number';
    const text = diagnosticText({ version: secret, electron: secret, chrome: secret, node: secret,
        platform: secret, arch: secret, sessionType: secret, desktop: secret, identityMode: secret,
        profile: secret, url: secret, token: secret, logs: secret, env: { SECRET: secret } });
    assert.equal(text.includes(secret), false);
    assert.ok(text.includes('Desktop: unknown'));
    assert.ok(text.includes('Microphone permission: disabled'));
    assert.ok(diagnosticText().includes('App: unknown'));
});
