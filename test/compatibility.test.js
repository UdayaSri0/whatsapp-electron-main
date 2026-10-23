'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { browserIdentity, compatibilityEnabled, isCompatibilityUrl, rewriteCompatibilityHeaders } = require('../src/compatibility');

const identity = browserIdentity('150.0.1.2');

test('native identity explicitly bypasses inherited compatibility mode', () => {
    assert.equal(compatibilityEnabled({}), true);
    assert.equal(compatibilityEnabled({ WHATSAPP_BROWSER_IDENTITY: 'native' }), false);
    assert.equal(compatibilityEnabled({ WHATSAPP_BROWSER_IDENTITY: 'unexpected' }), true);
    assert.match(identity.userAgent, /Chrome\/150\.0\.1\.2/);
    assert.match(identity.brands, /v="150"/);
    assert.throws(() => browserIdentity('150"\r\nInjected: true'), TypeError);
});

test('compatibility requests require HTTPS or WSS WhatsApp resources', () => {
    for (const url of ['https://web.whatsapp.com/', 'https://media.whatsapp.net/x', 'wss://web.whatsapp.com/ws']) {
        assert.equal(isCompatibilityUrl(url), true, url);
    }
    for (const url of ['http://web.whatsapp.com/', 'https://web.whatsapp.com.evil.test/', 'https://evilwhatsapp.com/', 'https://user@web.whatsapp.com/', 'https://web.whatsapp.com:444/', 'invalid']) {
        assert.equal(isCompatibilityUrl(url), false, url);
    }
});

test('headers only change for owned WhatsApp requests and are copied', () => {
    const details = { url: 'https://web.whatsapp.com/', webContentsId: 7, requestHeaders: {
        'User-Agent': 'Electron/43', 'Sec-CH-UA': 'Electron',
        'sec-ch-ua-full-version-list': 'Electron', 'sec-ch-ua-full-version': '43', Accept: '*/*',
    } };
    const rewritten = rewriteCompatibilityHeaders(details, identity, 7);
    assert.equal(rewritten['User-Agent'], identity.userAgent);
    assert.equal(rewritten['Sec-CH-UA'], identity.brands);
    assert.equal(rewritten['sec-ch-ua-full-version'], '"150.0.1.2"');
    assert.equal(rewritten.Accept, '*/*');
    assert.equal(details.requestHeaders['User-Agent'], 'Electron/43');
    for (const [request, activeIdentity, owner] of [
        [details, identity, 8], [details, null, 7], [details, identity, null],
        [{ ...details, webContentsId: -1 }, identity, 7],
        [{ ...details, url: 'https://example.test/' }, identity, 7],
    ]) assert.deepEqual(rewriteCompatibilityHeaders(request, activeIdentity, owner), details.requestHeaders);
});

const preload = fs.readFileSync(require.resolve('../src/preload'), 'utf8');
function runPreload({ origin = 'https://web.whatsapp.com', isMainFrame = true, mode = 'compatibility', version = '150.0.1.2' } = {}) {
    let injections = 0;
    vm.runInNewContext(preload, {
        require: name => {
            assert.equal(name, 'electron');
            return { contextBridge: { executeInMainWorld: () => { injections++; } } };
        },
        process: { isMainFrame, argv: [`--kcw-browser-identity=${mode}`, '--kcw-chrome-major=150', `--kcw-chrome-full=${version}`] },
        location: { origin }, console,
    });
    return injections;
}

test('sandboxed preload patches only the opted-in exact origin main frame', () => {
    assert.equal(runPreload(), 1);
    assert.equal(runPreload({ origin: 'https://web.whatsapp.com.evil.test' }), 0);
    assert.equal(runPreload({ origin: 'https://media.whatsapp.net' }), 0);
    assert.equal(runPreload({ origin: 'https://web.whatsapp.com:444' }), 0);
    assert.equal(runPreload({ isMainFrame: false }), 0);
    assert.equal(runPreload({ mode: 'native' }), 0);
    assert.equal(runPreload({ version: '149.0.0.0' }), 0);
});
