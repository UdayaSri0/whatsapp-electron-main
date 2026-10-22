'use strict';

// Modified 2026-10-22 by the UdayaSri0 fork: secure Linux foundation.
// Original implementation by Dominik Lübben; GPL-2.0-or-later.

// Optional inherited compatibility patch; no privileged APIs are exposed.
// The sandboxed preload deliberately does not require local modules.

const { contextBridge } = require('electron');

function readArg(name, fallback) {
    const prefix = `--${name}=`;
    const found = process.argv.find(argument => argument.startsWith(prefix));
    return found ? found.slice(prefix.length) : fallback;
}

const chromeMajor = readArg('kcw-chrome-major', '');
const chromeFull = readArg('kcw-chrome-full', '');
const shouldPatch = process.isMainFrame === true
    && globalThis.location.origin === 'https://web.whatsapp.com'
    && readArg('kcw-browser-identity', 'native') === 'compatibility'
    && /^\d+$/.test(chromeMajor)
    && /^\d+\.\d+\.\d+\.\d+$/.test(chromeFull)
    && chromeFull.split('.')[0] === chromeMajor;

if (shouldPatch) try {
    contextBridge.executeInMainWorld({
        func: (major, full) => {
            if (window !== window.top || location.origin !== 'https://web.whatsapp.com') return;
            const lowEntropyBrands = [
                { brand: 'Chromium', version: major },
                { brand: 'Not_A Brand', version: '24' },
                { brand: 'Google Chrome', version: major },
            ];
            const fullVersionList = [
                { brand: 'Chromium', version: full },
                { brand: 'Not_A Brand', version: '24.0.0.0' },
                { brand: 'Google Chrome', version: full },
            ];

            const sanitizeHighEntropy = result => {
                const sanitized = { ...result };
                if ('brands' in sanitized) sanitized.brands = lowEntropyBrands;
                if ('fullVersionList' in sanitized) sanitized.fullVersionList = fullVersionList;
                if ('uaFullVersion' in sanitized) sanitized.uaFullVersion = full;
                return sanitized;
            };

            const patchPrototype = () => {
                let prototype;
                try {
                    prototype = Object.getPrototypeOf(navigator.userAgentData);
                } catch {
                    return false;
                }
                if (!prototype) return false;

                try {
                    Object.defineProperties(prototype, {
                        brands: {
                            configurable: true,
                            enumerable: true,
                            get: () => lowEntropyBrands,
                        },
                        mobile: {
                            configurable: true,
                            enumerable: true,
                            get: () => false,
                        },
                        platform: {
                            configurable: true,
                            enumerable: true,
                            get: () => 'Linux',
                        },
                    });

                    const originalGetHighEntropyValues = prototype.getHighEntropyValues;
                    if (typeof originalGetHighEntropyValues === 'function') {
                        Object.defineProperty(prototype, 'getHighEntropyValues', {
                            configurable: true,
                            writable: true,
                            value(hints) {
                                return originalGetHighEntropyValues.call(this, hints)
                                    .then(sanitizeHighEntropy);
                            },
                        });
                    }
                    Object.defineProperty(prototype, 'toJSON', {
                        configurable: true,
                        writable: true,
                        value: () => ({ brands: lowEntropyBrands, mobile: false, platform: 'Linux' }),
                    });
                    return true;
                } catch {
                    return false;
                }
            };

            const patchInstance = () => {
                try {
                    const original = navigator.userAgentData;
                    if (!original) return false;
                    const replacement = {
                        brands: lowEntropyBrands,
                        mobile: false,
                        platform: 'Linux',
                        toJSON: () => ({ brands: lowEntropyBrands, mobile: false, platform: 'Linux' }),
                        getHighEntropyValues: hints => original.getHighEntropyValues(hints)
                            .then(sanitizeHighEntropy),
                    };
                    Object.defineProperty(navigator, 'userAgentData', {
                        configurable: true,
                        enumerable: true,
                        get: () => replacement,
                    });
                    return true;
                } catch {
                    return false;
                }
            };

            if (!patchPrototype() && !patchInstance()) {
                console.warn('[whatsapp-desktop] userAgentData patch failed');
            }
        },
        args: [chromeMajor, chromeFull],
    });
} catch (error) {
    console.warn('[whatsapp-desktop] preload patch failed:', error);
}
