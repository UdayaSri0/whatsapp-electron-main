'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compareVersions, hasMatchingAsset, checkForUpdate } = require('../src/update-check');
const variants = require('../config/variants').variants;

const release = (tag_name, assets, extra = {}) => ({ tag_name, draft: false, prerelease: tag_name.includes('-'), assets, ...extra });
const asset = name => ({ name, browser_download_url: 'https://attacker.invalid/not-used' });
const jsonResponse = body => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body });
const api = (body, status = 200, headers = { get: () => null }) => async (url, options) => {
    assert.equal(url, 'https://api.github.com/repos/UdayaSri0/whatsapp-electron-main/releases?per_page=100');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Accept, 'application/vnd.github+json');
    assert.equal(options.headers['X-GitHub-Api-Version'], '2022-11-28');
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: status === 200, status, headers, json: async () => body };
};

test('SemVer precedence handles release candidates, numeric identifiers and build metadata', () => {
    assert.equal(compareVersions('1.2.0-rc.10', '1.2.0-rc.2'), 1);
    assert.equal(compareVersions('1.2.0-rc.1', '1.2.0'), -1);
    assert.equal(compareVersions('2.0.0+build.2', '2.0.0+build.1'), 0);
    assert.throws(() => compareVersions('01.2.3', '1.2.3'), /Invalid semantic version/);
});

test('release assets match only the selected variant artifact names', () => {
    const personal = release('v1.3.0', [asset('WhatsApp-1.3.0-x86_64.AppImage')]);
    const business = release('v1.3.0', [asset('Business-Chat-for-WhatsApp-1.3.0-x86_64.AppImage')]);
    assert.equal(hasMatchingAsset(personal, variants.personal), true);
    assert.equal(hasMatchingAsset(personal, variants.business), false);
    assert.equal(hasMatchingAsset(business, variants.personal), false);
    assert.equal(hasMatchingAsset(business, variants.business), true);
});

test('manual check offers the highest newer matching release with a constructed trusted URL', async () => {
    const result = await checkForUpdate({ currentVersion: '1.2.0-rc.1', variant: variants.personal,
        fetchImpl: api([
            release('v1.4.0', [asset('WhatsApp-1.4.0-x86_64.AppImage')], { html_url: 'javascript:alert(1)' }),
            release('v1.3.0', [asset('WhatsApp-1.3.0-amd64.deb')]),
        ]) });
    assert.deepEqual(result, { status: 'available', version: '1.4.0', releaseUrl: 'https://github.com/UdayaSri0/whatsapp-electron-main/releases/tag/v1.4.0' });
});

test('manual check reports current when no matching release is newer', async () => {
    const result = await checkForUpdate({ currentVersion: '1.2.0', variant: variants.personal,
        fetchImpl: api([release('v1.2.0', [asset('whatsapp-electron-1.2.0-amd64.deb')])]) });
    assert.deepEqual(result, { status: 'current' });
});

test('manual check safely reports no published matching release', async () => {
    assert.deepEqual(await checkForUpdate({ currentVersion: '1.2.0', variant: variants.personal, fetchImpl: api([]) }), { status: 'none' });
    assert.deepEqual(await checkForUpdate({ currentVersion: '1.2.0', variant: variants.personal, fetchImpl: api(null, 404) }), { status: 'none' });
    assert.deepEqual(await checkForUpdate({ currentVersion: '1.2.0', variant: variants.personal,
        fetchImpl: api([release('v1.3.0', [asset('Business-Chat-for-WhatsApp-1.3.0-x86_64.AppImage')])]) }), { status: 'none' });
});

test('manual check never advertises Business releases while distribution is restricted', async () => {
    let calls = 0;
    const result = await checkForUpdate({ currentVersion: '1.2.0', variant: variants.business,
        fetchImpl: async () => { calls++; return jsonResponse([]); } });
    assert.deepEqual(result, { status: 'restricted' });
    assert.equal(calls, 0);
});

test('manual check distinguishes GitHub API rate limits', async () => {
    const fetchImpl = api({}, 403, { get: name => name === 'x-ratelimit-remaining' ? '0' : null });
    assert.deepEqual(await checkForUpdate({ currentVersion: '1.2.0', variant: variants.personal, fetchImpl }), { status: 'rate-limited' });
    assert.deepEqual(await checkForUpdate({ currentVersion: '1.2.0', variant: variants.personal, fetchImpl: api({}, 429) }), { status: 'rate-limited' });
    assert.deepEqual(await checkForUpdate({ currentVersion: '1.2.0', variant: variants.personal,
        fetchImpl: async () => ({ ok: false, status: 403, headers: { get: () => null }, json: async () => ({ message: 'You have exceeded a secondary rate limit.' }) }) }), { status: 'rate-limited' });
});

test('manual check handles offline errors and request timeouts without throwing', async () => {
    assert.deepEqual(await checkForUpdate({ currentVersion: '1.2.0', variant: variants.personal, fetchImpl: async () => { throw Error('offline'); } }), { status: 'unavailable' });
    const keepEventLoopAlive = setTimeout(() => {}, 100);
    const timeout = await checkForUpdate({ currentVersion: '1.2.0', variant: variants.personal, timeoutMs: 5,
        fetchImpl: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(Error('timeout'), { name: 'TimeoutError' })))) });
    clearTimeout(keepEventLoopAlive);
    assert.deepEqual(timeout, { status: 'timeout' });
});

test('manual check rejects malformed responses and ignores untrusted release URL fields', async () => {
    assert.deepEqual(await checkForUpdate({ currentVersion: '1.2.0', variant: variants.personal, fetchImpl: api({ tag_name: 'v1.3.0' }) }), { status: 'unavailable' });
    assert.deepEqual(await checkForUpdate({ currentVersion: '1.2.0', variant: variants.personal,
        fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => { throw new SyntaxError('invalid JSON'); } }) }), { status: 'unavailable' });
    const result = await checkForUpdate({ currentVersion: '1.2.0', variant: variants.personal,
        fetchImpl: api([release('v1.3.0', [asset('WhatsApp-1.3.0-x86_64.AppImage')], { html_url: 'file:///etc/passwd' })]) });
    assert.equal(result.releaseUrl, 'https://github.com/UdayaSri0/whatsapp-electron-main/releases/tag/v1.3.0');
});
