'use strict';

// Modified 2026-10-22 by the UdayaSri0 fork: secure Linux foundation.
// Original implementation by Dominik Lübben; GPL-2.0-or-later.

const {
    app,
    clipboard,
    BrowserWindow,
    desktopCapturer,
    dialog,
    Menu,
    nativeImage,
    screen,
    session,
    shell,
    Tray,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {
    externalUrl,
    isAllowedNavigation,
} = require('./security');
const { installDesktopShortcut } = require('./desktop-integration');
const { diagnosticText } = require('./diagnostics');
const { getAutostartStatus, setAutostart } = require('./autostart');
const { validatedPrefs, writePreferences, restoredWindowBounds } = require('./preferences');
const { installPermissionHandlers } = require('./permissions');
const { browserIdentity, compatibilityEnabled, rewriteCompatibilityHeaders } = require('./compatibility');
const identity = compatibilityEnabled() ? browserIdentity(process.versions.chrome) : null;

// ── App identity ─────────────────────────────────────────────────────
// Keep the established name, WM_CLASS and profile directory aligned with
// the installed desktop entry so existing sessions and window grouping survive.
app.setName('WhatsApp');
app.enableSandbox();

// Modern Electron selects Wayland automatically; leave native Ozone detection intact.
if (process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland') {
    // Preserve the existing Wayland Vulkan compatibility workaround pending
    // hardware validation. OpenGL and video decoding remain accelerated.
    app.commandLine.appendSwitch('use-vulkan', 'disabled');
    app.commandLine.appendSwitch('disable-features', 'Vulkan,VulkanFromANGLE,DefaultANGLEVulkan');
}

// ── Constants ────────────────────────────────────────────────────────
const APP_URL = 'https://web.whatsapp.com/';
const ICON_PATH = path.join(__dirname, 'icon.png');

function safeOpenExternal(rawUrl) {
    const url = externalUrl(rawUrl);
    if (!url) return false;
    shell.openExternal(url).catch((error) => {
        console.warn('[external-link] open failed:', error?.message || error);
    });
    return true;
}

// ── Tiny prefs store ────────────────────────────────────────────────
const prefsPath = path.join(app.getPath('userData'), 'whatsapp-prefs.json');

let prefs = validatedPrefs();
try {
    if (fs.existsSync(prefsPath)) {
        const loaded = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
        prefs = validatedPrefs(loaded);
    }
} catch (e) {
    console.warn('[prefs] load failed:', e?.message || e);
}
let saveTimer = null;
function flushPrefs() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    try {
        writePreferences(prefsPath, prefs);
    } catch (e) {
        console.warn('[prefs] save failed:', e?.message || e);
    }
}

function savePrefs() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushPrefs, 250);
}
const store = {
    get(key) {
        const parts = key.split('.');
        let v = prefs;
        for (const p of parts) v = v?.[p];
        return v;
    },
    set(key, value) {
        const parts = key.split('.');
        let target = prefs;
        for (let i = 0; i < parts.length - 1; i++) {
            target[parts[i]] = target[parts[i]] ?? {};
            target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = value;
        savePrefs();
    },
};

// ── Desktop integration (AppImage only) ─────────────────────────────
// User-invoked AppImage shortcut installation. Existing launchers are preserved.
function ensureDesktopIntegration() {
    if (process.platform !== 'linux' || !process.env.APPIMAGE) return;
    try {
        const result = installDesktopShortcut({
            appImagePath: process.env.APPIMAGE,
            homeDir: os.homedir(),
            iconPath: ICON_PATH,
        });
        showDialog({ type: 'info', title: 'Desktop shortcut',
            message: 'Desktop shortcut installed', detail: result.desktopFile });
    } catch (error) {
        integrationError('Desktop shortcut', error);
    }
}

// ── Single-instance lock ────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
    process.exit(0);
}

// ── State ───────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let isQuitting = false;
let unreadCount = 0;
let loadRetryTimer = null;
let loadRetryDelay = 5000;

function clearLoadRetry() {
    if (loadRetryTimer) clearTimeout(loadRetryTimer);
    loadRetryTimer = null;
}

function scheduleLoadRetry() {
    clearLoadRetry();
    if (isQuitting || !mainWindow || mainWindow.isDestroyed()) return;
    loadRetryTimer = setTimeout(() => loadWhatsApp(), loadRetryDelay);
    loadRetryTimer.unref();
    loadRetryDelay = Math.min(loadRetryDelay * 2, 60000);
}

function loadWhatsApp({ resetBackoff = false } = {}) {
    clearLoadRetry();
    if (resetBackoff) loadRetryDelay = 5000;
    if (isQuitting || !mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.loadURL(APP_URL).catch((error) => {
        if (error?.code !== 'ERR_ABORTED') {
            console.warn('[navigation] load failed:', error?.message || error);
        }
    });
}

// Compatibility is isolated to this window and WhatsApp-owned requests.
function setupClientHintsSpoofing() {
    if (!identity) return;
    session.defaultSession.webRequest.onBeforeSendHeaders({
        urls: ['https://*.whatsapp.com/*', 'https://*.whatsapp.net/*', 'wss://*.whatsapp.com/*', 'wss://*.whatsapp.net/*'],
    }, (details, callback) => {
        const owner = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents.id : null;
        callback({ requestHeaders: rewriteCompatibilityHeaders(details, identity, owner) });
    });
}

function configurePermissions() {
    installPermissionHandlers({
        session: session.defaultSession,
        getWindow: () => isQuitting ? null : mainWindow,
        desktopCapturer,
        dialog,
        logger: console,
        getMediaPreferences: () => ({ microphoneEnabled: store.get('microphoneEnabled'), cameraEnabled: store.get('cameraEnabled') }),
    });
}

// ── Main window ─────────────────────────────────────────────────────
function createWindow({ forceShow = false } = {}) {
    const savedBounds = store.get('window');
    const bounds = restoredWindowBounds(savedBounds, screen.getAllDisplays(), screen.getPrimaryDisplay());
    const startMinimized = !forceShow && Boolean(tray) && store.get('startMinimized');

    mainWindow = new BrowserWindow({
        ...bounds,
        minWidth: Math.min(600, bounds.width),
        minHeight: Math.min(600, bounds.height),
        title: 'WhatsApp',
        backgroundColor: '#111b21',
        icon: ICON_PATH,
        autoHideMenuBar: false,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            spellcheck: true,
            // Keep the renderer active for incoming calls while the window is hidden.
            backgroundThrottling: false,
            additionalArguments: identity?.additionalArguments || [],
        },
    });

    if (savedBounds.maximized) mainWindow.maximize();
    mainWindow.setMenuBarVisibility(true);

    const createdWindow = mainWindow;
    const revealWindow = () => {
        if (!startMinimized && !createdWindow.isDestroyed() && !createdWindow.isVisible()) {
            createdWindow.show();
        }
    };
    mainWindow.once('ready-to-show', revealWindow);
    const revealFallback = setTimeout(revealWindow, 4000);
    revealFallback.unref();

    if (identity) mainWindow.webContents.setUserAgent(identity.userAgent);

    // ── Persist window bounds ─────────────────────────────────────
    const saveBounds = () => {
        if (!mainWindow) return;
        if (!mainWindow.isMaximized()) {
            const b = mainWindow.getBounds();
            store.set('window', { ...b, maximized: false });
        } else {
            store.set('window.maximized', true);
        }
    };
    mainWindow.on('resize', saveBounds);
    mainWindow.on('move', saveBounds);
    mainWindow.on('maximize', () => store.set('window.maximized', true));
    mainWindow.on('unmaximize', () => store.set('window.maximized', false));

    // ── Close to tray ─────────────────────────────────────────
    mainWindow.on('close', (e) => {
        if (!isQuitting && tray && !tray.isDestroyed() && store.get('minimizeToTray')) {
            e.preventDefault();
            mainWindow.hide();
        }
    });
    mainWindow.on('closed', () => {
        clearTimeout(revealFallback);
        clearLoadRetry();
        mainWindow = null;
        unreadCount = 0;
        updateBadge();
    });

    mainWindow.webContents.on('did-finish-load', () => {
        if (!mainWindow || !isAllowedNavigation(mainWindow.webContents.getURL())) return;
        clearLoadRetry();
        loadRetryDelay = 5000;
    });
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, url, isMainFrame) => {
        if (!isMainFrame || errorCode === -3 || url !== APP_URL) return;
        console.warn(`[navigation] ${errorDescription} (${errorCode}); retrying`);
        scheduleLoadRetry();
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        if (isQuitting || details.reason === 'clean-exit') return;
        console.warn('[renderer] process gone:', details.reason);
        scheduleLoadRetry();
    });

    // Derive unread indicators from WhatsApp Web titles such as "(3) WhatsApp".
    mainWindow.webContents.on('page-title-updated', (_e, title) => {
        const m = /^\((\d+)\)/.exec(title);
        const next = m ? Math.min(Number(m[1]), 9999) : 0;
        if (next !== unreadCount) {
            unreadCount = next;
            updateBadge();
        }
    });

    // ── External links → system browser ────────────────────────────
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        safeOpenExternal(url);
        return { action: 'deny' };
    });

    const guardNavigation = (event, url) => {
        if (isAllowedNavigation(url)) return;
        event.preventDefault();
        safeOpenExternal(url);
    };
    mainWindow.webContents.on('will-navigate', guardNavigation);
    mainWindow.webContents.on('will-frame-navigate', (event) => {
        if (!event.isMainFrame && !isAllowedNavigation(event.url)) event.preventDefault();
    });
    // Redirects are not deliberate external-link activations. Block without
    // launching another application, including redirects in child frames.
    mainWindow.webContents.on('will-redirect', (event, url) => {
        if (!isAllowedNavigation(url)) event.preventDefault();
    });

    mainWindow.webContents.on('will-attach-webview', (e) => e.preventDefault());
    // Install every guard before initiating even the first navigation.
    loadWhatsApp({ resetBackoff: true });
}

// Native controls remain accessible even when the desktop has no tray provider.
function showDialog(options) {
    try {
        const result = mainWindow && !mainWindow.isDestroyed()
            ? dialog.showMessageBox(mainWindow, options) : dialog.showMessageBox(options);
        Promise.resolve(result).catch(error => console.warn('[dialog] unavailable:', error?.message || error));
    } catch (error) {
        console.warn('[dialog] unavailable:', error?.message || error);
    }
}

function integrationError(title, error) {
    console.warn(`[${title}] failed:`, error?.message || error);
    showDialog({ type: 'error', title,
        message: `${title} failed`, detail: error?.message || String(error) });
}

function autostartOptions() {
    return { appImagePath: process.env.APPIMAGE, executablePath: process.execPath, homeDir: os.homedir(), configDir: process.env.XDG_CONFIG_HOME };
}

function togglePreference(key, value) {
    store.set(key, value);
    flushPrefs();
    if (key === 'microphoneEnabled' || key === 'cameraEnabled') loadWhatsApp({ resetBackoff: true });
    refreshMenus();
}

function settingsMenuItems() {
    const hasTray = Boolean(tray && !tray.isDestroyed());
    let autostartEnabled = false;
    const canAutostart = process.platform === 'linux' && app.isPackaged;
    if (canAutostart) {
        try { autostartEnabled = getAutostartStatus(autostartOptions()).enabled; }
        catch (error) { console.warn('[autostart] status unavailable:', error?.message || error); }
    }
    return [
        { label: 'Minimize to tray on close', type: 'checkbox', enabled: hasTray,
            checked: store.get('minimizeToTray'), click: item => togglePreference('minimizeToTray', item.checked) },
        { label: 'Start minimized (requires tray)', type: 'checkbox', enabled: hasTray,
            checked: store.get('startMinimized'), click: item => togglePreference('startMinimized', item.checked) },
        { type: 'separator' },
        { label: 'Allow microphone (reload ends calls)', type: 'checkbox', checked: store.get('microphoneEnabled'),
            click: item => togglePreference('microphoneEnabled', item.checked) },
        { label: 'Allow camera (reload ends calls)', type: 'checkbox', checked: store.get('cameraEnabled'),
            click: item => togglePreference('cameraEnabled', item.checked) },
        { type: 'separator' },
        { label: 'Start automatically at login', type: 'checkbox', enabled: Boolean(canAutostart), checked: autostartEnabled,
            click: item => {
                try { setAutostart({ ...autostartOptions(), enabled: item.checked }); }
                catch (error) { integrationError('Autostart', error); }
                refreshMenus();
            } },
        { label: 'Install AppImage desktop shortcut', visible: process.platform === 'linux' && Boolean(process.env.APPIMAGE),
            click: ensureDesktopIntegration },
    ];
}

function quitApplication() { isQuitting = true; app.quit(); }

function trayMenuItems() {
    return [{ label: 'Open', click: showWindow }, { label: 'Reload', click: () => loadWhatsApp({ resetBackoff: true }) },
        { type: 'separator' }, ...settingsMenuItems(), { type: 'separator' }, { label: 'Quit', click: quitApplication }];
}

function refreshMenus() {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
        { label: 'File', submenu: [
            { label: 'Open', accelerator: 'CommandOrControl+O', click: showWindow },
            { label: 'Reload', accelerator: 'CommandOrControl+R', click: () => loadWhatsApp({ resetBackoff: true }) },
            { type: 'separator' }, { label: 'Quit', accelerator: 'CommandOrControl+Q', click: quitApplication },
        ] },
        { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' },
            { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
        { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
            { type: 'separator' }, { role: 'togglefullscreen' }] },
        { label: 'Settings', submenu: settingsMenuItems() },
        { label: 'Help', submenu: [
            { label: 'Copy Diagnostics', click: () => {
                try { clipboard.writeText(diagnosticText({
                version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome,
                node: process.versions.node, platform: process.platform, arch: process.arch,
                sessionType: process.env.XDG_SESSION_TYPE, desktop: process.env.XDG_CURRENT_DESKTOP,
                identityMode: identity ? 'compatibility' : 'native', trayAvailable: Boolean(tray && !tray.isDestroyed()),
                microphoneEnabled: store.get('microphoneEnabled'), cameraEnabled: store.get('cameraEnabled'), screenSharing: 'blocked',
                })); }
                catch (error) { integrationError('Copy Diagnostics', error); }
            } },
            { label: 'About', click: () => showDialog({
                type: 'info', title: 'About WhatsApp for Linux', message: `WhatsApp for Linux ${app.getVersion()}`,
                detail: 'Unofficial WhatsApp Web desktop application. Maintained by UdayaSri0.\nBased on the original work of Dominik Lübben. GPL-2.0-or-later.\nNot affiliated with or endorsed by WhatsApp or Meta.',
            }) },
        ] },
    ]));
    if (tray && !tray.isDestroyed()) tray.setContextMenu(Menu.buildFromTemplate(trayMenuItems()));
}

// ── Tray ────────────────────────────────────────────────────────────
function createTray() {
    if (process.env.WHATSAPP_DISABLE_TRAY === '1') return;
    try {
        const trayIcon = nativeImage.createFromPath(ICON_PATH).resize({ width: 22, height: 22 });
        tray = new Tray(trayIcon);
        tray.setToolTip('WhatsApp');

        tray.setContextMenu(Menu.buildFromTemplate(trayMenuItems()));
        tray.on('click', () => toggleWindow());
    } catch (error) {
        try { tray?.destroy(); } catch { /* tray already unavailable */ }
        tray = null;
        console.warn('[tray] unavailable; keeping window accessible:', error?.message || error);
    }
}

function showWindow() {
    if (!mainWindow) { createWindow({ forceShow: true }); return; }
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
}

function toggleWindow() {
    if (!mainWindow) { createWindow({ forceShow: true }); return; }
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
    } else {
        showWindow();
    }
}

function updateBadge() {
    if (tray && !tray.isDestroyed()) {
        tray.setToolTip(unreadCount > 0 ? `WhatsApp · ${unreadCount} unread` : 'WhatsApp');
    }
    // Desktop badge support varies by desktop environment.
    try { app.setBadgeCount(unreadCount); } catch { /* not supported on this DE */ }
}

// ── Second instance ─────────────────────────────────────────────────
let pendingShow = false;
app.on('second-instance', () => {
    if (app.isReady()) showWindow();
    else pendingShow = true;
});

// ── Lifecycle ───────────────────────────────────────────────────────
app.whenReady().then(() => {
    setupClientHintsSpoofing();
    configurePermissions();
    createTray();
    createWindow({ forceShow: pendingShow });
    refreshMenus();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow({ forceShow: true });
        else showWindow();
    });
}).catch((error) => {
    console.error('[startup] failed:', error?.message || error);
    app.quit();
});

app.on('window-all-closed', () => {
    // Preserve background operation only when a usable tray exists.
    if (process.platform === 'darwin') return;
    if (!tray || tray.isDestroyed() || !store.get('minimizeToTray')) app.quit();
});

app.on('before-quit', () => {
    isQuitting = true;
    clearLoadRetry();
    flushPrefs();
});
