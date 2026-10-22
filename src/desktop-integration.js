'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { desktopExecArgument } = require('./security');

function existingBytes(filename) {
    try { return fs.readFileSync(filename); }
    catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}

// Only invoked by the user's tray action. Never replace an existing file,
// including an empty launcher, a customized icon, or a concurrent installation.
function installDesktopShortcut({ appImagePath, homeDir, iconPath }) {
    const executable = desktopExecArgument(appImagePath);
    if (!executable || !path.isAbsolute(appImagePath)) throw new Error('Invalid AppImage path');
    const desktopFile = path.join(homeDir, '.local/share/applications/whatsapp-desktop.desktop');
    const iconFile = path.join(homeDir, '.local/share/icons/hicolor/512x512/apps/whatsapp-desktop.png');
    const desktop = Buffer.from([
        '[Desktop Entry]',
        'Name=WhatsApp (unofficial)',
        'Comment=WhatsApp Web Desktop',
        // GIO checks the executable before expanding %% field escapes. With a
        // literal percent in the path, use env as the executable and pass the
        // absolute AppImage path as an argument. No shell is involved.
        `Exec=${appImagePath.includes('%') ? '/usr/bin/env -- ' : ''}${executable} %U`,
        'Icon=whatsapp-desktop',
        'Terminal=false',
        'Type=Application',
        'Categories=Network;InstantMessaging;',
        'StartupWMClass=WhatsApp',
        '',
    ].join('\n'));
    const icon = fs.readFileSync(iconPath);
    const files = [[desktopFile, desktop], [iconFile, icon]].map(([filename, contents]) => {
        const existing = existingBytes(filename);
        if (existing !== null && !existing.equals(contents)) {
            throw new Error(`Existing desktop integration file preserved: ${filename}`);
        }
        return { filename, contents, exists: existing !== null };
    });
    const created = [];
    try {
        for (const file of files) {
            if (file.exists) continue;
            fs.mkdirSync(path.dirname(file.filename), { recursive: true });
            fs.writeFileSync(file.filename, file.contents, { mode: 0o644, flag: 'wx' });
            created.push(file.filename);
        }
    } catch (error) {
        for (const filename of created.reverse()) {
            try { fs.unlinkSync(filename); }
            catch (cleanupError) { if (cleanupError.code !== 'ENOENT') error.cause ??= cleanupError; }
        }
        throw error;
    }
    return { desktopFile, iconFile };
}

module.exports = { installDesktopShortcut };
