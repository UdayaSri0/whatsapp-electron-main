'use strict';

// Modified 2026-10-22 by the UdayaSri0 fork: secure Linux foundation.
// Original implementation by Dominik Lübben; GPL-2.0-or-later.

const {
    app,
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
const { validatedPrefs, writePreferences, restoredWindowBounds } = require('./preferences');
const { installPermissionHandlers } = require('./permissions');
const { browserIdentity, compatibilityEnabled, rewriteCompatibilityHeaders } = require('./compatibility');
const identity = compatibilityEnabled() ? browserIdentity(process.versions.chrome) : null;

// ── App identity ─────────────────────────────────────────────────────
// Setzt app.getName() / WM_CLASS / userData-Dirname. Muss zur
// StartupWMClass im .desktop passen, sonst hängt das Icon nicht am Fenster.
app.setName('WhatsApp');
app.enableSandbox();

// Electron >= 38 wählt Wayland automatisch. Zusätzliche Ozone-Feature-Flags
// würden inzwischen nur Chromiums native Erkennung überschreiben.
if (process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland') {
    // Chromium 150 unterstützt seinen Vulkan-Compositor noch nicht mit Ozone
    // Wayland. Ganesh/OpenGL und Video-Decoding bleiben hardwarebeschleunigt.
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
        installDesktopShortcut({
            appImagePath: process.env.APPIMAGE,
            homeDir: os.homedir(),
            iconPath: ICON_PATH,
        });
    } catch (error) {
        console.warn('[desktop-integration] failed:', error?.message || error);
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
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            spellcheck: true,
            // Calls leiden, wenn Chromium den Renderer im Hintergrund drosselt.
            backgroundThrottling: false,
            additionalArguments: identity?.additionalArguments || [],
        },
    });

    if (savedBounds.maximized) mainWindow.maximize();
    mainWindow.setMenuBarVisibility(false);

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

    // ── Bounds persistieren ─────────────────────────────────────
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

    // ── Schließen → Tray ─────────────────────────────────────────
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

    // ── Unread-Count aus dem Tab-Title ziehen ─────────────────────
    // WhatsApp Web setzt den Title z.B. auf "(3) WhatsApp" wenn neue
    // Nachrichten da sind. Daraus updaten wir Tray-Tooltip + Badge.
    mainWindow.webContents.on('page-title-updated', (_e, title) => {
        const m = /^\((\d+)\)/.exec(title);
        const next = m ? Math.min(Number(m[1]), 9999) : 0;
        if (next !== unreadCount) {
            unreadCount = next;
            updateBadge();
        }
    });

    // ── Externe Links → System-Browser ────────────────────────────
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

// ── Tray ────────────────────────────────────────────────────────────
function createTray() {
    if (process.env.WHATSAPP_DISABLE_TRAY === '1') return;
    try {
        const trayIcon = nativeImage.createFromPath(ICON_PATH).resize({ width: 22, height: 22 });
        tray = new Tray(trayIcon);
        tray.setToolTip('WhatsApp');

        const menu = Menu.buildFromTemplate([
            { label: 'Open', click: () => showWindow() },
            { type: 'separator' },
            {
                label: 'Minimize to tray on close',
                type: 'checkbox',
                checked: store.get('minimizeToTray'),
                click: (item) => store.set('minimizeToTray', item.checked),
            },
            {
                label: 'Start minimized (requires tray)',
                type: 'checkbox',
                checked: store.get('startMinimized'),
                click: (item) => store.set('startMinimized', item.checked),
            },
            { type: 'separator' },
            { label: 'Install AppImage desktop shortcut', visible: Boolean(process.env.APPIMAGE), click: ensureDesktopIntegration },
            { label: 'Reload', click: () => loadWhatsApp({ resetBackoff: true }) },
            { type: 'separator' },
            { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
        ]);
        tray.setContextMenu(menu);
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
    // Unity/KDE Badge an der Taskbar — auf GNOME ohne Extension wirkungslos,
    // schadet aber nichts.
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

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow({ forceShow: true });
        else showWindow();
    });
}).catch((error) => {
    console.error('[startup] failed:', error?.message || error);
    app.quit();
});

app.on('window-all-closed', () => {
    // Auf Linux/Windows in den Tray bleiben; auf macOS Standard-Verhalten.
    if (process.platform === 'darwin') return;
    if (!tray || tray.isDestroyed() || !store.get('minimizeToTray')) app.quit();
});

app.on('before-quit', () => {
    isQuitting = true;
    clearLoadRetry();
    flushPrefs();
});
