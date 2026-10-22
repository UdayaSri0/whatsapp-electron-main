'use strict';

// Keep the inherited workaround until native Chromium identity passes the
// documented account/device matrix. Never change the application/session UA.
function compatibilityEnabled(environment = process.env) {
    return environment.WHATSAPP_BROWSER_IDENTITY !== 'native';
}

function isCompatibilityUrl(rawUrl) {
    try {
        const url = new URL(rawUrl);
        return ['https:', 'wss:'].includes(url.protocol)
            && !url.username && !url.password && !url.port
            && ['whatsapp.com', 'whatsapp.net'].some(domain =>
                url.hostname === domain || url.hostname.endsWith(`.${domain}`));
    } catch {
        return false;
    }
}

function browserIdentity(chromeVersion) {
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(chromeVersion)) {
        throw new TypeError('A valid Chromium version is required');
    }
    const major = chromeVersion.split('.')[0];
    return {
        chromeVersion,
        userAgent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
        brands: `"Chromium";v="${major}", "Not_A Brand";v="24", "Google Chrome";v="${major}"`,
        fullVersionList: `"Chromium";v="${chromeVersion}", "Not_A Brand";v="24.0.0.0", "Google Chrome";v="${chromeVersion}"`,
        additionalArguments: [
            '--kcw-browser-identity=compatibility',
            `--kcw-chrome-major=${major}`,
            `--kcw-chrome-full=${chromeVersion}`,
        ],
    };
}

function rewriteCompatibilityHeaders(details, identity, ownerId) {
    const headers = { ...details.requestHeaders };
    if (!identity || !Number.isInteger(ownerId) || details.webContentsId !== ownerId
        || !isCompatibilityUrl(details.url)) return headers;

    for (const key of Object.keys(headers)) {
        switch (key.toLowerCase()) {
            case 'user-agent': headers[key] = identity.userAgent; break;
            case 'sec-ch-ua': headers[key] = identity.brands; break;
            case 'sec-ch-ua-full-version-list': headers[key] = identity.fullVersionList; break;
            case 'sec-ch-ua-full-version': headers[key] = `"${identity.chromeVersion}"`; break;
            default: break;
        }
    }
    return headers;
}

module.exports = { browserIdentity, compatibilityEnabled, isCompatibilityUrl, rewriteCompatibilityHeaders };
