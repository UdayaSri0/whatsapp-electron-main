'use strict';

const { isAllowedNavigation } = require('./security');

const BASIC_PERMISSIONS = new Set(['clipboard-sanitized-write', 'fullscreen', 'notifications']);
const MEDIA_TYPES = new Set(['audio', 'video']);

function trustedDetails(details, requestingOrigin) {
    if (!details || details.isMainFrame !== true) return false;
    const origins = [requestingOrigin, details.securityOrigin, details.requestingUrl, details.embeddingOrigin]
        .filter(value => value !== undefined && value !== null && value !== '');
    return origins.length > 0 && origins.every(isAllowedNavigation);
}

function deviceMedia(types) {
    return Array.isArray(types) && types.length > 0 && types.every(type => MEDIA_TYPES.has(type));
}

// Dependencies are injected so ownership and asynchronous cancellation can be
// tested without loading Electron or accessing a real desktop.
function installPermissionHandlers({ session, getWindow, desktopCapturer, dialog, logger = console, getMediaPreferences = () => ({ microphoneEnabled: true, cameraEnabled: true }) }) {
    let selecting = false;

    function permittedDevices(types) {
        if (!deviceMedia(types)) return false;
        try {
            const preferences = getMediaPreferences();
            return types.every(type => type === 'audio'
                ? preferences?.microphoneEnabled === true : preferences?.cameraEnabled === true);
        } catch {
            return false;
        }
    }

    function owningWindow(contents) {
        try {
            const window = getWindow();
            return window && !window.isDestroyed() && contents && !contents.isDestroyed()
                && contents === window.webContents && isAllowedNavigation(contents.getURL())
                ? window : null;
        } catch {
            return null;
        }
    }

    function snapshot(contents, invalidate) {
        const window = owningWindow(contents);
        if (!window) return null;
        let frame;
        let url;
        try {
            frame = contents.mainFrame;
            url = frame.url;
            if (!isAllowedNavigation(url)) return null;
        } catch {
            return null;
        }
        let invalid = false;
        const cancel = () => { invalid = true; invalidate(); };
        const navigation = (event, _url, inPlace, isMainFrame) => {
            const mainFrame = event.isMainFrame ?? isMainFrame;
            const sameDocument = event.isSameDocument ?? inPlace;
            if (mainFrame !== false && !sameDocument) cancel();
        };
        contents.on('did-start-navigation', navigation);
        contents.on('render-process-gone', cancel);
        contents.on('destroyed', cancel);
        return {
            window,
            frame,
            valid() {
                try {
                    return !invalid && owningWindow(contents) === window
                        && contents.mainFrame === frame && frame.url === url;
                } catch {
                    return false;
                }
            },
            dispose() {
                contents.removeListener('did-start-navigation', navigation);
                contents.removeListener('render-process-gone', cancel);
                contents.removeListener('destroyed', cancel);
            },
        };
    }

    // Electron callbacks must never be called twice, including when a destroyed
    // requesting frame causes the callback itself to throw.
    function once(callback) {
        let completed = false;
        return value => {
            if (completed) return;
            completed = true;
            try { callback(value); } catch (error) {
                logger.warn('[permissions] request ended:', error?.message || error);
            }
        };
    }

    session.setPermissionRequestHandler((contents, permission, callback, details = {}) => {
        const reply = once(callback);
        if (!owningWindow(contents) || !trustedDetails(details)) return reply(false);
        if (BASIC_PERMISSIONS.has(permission)) return reply(true);
        if (permission === 'media' && permittedDevices(details.mediaTypes)) return reply(true);
        // Electron 43 also labels legacy desktop capture as mediaTypes: [].
        // That path bypasses setDisplayMediaRequestHandler entirely. Deny it
        // rather than granting a screen without a frame-bound source selection.
        reply(false);
    });

    session.setPermissionCheckHandler((contents, permission, requestingOrigin, details = {}) => {
        if (!owningWindow(contents) || !trustedDetails(details, requestingOrigin)) return false;
        if (BASIC_PERMISSIONS.has(permission)) return true;
        // Unknown and display capture permissions are never pre-granted. The
        // pinned runtime cannot separate legacy capture from a device request.
        return permission === 'media' && permittedDevices([details.mediaType]);
    });

    session.setDisplayMediaRequestHandler(async (request, callback) => {
        const reply = once(callback);
        let owner;
        let acquired = false;
        try {
            const contents = getWindow()?.webContents;
            if (selecting || request.userGesture !== true || request.videoRequested !== true
                || !isAllowedNavigation(request.securityOrigin) || !owningWindow(contents)
                || !request.frame || request.frame !== contents.mainFrame
                || request.frame.top !== request.frame || !isAllowedNavigation(request.frame.url)) {
                return reply(null);
            }
            owner = snapshot(contents, () => reply(null));
            if (!owner) return reply(null);
            selecting = true;
            acquired = true;
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 0, height: 0 },
            });
            if (!owner.valid() || request.frame !== owner.frame || !sources.length) return reply(null);
            const labels = sources.map((source, index) => source.name || `Screen or window ${index + 1}`);
            const cancelId = labels.length;
            const result = await dialog.showMessageBox(owner.window, {
                type: 'question',
                title: 'Share a screen or window',
                message: 'Choose what to share with WhatsApp Web.',
                detail: 'Screen contents may include private information. You can stop sharing in the call.',
                buttons: [...labels, 'Cancel'],
                defaultId: cancelId,
                cancelId,
                noLink: true,
            });
            const index = result.response;
            const source = Number.isInteger(index) && index >= 0 && index < sources.length ? sources[index] : null;
            reply(owner.valid() && request.frame === owner.frame && source ? { video: source } : null);
        } catch (error) {
            logger.warn('[screen-share] selection failed:', error?.message || error);
            reply(null);
        } finally {
            owner?.dispose();
            if (acquired) selecting = false;
        }
    });
}

module.exports = { deviceMedia, installPermissionHandlers, trustedDetails };
