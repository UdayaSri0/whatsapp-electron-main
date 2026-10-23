'use strict';

// Observable main-process regression coverage. Electron, desktop services and
// timers are mocked; these tests cannot verify Chromium, portals, trays or calls.
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sourcePath = path.resolve(__dirname, '../src/main.js');
const APP_URL = 'https://web.whatsapp.com/';

async function boot({ prefs = {}, trayFailure = false, environment = {}, deferredReady = false, packaged = false, shortcutFailure = false, autostartFailure = false, dialogFailure = null, clipboardFailure = false } = {}) {
    let ready = !deferredReady;
    let resolveReady;
    const readyPromise = new Promise(resolve => { resolveReady = resolve; });
    if (ready) resolveReady();
    const windows = [];
    const timers = new Set();
    const opened = [];
    const writes = [];
    const dialogs = [];
    const copied = [];
    const warnings = [];
    const autostartWrites = [];
    let autostartEnabled = false;
    const session = {
        webRequest: { onBeforeSendHeaders(_filter, callback) { session.headers = callback; } },
        setUserAgent(value) { session.userAgent = value; },
        setPermissionRequestHandler(callback) { session.request = callback; },
        setPermissionCheckHandler(callback) { session.check = callback; },
        setDisplayMediaRequestHandler(callback) { session.display = callback; },
    };
    class Contents extends EventEmitter {
        constructor() {
            super();
            this.id = windows.length + 1;
            this.url = APP_URL;
            this.mainFrame = { url: APP_URL };
            this.mainFrame.top = this.mainFrame;
            this.loads = [];
        }
        loadURL(url) {
            this.url = url;
            this.loads.push(url);
            // Record security setup at the exact point remote content is loaded.
            this.initialGuards ??= {
                request: typeof session.request,
                check: typeof session.check,
                display: typeof session.display,
                windowOpen: typeof this.open,
                navigation: this.listenerCount('will-navigate'),
                frames: this.listenerCount('will-frame-navigate'),
                redirect: this.listenerCount('will-redirect'),
                webview: this.listenerCount('will-attach-webview'),
            };
            return Promise.resolve();
        }
        getURL() { return this.url; }
        isDestroyed() { return false; }
        setUserAgent(value) { this.userAgent = value; }
        setWindowOpenHandler(callback) { this.open = callback; }
    }
    class Window extends EventEmitter {
        constructor(options) {
            super();
            this.options = options;
            this.webContents = new Contents();
            this.visible = false;
            this.destroyed = false;
            windows.push(this);
        }
        static getAllWindows() { return windows.filter(window => !window.destroyed); }
        setMenuBarVisibility() {}
        show() { this.visible = true; }
        hide() { this.visible = false; }
        focus() { this.focused = true; }
        restore() { this.minimized = false; }
        maximize() { this.maximized = true; }
        isMaximized() { return Boolean(this.maximized); }
        isMinimized() { return Boolean(this.minimized); }
        isVisible() { return this.visible; }
        isFocused() { return Boolean(this.focused); }
        isDestroyed() { return this.destroyed; }
        getBounds() { return { x: 10, y: 20, width: 1000, height: 700 }; }
    }
    class Tray extends EventEmitter {
        constructor() { super(); if (trayFailure) throw new Error('No status notifier'); }
        setToolTip(value) { this.tooltip = value; }
        setContextMenu(value) { this.menu = value; }
        isDestroyed() { return false; }
        destroy() {}
    }
    const app = Object.assign(new EventEmitter(), {
        userAgentFallback: 'WhatsApp/1 Electron/43 Chrome/150',
        commandLine: { appendSwitch() {} },
        setName() {}, enableSandbox() { app.sandbox = true; },
        isPackaged: packaged, getVersion: () => '1.2.0-rc.1',
        getPath: () => '/mock-profile', requestSingleInstanceLock: () => true,
        whenReady: () => readyPromise, isReady: () => ready,
        quit() { app.quitCount = (app.quitCount || 0) + 1; },
        setBadgeCount(value) { app.badge = value; },
    });
    const area = { x: 0, y: 0, width: 1920, height: 1080 };
    const electron = {
        app, BrowserWindow: Window, Tray, session: { defaultSession: session },
        shell: { openExternal: async url => { opened.push(url); } },
        Menu: { buildFromTemplate: value => value, setApplicationMenu(value) { app.menu = value; } },
        clipboard: { writeText(text) { if (clipboardFailure) throw new Error('Clipboard unavailable'); copied.push(text); } },
        nativeImage: { createFromPath: () => ({ resize() { return this; } }) },
        screen: { getAllDisplays: () => [{ workArea: area }], getPrimaryDisplay: () => ({ workArea: area }), getDisplayMatching: () => ({ workArea: area }) },
        desktopCapturer: { getSources: async () => [{ id: 'screen:1', name: 'Monitor' }] },
        dialog: { showMessageBox(...args) {
            dialogs.push({ ...args.at(-1), parent: args.length === 2 ? args[0] : null });
            if (dialogFailure === 'sync') throw new Error('Dialog unavailable');
            if (dialogFailure === 'async') return Promise.reject(new Error('Dialog unavailable'));
            return Promise.resolve({ response: 1 });
        } },
    };
    const mockFs = {
        existsSync: () => true,
        readFileSync: () => typeof prefs === 'string' ? prefs : JSON.stringify(prefs),
        mkdirSync() {}, renameSync() {}, copyFileSync() {}, unlinkSync() {},
        writeFileSync: (...args) => writes.push(args),
    };
    const context = {
        URL, __dirname: path.dirname(sourcePath), console: { warn: (...args) => warnings.push(args), error() {}, log() {} },
        process: { env: environment, platform: 'linux', versions: { chrome: '150.0.1.2' }, exit() { throw new Error('Unexpected exit'); } },
        setTimeout(callback, delay) {
            const timer = { callback, delay, unref() {} };
            timers.add(timer);
            return timer;
        },
        clearTimeout(timer) { timers.delete(timer); },
    };
    const modules = new Map();
    function loadModule(filename) {
        if (modules.has(filename)) return modules.get(filename).exports;
        const module = { exports: {} };
        modules.set(filename, module);
        const localRequire = name => {
            if (name === 'electron') return electron;
            if (name === 'node:fs') return mockFs;
            if (name === './autostart') return {
                getAutostartStatus: () => ({ enabled: autostartEnabled }),
                setAutostart(options) { if (autostartFailure) throw new Error('Existing launcher preserved'); autostartWrites.push(options); autostartEnabled = options.enabled; },
            };
            if (name === './desktop-integration') return { installDesktopShortcut() {
                if (shortcutFailure) throw new Error('Existing shortcut preserved');
                return { desktopFile: '/mock-home/.local/share/applications/whatsapp.desktop' };
            } };
            return name.startsWith('.')
                ? loadModule(require.resolve(path.resolve(path.dirname(filename), name)))
                : require(name);
        };
        const execute = vm.runInNewContext(`(function(require, module, exports, __filename, __dirname) {${fs.readFileSync(filename, 'utf8')}\n})`, context, { filename });
        execute(localRequire, module, module.exports, filename, path.dirname(filename));
        return module.exports;
    }
    loadModule(sourcePath);
    await Promise.resolve();
    await Promise.resolve();
    return {
        app, session, windows, timers, opened, writes, dialogs, copied, autostartWrites, warnings,
        async ready() {
            ready = true;
            resolveReady();
            await Promise.resolve();
            await Promise.resolve();
        },
        fire(delay) {
            const selected = [...timers].find(timer => timer.delay === delay);
            assert.ok(selected, `expected a ${delay}ms timer`);
            timers.delete(selected);
            selected.callback();
        },
    };
}

function event() { return { prevented: false, preventDefault() { this.prevented = true; } }; }

test('main startup isolates remote content and installs owner-bound permissions', async () => {
    const runtime = await boot();
    const window = runtime.windows[0];
    const preferences = window.options.webPreferences;
    assert.equal(runtime.app.sandbox, true);
    assert.equal(preferences.contextIsolation, true);
    assert.equal(preferences.sandbox, true);
    assert.equal(preferences.webSecurity, true);
    assert.equal(preferences.nodeIntegration, false);
    assert.equal(preferences.backgroundThrottling, false);
    assert.equal(window.webContents.loads[0], APP_URL);
    const details = { isMainFrame: true, requestingUrl: APP_URL, mediaTypes: ['audio'], mediaType: 'audio' };
    let answer;
    runtime.session.request(window.webContents, 'media', value => { answer = value; }, details);
    assert.equal(answer, true);
    runtime.session.request(new EventEmitter(), 'media', value => { answer = value; }, details);
    assert.equal(answer, false);
    assert.equal(runtime.session.check(null, 'media', APP_URL, details), false);
    assert.equal(runtime.session.check(window.webContents, 'media', 'https://evil.test', details), false);
});

test('tray failure reveals start-minimized window and lets close exit', async () => {
    const runtime = await boot({ trayFailure: true, prefs: { startMinimized: true, minimizeToTray: true } });
    const window = runtime.windows[0];
    window.emit('ready-to-show');
    assert.equal(window.isVisible(), true);
    const close = event();
    window.emit('close', close);
    assert.equal(close.prevented, false);
    window.destroyed = true;
    window.emit('closed');
    runtime.app.emit('window-all-closed');
    assert.equal(runtime.app.quitCount, 1);
});

test('working tray preserves background window and second instance restores focus', async () => {
    const runtime = await boot({ prefs: { startMinimized: true, minimizeToTray: true } });
    const window = runtime.windows[0];
    window.emit('ready-to-show');
    assert.equal(window.isVisible(), false);
    runtime.app.emit('second-instance');
    assert.equal(window.isVisible(), true);
    assert.equal(window.isFocused(), true);
    const close = event();
    window.emit('close', close);
    assert.equal(close.prevented, true);
    assert.equal(window.isVisible(), false);
});

test('unsafe navigation, redirects and frames cannot launch external protocols', async () => {
    const runtime = await boot();
    const contents = runtime.windows[0].webContents;
    const redirect = event();
    contents.emit('will-redirect', redirect, 'https://evil.test/');
    assert.equal(redirect.prevented, true);
    const navigation = event();
    contents.emit('will-navigate', navigation, 'file:///etc/passwd');
    assert.equal(navigation.prevented, true);
    assert.equal(runtime.opened.length, 0);
    const embedded = Object.assign(event(), { url: 'file:///etc/passwd', isMainFrame: false });
    contents.emit('will-frame-navigate', embedded);
    assert.equal(embedded.prevented, true);
    assert.equal(contents.open({ url: 'file:///etc/passwd' }).action, 'deny');
    assert.equal(runtime.opened.length, 0);
    assert.equal(contents.open({ url: 'https://example.com/' }).action, 'deny');
    assert.equal(runtime.opened[0], 'https://example.com/');
});

test('transient failures back off, successful load resets retries and quit cancels recovery', async () => {
    const runtime = await boot();
    const window = runtime.windows[0];
    const contents = window.webContents;
    const fail = () => contents.emit('did-fail-load', {}, -106, 'ERR_INTERNET_DISCONNECTED', APP_URL, true);
    fail();
    runtime.fire(5000);
    assert.equal(contents.loads.length, 2);
    fail();
    runtime.fire(10000);
    assert.equal(contents.loads.length, 3);
    contents.emit('did-finish-load');
    contents.emit('render-process-gone', {}, { reason: 'crashed' });
    assert.ok([...runtime.timers].some(timer => timer.delay === 5000));
    runtime.app.emit('before-quit');
    assert.equal([...runtime.timers].some(timer => timer.delay >= 5000), false);
    const close = event();
    window.emit('close', close);
    assert.equal(close.prevented, false);
});

test('native mode leaves application and session identity unchanged', async () => {
    const runtime = await boot({ environment: { WHATSAPP_BROWSER_IDENTITY: 'native' } });
    assert.equal(runtime.app.userAgentFallback, 'WhatsApp/1 Electron/43 Chrome/150');
    assert.equal(runtime.session.userAgent, undefined);
    assert.equal(runtime.windows[0].webContents.userAgent, undefined);
    assert.equal(runtime.windows[0].options.webPreferences.additionalArguments.length, 0);
});


test('corrupt preferences recover visibly and title updates clear on window closure', async () => {
    const runtime = await boot({ prefs: '{invalid json' });
    const window = runtime.windows[0];
    window.emit('ready-to-show');
    assert.equal(window.isVisible(), true);
    window.webContents.emit('page-title-updated', {}, '(12) WhatsApp');
    assert.equal(runtime.app.badge, 12);
    window.webContents.emit('page-title-updated', {}, '(123456789) WhatsApp');
    assert.equal(runtime.app.badge, 9999);
    const close = event();
    window.emit('close', close);
    assert.equal(close.prevented, false);
    window.destroyed = true;
    window.emit('closed');
    assert.equal(runtime.app.badge, 0);
});

test('aborted and subframe failures do not schedule reloads or background recovery after quit', async () => {
    const runtime = await boot();
    const contents = runtime.windows[0].webContents;
    contents.emit('did-fail-load', {}, -3, 'ERR_ABORTED', APP_URL, true);
    contents.emit('did-fail-load', {}, -106, 'ERR_INTERNET_DISCONNECTED', APP_URL, false);
    assert.equal([...runtime.timers].some(timer => timer.delay >= 5000), false);
    runtime.app.emit('before-quit');
    contents.emit('render-process-gone', {}, { reason: 'crashed' });
    contents.emit('did-fail-load', {}, -106, 'ERR_INTERNET_DISCONNECTED', APP_URL, true);
    assert.equal([...runtime.timers].some(timer => timer.delay >= 5000), false);
});


test('security handlers are installed before the first remote load', async () => {
    const runtime = await boot();
    const guards = runtime.windows[0].webContents.initialGuards;
    for (const name of ['request', 'check', 'display', 'windowOpen']) {
        assert.equal(guards[name], 'function', `${name} must guard initial navigation`);
    }
    for (const name of ['navigation', 'frames', 'redirect', 'webview']) {
        assert.ok(guards[name] > 0, `${name} must guard initial navigation`);
    }
});

test('second instance before readiness defers window creation and overrides start minimized', async () => {
    const runtime = await boot({ deferredReady: true, prefs: { startMinimized: true, minimizeToTray: true } });
    assert.equal(runtime.windows.length, 0);
    runtime.app.emit('second-instance');
    runtime.app.emit('second-instance');
    assert.equal(runtime.windows.length, 0);
    await runtime.ready();
    assert.equal(runtime.windows.length, 1);
    runtime.windows[0].emit('ready-to-show');
    assert.equal(runtime.windows[0].isVisible(), true);
});

test('explicit tray disable reveals persisted start-minimized profiles and startup fallback works offline', async () => {
    const runtime = await boot({ environment: { WHATSAPP_DISABLE_TRAY: '1' }, prefs: { startMinimized: true } });
    assert.equal(runtime.windows[0].isVisible(), false);
    runtime.fire(4000);
    assert.equal(runtime.windows[0].isVisible(), true);
});

test('main installs a cancellable display handler and denies ambiguous media capture', async () => {
    const runtime = await boot();
    const contents = runtime.windows[0].webContents;
    const answers = [];
    // Direct invocation verifies wiring only. Chromium may deny getDisplayMedia
    // at the preceding ambiguous media permission check before this handler runs.
    await runtime.session.display({
        frame: contents.mainFrame, securityOrigin: APP_URL,
        userGesture: true, videoRequested: true, audioRequested: false,
    }, value => answers.push(value));
    assert.deepEqual(answers, [null]);
    const ambiguous = [];
    runtime.session.request(contents, 'media', value => ambiguous.push(value), {
        isMainFrame: true, requestingUrl: APP_URL, securityOrigin: 'https://web.whatsapp.com', mediaTypes: [],
    });
    assert.deepEqual(ambiguous, [false]);
    assert.equal(runtime.session.check(contents, 'media', 'https://web.whatsapp.com', {
        isMainFrame: true, securityOrigin: 'https://web.whatsapp.com', mediaType: 'unknown',
    }), false);
});

test('restored maximized state retains normal geometry through shutdown persistence', async () => {
    const runtime = await boot({ prefs: { window: { x: 30, y: 40, width: 1100, height: 800, maximized: true } } });
    const window = runtime.windows[0];
    assert.equal(window.isMaximized(), true);
    assert.equal(window.options.x, 30);
    assert.equal(window.options.y, 40);
    assert.equal(window.options.width, 1100);
    assert.equal(window.options.height, 800);
    window.emit('resize');
    runtime.app.emit('before-quit');
    const persisted = JSON.parse(runtime.writes.at(-1)[1]);
    assert.equal(persisted.window.maximized, true);
    assert.equal(persisted.window.width, 1100);
    assert.equal(persisted.window.height, 800);
    assert.equal(persisted.window.x, 30);
    assert.equal(persisted.window.y, 40);
});

function menuItem(runtime, group, label) {
    return runtime.app.menu.find(item => item.label === group).submenu.find(item => item.label === label);
}

test('native menus remain accessible without tray and preserve editing shortcuts', async () => {
    const runtime = await boot({ trayFailure: true });
    assert.equal(runtime.windows[0].options.autoHideMenuBar, false);
    assert.equal(menuItem(runtime, 'Settings', 'Minimize to tray on close').enabled, false);
    assert.equal(menuItem(runtime, 'Settings', 'Start automatically at login').enabled, false);
    assert.ok(runtime.app.menu.find(item => item.label === 'Edit').submenu.some(item => item.role === 'paste'));
    const before = runtime.windows[0].webContents.loads.length;
    menuItem(runtime, 'File', 'Reload').click();
    assert.equal(runtime.windows[0].webContents.loads.length, before + 1);
    menuItem(runtime, 'Help', 'About').click();
    assert.match(runtime.dialogs.at(-1).detail, /UdayaSri0/);
    assert.match(runtime.dialogs.at(-1).detail, /Dominik/);
    menuItem(runtime, 'Help', 'Copy Diagnostics').click();
    assert.equal(runtime.copied.length, 1);
    assert.match(runtime.copied[0], /1\.2\.0-rc\.1/);
    assert.doesNotMatch(runtime.copied[0], /mock-profile/);
});

test('media controls persist, update live permission policy and reload active streams', async () => {
    const runtime = await boot();
    const contents = runtime.windows[0].webContents;
    menuItem(runtime, 'Settings', 'Allow microphone (reload ends calls)').click({ checked: false });
    assert.equal(JSON.parse(runtime.writes.at(-1)[1]).microphoneEnabled, false);
    assert.equal(contents.loads.length, 2);
    let answer;
    runtime.session.request(contents, 'media', value => { answer = value; }, {
        isMainFrame: true, requestingUrl: APP_URL, mediaTypes: ['audio'], mediaType: 'audio',
    });
    assert.equal(answer, false);
    assert.equal(menuItem(runtime, 'Settings', 'Allow microphone (reload ends calls)').checked, false);
    menuItem(runtime, 'Settings', 'Allow camera (reload ends calls)').click({ checked: false });
    assert.equal(JSON.parse(runtime.writes.at(-1)[1]).cameraEnabled, false);
});

test('opt-in autostart writes only on deliberate packaged menu action', async () => {
    const runtime = await boot({ packaged: true });
    assert.equal(runtime.autostartWrites.length, 0);
    assert.equal(menuItem(runtime, 'Settings', 'Start automatically at login').checked, false);
    menuItem(runtime, 'Settings', 'Start automatically at login').click({ checked: true });
    assert.equal(runtime.autostartWrites.length, 1);
    assert.equal(runtime.autostartWrites[0].enabled, true);
    assert.equal(menuItem(runtime, 'Settings', 'Start automatically at login').checked, true);
});

test('desktop integration conflicts surface as native errors without losing user files', async () => {
    const runtime = await boot({ packaged: true, shortcutFailure: true, autostartFailure: true,
        environment: { APPIMAGE: '/mock-home/WhatsApp.AppImage' } });
    menuItem(runtime, 'Settings', 'Install AppImage desktop shortcut').click();
    assert.equal(runtime.dialogs.at(-1).type, 'error');
    assert.match(runtime.dialogs.at(-1).detail, /preserved/);
    menuItem(runtime, 'Settings', 'Start automatically at login').click({ checked: true });
    assert.equal(runtime.dialogs.at(-1).type, 'error');
    assert.equal(menuItem(runtime, 'Settings', 'Start automatically at login').checked, false);
});


test('dialog and clipboard service failures are reported without throwing or rejected promises', async () => {
    for (const dialogFailure of ['sync', 'async']) {
        const runtime = await boot({ dialogFailure, clipboardFailure: true });
        assert.doesNotThrow(() => menuItem(runtime, 'Help', 'About').click());
        assert.doesNotThrow(() => menuItem(runtime, 'Help', 'Copy Diagnostics').click());
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(runtime.copied.length, 0);
        assert.ok(runtime.warnings.some(args => args[0] === '[dialog] unavailable:'));
        assert.ok(runtime.warnings.some(args => args[0] === '[Copy Diagnostics] failed:'));
        assert.equal(runtime.dialogs.length, 2);
    }
    const runtime = await boot();
    const window = runtime.windows[0];
    window.destroyed = true;
    window.emit('closed');
    assert.doesNotThrow(() => menuItem(runtime, 'Help', 'About').click());
    assert.equal(runtime.dialogs.at(-1).parent, null);
});
