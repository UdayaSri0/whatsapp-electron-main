'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { installPermissionHandlers } = require('../src/permissions');

const ORIGIN = 'https://web.whatsapp.com';
const details = { isMainFrame: true, securityOrigin: ORIGIN, requestingUrl: `${ORIGIN}/` };

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function harness(getMediaPreferences) {
    const frame = { url: `${ORIGIN}/` };
    frame.top = frame;
    const contents = Object.assign(new EventEmitter(), {
        mainFrame: frame,
        getURL: () => frame.url,
        isDestroyed: () => false,
    });
    let window = { webContents: contents, isDestroyed: () => false };
    const handlers = {};
    const calls = { sources: 0, dialogs: 0, warnings: 0 };
    const source = { id: 'screen:1:0', name: 'First monitor' };
    const desktopCapturer = { async getSources() { calls.sources++; return [source]; } };
    const dialog = { async showMessageBox(_window, options) {
        calls.dialogs++;
        assert.equal(options.defaultId, options.cancelId);
        return { response: 0 };
    } };
    installPermissionHandlers({
        session: {
            setPermissionRequestHandler(handler) { handlers.request = handler; },
            setPermissionCheckHandler(handler) { handlers.check = handler; },
            setDisplayMediaRequestHandler(handler) { handlers.display = handler; },
        },
        getWindow: () => window,
        desktopCapturer,
        dialog,
        getMediaPreferences,
        logger: { warn() { calls.warnings++; } },
    });
    const request = { frame, securityOrigin: ORIGIN, userGesture: true, videoRequested: true, audioRequested: true };
    const permission = (type, requestDetails = details, owner = contents) => {
        const answers = [];
        handlers.request(owner, type, answer => answers.push(answer), requestDetails);
        assert.equal(answers.length, 1);
        return answers[0];
    };
    return { frame, contents, source, handlers, calls, desktopCapturer, dialog, request, permission,
        setWindow(value) { window = value; } };
}

test('media request and check require exact origin and owning live main window', () => {
    const h = harness();
    assert.equal(h.permission('media', { ...details, mediaTypes: ['audio', 'video'] }), true);
    assert.equal(h.handlers.check(h.contents, 'media', ORIGIN, { ...details, mediaType: 'audio' }), true);
    for (const owner of [null, { ...h.contents }, { isDestroyed: () => true }]) {
        assert.equal(h.permission('media', { ...details, mediaTypes: ['audio'] }, owner), false);
        assert.equal(h.handlers.check(owner, 'media', ORIGIN, { ...details, mediaType: 'audio' }), false);
    }
    for (const origin of ['https://media.whatsapp.net', 'https://other.whatsapp.com', 'https://web.whatsapp.com:444', 'http://web.whatsapp.com', 'https://evil.test']) {
        assert.equal(h.permission('media', { ...details, securityOrigin: origin, mediaTypes: ['audio'] }), false);
        assert.equal(h.handlers.check(h.contents, 'media', origin, { ...details, mediaType: 'audio' }), false);
    }
    h.frame.url = 'https://evil.test/';
    assert.equal(h.permission('notifications'), false);
});

test('permission details cannot substitute a trusted embedding origin or omit main-frame identity', () => {
    const h = harness();
    for (const requestDetails of [undefined, {}, { ...details, isMainFrame: false }, { ...details, isMainFrame: undefined },
        { ...details, requestingUrl: 'https://evil.test/' }, { ...details, embeddingOrigin: 'https://evil.test' }]) {
        assert.equal(h.permission('media', { ...requestDetails, mediaTypes: ['audio'] }), false);
        assert.equal(h.handlers.check(h.contents, 'media', ORIGIN, { ...requestDetails, mediaType: 'audio' }), false);
    }
});

test('only named audio/video device media and basic app permissions are granted', () => {
    const h = harness();
    for (const types of [[], undefined, ['unknown'], ['audio', 'screen'], 'audio']) {
        assert.equal(h.permission('media', { ...details, mediaTypes: types }), false);
    }
    for (const permission of ['display-capture', 'geolocation', 'openExternal', 'hid', 'clipboard-read', 'unknown']) {
        assert.equal(h.permission(permission), false);
        assert.equal(h.handlers.check(h.contents, permission, ORIGIN, details), false);
    }
    for (const permission of ['notifications', 'fullscreen', 'clipboard-sanitized-write']) {
        assert.equal(h.permission(permission), true);
        assert.equal(h.handlers.check(h.contents, permission, ORIGIN, details), true);
    }
    for (const mediaType of ['unknown', undefined, 'screen']) {
        assert.equal(h.handlers.check(h.contents, 'media', ORIGIN, { ...details, mediaType }), false);
    }
});

test('screen sharing selects explicitly and never grants system audio', async () => {
    const h = harness();
    const answers = [];
    await h.handlers.display(h.request, result => answers.push(result));
    assert.deepEqual(answers, [{ video: h.source }]);
    assert.equal(h.calls.sources, 1);
    assert.equal(h.calls.dialogs, 1);
    assert.equal(h.contents.listenerCount('did-start-navigation'), 0);
});

test('wrong frame, wrong window, subframe, missing gesture and untrusted screen requests fail before enumeration', async () => {
    for (const change of [{ frame: null }, { frame: { url: `${ORIGIN}/` } }, { userGesture: false },
        { userGesture: undefined }, { videoRequested: false }, { securityOrigin: 'https://media.whatsapp.net' }]) {
        const h = harness();
        const answers = [];
        await h.handlers.display({ ...h.request, ...change }, result => answers.push(result));
        assert.deepEqual(answers, [null]);
        assert.equal(h.calls.sources, 0);
    }
    const h = harness();
    h.frame.top = {};
    await h.handlers.display(h.request, result => assert.equal(result, null));
    assert.equal(h.calls.sources, 0);
    h.setWindow(null);
    await h.handlers.display(h.request, result => assert.equal(result, null));
});

test('screen chooser cancel, invalid selection, no source and portal errors reject safely', async () => {
    for (const response of [1, -1, 99, undefined, 0.5]) {
        const h = harness();
        h.dialog.showMessageBox = async () => ({ response });
        const answers = [];
        await h.handlers.display(h.request, result => answers.push(result));
        assert.deepEqual(answers, [null]);
    }
    for (const getSources of [async () => [], async () => { throw new Error('portal cancelled'); }]) {
        const h = harness();
        h.desktopCapturer.getSources = getSources;
        const answers = [];
        await h.handlers.display(h.request, result => answers.push(result));
        assert.deepEqual(answers, [null]);
        assert.equal(h.calls.dialogs, 0);
    }
});

test('navigation during source enumeration denies once, even on same-origin reload', async () => {
    const h = harness();
    const enumeration = deferred();
    h.desktopCapturer.getSources = () => enumeration.promise;
    const answers = [];
    const pending = h.handlers.display(h.request, answer => answers.push(answer));
    h.contents.emit('did-start-navigation', {}, `${ORIGIN}/`, false, true);
    assert.deepEqual(answers, [null]);
    enumeration.resolve([h.source]);
    await pending;
    assert.deepEqual(answers, [null]);
    assert.equal(h.calls.dialogs, 0);
    assert.equal(h.contents.listenerCount('did-start-navigation'), 0);
});

test('modern navigation event fields distinguish subframe and same-document changes', async () => {
    const h = harness();
    const enumeration = deferred();
    h.desktopCapturer.getSources = () => enumeration.promise;
    const answers = [];
    const pending = h.handlers.display(h.request, answer => answers.push(answer));
    h.contents.emit('did-start-navigation', { isMainFrame: false, isSameDocument: false });
    h.contents.emit('did-start-navigation', { isMainFrame: true, isSameDocument: true });
    assert.deepEqual(answers, []);
    h.contents.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false });
    assert.deepEqual(answers, [null]);
    enumeration.resolve([h.source]);
    await pending;
    assert.deepEqual(answers, [null]);
});

test('window replacement, frame replacement, destruction and navigation during picker deny', async () => {
    const mutations = [
        h => h.setWindow({ webContents: h.contents, isDestroyed: () => false }),
        h => { h.contents.mainFrame = { url: `${ORIGIN}/` }; },
        h => { h.frame.url = 'https://evil.test/'; },
        h => h.contents.emit('destroyed'),
        h => h.contents.emit('render-process-gone'),
    ];
    for (const mutate of mutations) {
        const h = harness();
        const selection = deferred();
        h.dialog.showMessageBox = () => selection.promise;
        const answers = [];
        const pending = h.handlers.display(h.request, answer => answers.push(answer));
        await Promise.resolve();
        mutate(h);
        selection.resolve({ response: 0 });
        await pending;
        assert.deepEqual(answers, [null]);
    }
});

test('only one picker can run and rejecting a concurrent request does not unlock it', async () => {
    const h = harness();
    const enumeration = deferred();
    h.desktopCapturer.getSources = () => enumeration.promise;
    const first = [];
    const pending = h.handlers.display(h.request, answer => first.push(answer));
    for (let i = 0; i < 2; i++) {
        const answers = [];
        await h.handlers.display(h.request, answer => answers.push(answer));
        assert.deepEqual(answers, [null]);
    }
    enumeration.resolve([h.source]);
    await pending;
    assert.deepEqual(first, [{ video: h.source }]);
});

test('throwing callback and failed native dialog do not cause a second callback', async () => {
    const h = harness();
    let calls = 0;
    await h.handlers.display(h.request, () => { calls++; throw new Error('frame was destroyed'); });
    assert.equal(calls, 1);
    h.dialog.showMessageBox = async () => { throw new Error('native dialog unavailable'); };
    const answers = [];
    await h.handlers.display(h.request, answer => answers.push(answer));
    assert.deepEqual(answers, [null]);
});


test('device privacy preferences apply independently to requests and checks without restart', () => {
    const preferences = { microphoneEnabled: false, cameraEnabled: true };
    const h = harness(() => preferences);
    const granted = type => h.permission('media', { ...details, mediaTypes: [type] });
    const checked = type => h.handlers.check(h.contents, 'media', ORIGIN, { ...details, mediaType: type });
    assert.equal(granted('audio'), false);
    assert.equal(checked('audio'), false);
    assert.equal(granted('video'), true);
    assert.equal(checked('video'), true);
    assert.equal(h.permission('media', { ...details, mediaTypes: ['audio', 'video'] }), false);
    preferences.microphoneEnabled = true;
    preferences.cameraEnabled = false;
    assert.equal(granted('audio'), true);
    assert.equal(checked('audio'), true);
    assert.equal(granted('video'), false);
    assert.equal(checked('video'), false);
    assert.equal(h.permission('notifications'), true);
});

test('unreadable or malformed device privacy preferences fail closed', () => {
    for (const read of [() => null, () => ({}), () => ({ microphoneEnabled: 'yes', cameraEnabled: 1 }),
        () => { throw new Error('preferences unavailable'); }]) {
        const h = harness(read);
        assert.equal(h.permission('media', { ...details, mediaTypes: ['audio', 'video'] }), false);
        assert.equal(h.handlers.check(h.contents, 'media', ORIGIN, { ...details, mediaType: 'audio' }), false);
    }
});
