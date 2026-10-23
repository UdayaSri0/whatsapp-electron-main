'use strict';

// Modified 2026-10-22 by the UdayaSri0 fork: secure Linux foundation.
// Original implementation by Dominik Lübben; GPL-2.0-or-later.

const APP_ORIGIN = 'https://web.whatsapp.com';

function parseHttpsUrl(rawUrl) {
    try {
        const url = new URL(rawUrl);
        return url.protocol === 'https:' ? url : null;
    } catch {
        return null;
    }
}

function isAllowedNavigation(rawUrl) {
    const url = parseHttpsUrl(rawUrl);
    return Boolean(url && url.origin === APP_ORIGIN && !url.username && !url.password);
}

function externalUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || /[\u0000-\u001f\u007f]/.test(rawUrl)) return null;
    try {
        const url = new URL(rawUrl);
        if (url.username || url.password) return null;
        if ((url.protocol === 'https:' || url.protocol === 'http:') && url.hostname) return url.toString();
        if (url.protocol === 'mailto:' && url.pathname && !/%0[ad]/i.test(rawUrl)) return url.toString();
        if (url.protocol === 'tel:' && /^\+?[0-9(). -]+$/.test(url.pathname)) return url.toString();
    } catch {
        // Invalid or unsafe URL.
    }
    return null;
}

function desktopExecArgument(value) {
    if (typeof value !== 'string' || value.length === 0 || /[=\u0000-\u001f\u007f]/.test(value)) return null;
    // Desktop entries decode string escapes before decoding Exec argument
    // quoting. Escape those two layers separately (a literal backslash needs
    // four in the file). This is not shell escaping.
    const argument = value.replace(/%/g, '%%').replace(/[\\`"$]/g, character => `\\${character}`);
    return `"${argument.replace(/\\/g, '\\\\')}"`;
}

module.exports = {
    APP_ORIGIN,
    desktopExecArgument,
    externalUrl,
    isAllowedNavigation,
};
