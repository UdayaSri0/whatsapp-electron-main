'use strict';

// Build a deliberately small support report. Never include paths, URLs, command
// line arguments, account details, environment dumps or renderer logs.
function version(value) {
    return typeof value === 'string' && /^\d+(?:\.\d+){0,3}(?:-[0-9A-Za-z.-]+)?$/.test(value) && value.length <= 64
        ? value : 'unknown';
}

function desktop(value) {
    const known = ['GNOME', 'KDE', 'XFCE', 'CINNAMON', 'MATE', 'LXQT', 'UNITY', 'SWAY', 'HYPRLAND'];
    const tokens = typeof value === 'string' ? value.toUpperCase().split(/[:;]/) : [];
    return known.filter(name => tokens.includes(name)).join(', ') || 'unknown';
}

function diagnosticText(details = {}) {
    return [
        'WhatsApp Electron — unofficial Linux client',
        `App: ${version(details.version)}`,
        `Electron: ${version(details.electron)}`,
        `Chromium: ${version(details.chrome)}`,
        `Embedded Node: ${version(details.node)}`,
        `Platform: ${['linux', 'darwin', 'win32'].includes(details.platform) ? details.platform : 'unknown'}`,
        `Architecture: ${['x64', 'arm64', 'arm', 'ia32'].includes(details.arch) ? details.arch : 'unknown'}`,
        `Session: ${['wayland', 'x11'].includes(details.sessionType) ? details.sessionType : 'unknown'}`,
        `Desktop: ${desktop(details.desktop)}`,
        `Browser identity: ${details.identityMode === 'native' ? 'native' : 'compatibility'}`,
        `Tray constructed: ${details.trayAvailable === true ? 'yes (visibility unverified)' : 'no'}`,
        `Microphone permission: ${details.microphoneEnabled === true ? 'enabled' : 'disabled'}`,
        `Camera permission: ${details.cameraEnabled === true ? 'enabled' : 'disabled'}`,
        'Screen sharing: blocked (runtime permission boundary)',
        'Account, physical devices and calls: not verified by this report',
    ].join('\n');
}

module.exports = { diagnosticText };
