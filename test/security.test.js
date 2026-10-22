'use strict';

// Modified 2026-10-22 by the UdayaSri0 fork: security regressions.
// Original tests by Dominik Lübben; GPL-2.0-or-later.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    desktopExecArgument,
    externalUrl,
    isAllowedNavigation,
} = require('../src/security');

test('only the WhatsApp Web HTTPS host may stay in the app window', () => {
    assert.equal(isAllowedNavigation('https://web.whatsapp.com/'), true);
    assert.equal(isAllowedNavigation('https://www.whatsapp.com/'), false);
    assert.equal(isAllowedNavigation('http://web.whatsapp.com/'), false);
    assert.equal(isAllowedNavigation('https://web.whatsapp.com.evil.test/'), false);
    assert.equal(isAllowedNavigation('https://web.whatsapp.com:444/'), false);
    assert.equal(isAllowedNavigation('https://user:password@web.whatsapp.com/'), false);
    assert.equal(isAllowedNavigation('https://web.whatsapp.com:443/'), true);
});

test('external links allow secure web, mail and telephone URLs only', () => {
    assert.equal(externalUrl('https://example.com/a b'), 'https://example.com/a%20b');
    assert.equal(externalUrl('mailto:test@example.com'), 'mailto:test@example.com');
    assert.equal(externalUrl('tel:+491234'), 'tel:+491234');
    assert.equal(externalUrl('http://example.com/'), 'http://example.com/');
    assert.equal(externalUrl('file:///etc/passwd'), null);
    assert.equal(externalUrl('javascript:alert(1)'), null);
    assert.equal(externalUrl('https://user:secret@example.com/'), null);
    assert.equal(externalUrl('mailto:test@example.com?subject=test%0d%0aBcc:other@example.com'), null);
    assert.equal(externalUrl('tel:--unsafe-option'), null);
    assert.equal(externalUrl('https://example.com/\nnext'), null);
    assert.equal(externalUrl('whatsapp://send?text=hello'), null);
});

test('desktop Exec paths are quoted without allowing line injection', () => {
    assert.equal(desktopExecArgument('/tmp/Whats App.AppImage'), '"/tmp/Whats App.AppImage"');
    assert.equal(desktopExecArgument('/tmp/a"$`\\b'), '"/tmp/a\\"\\$\\`\\\\b"');
    assert.equal(desktopExecArgument('/tmp/app\nName=Injected'), null);
    assert.equal(desktopExecArgument('/tmp/100%/a%U.AppImage'), '"/tmp/100%%/a%%U.AppImage"');
});
