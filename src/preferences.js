'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const DEFAULT_WINDOW = { width: 1280, height: 860, maximized: false };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
const coordinate = value => Number.isSafeInteger(value) && Math.abs(value) <= 100000 ? value : undefined;
const dimension = (value, fallback) => Number.isSafeInteger(value) && value >= 600 && value <= 16384 ? value : fallback;

function validatedPrefs(value) {
    const loaded = record(value);
    const window = record(loaded.window);
    return {
        window: {
            width: dimension(window.width, DEFAULT_WINDOW.width),
            height: dimension(window.height, DEFAULT_WINDOW.height),
            x: coordinate(window.x),
            y: coordinate(window.y),
            maximized: typeof window.maximized === 'boolean' ? window.maximized : false,
        },
        // Existing explicit preferences survive. New profiles stay visible on desktops
        // where a successful Tray constructor does not mean a visible tray provider.
        minimizeToTray: typeof loaded.minimizeToTray === 'boolean' ? loaded.minimizeToTray : false,
        startMinimized: typeof loaded.startMinimized === 'boolean' ? loaded.startMinimized : false,
        microphoneEnabled: typeof loaded.microphoneEnabled === 'boolean' ? loaded.microphoneEnabled : true,
        cameraEnabled: typeof loaded.cameraEnabled === 'boolean' ? loaded.cameraEnabled : true,
    };
}

function writePreferences(filename, value) {
    const temporary = `${filename}.${process.pid}.${randomUUID()}.tmp`;
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    try {
        fs.writeFileSync(temporary, JSON.stringify(validatedPrefs(value), null, 2), { flag: 'wx', mode: 0o600 });
        fs.renameSync(temporary, filename);
    } finally {
        try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
}

function restoredWindowBounds(saved, displays, primaryDisplay) {
    saved = validatedPrefs({ window: saved }).window;
    const positioned = saved.x !== undefined && saved.y !== undefined;
    const requested = { ...saved, x: saved.x ?? 0, y: saved.y ?? 0 };
    const visibleArea = area => Math.max(0, Math.min(requested.x + saved.width, area.x + area.width) - Math.max(requested.x, area.x))
        * Math.max(0, Math.min(requested.y + saved.height, area.y + area.height) - Math.max(requested.y, area.y));
    const best = displays.reduce((match, display) => visibleArea(display.workArea) > visibleArea(match.workArea) ? display : match, primaryDisplay);
    const visible = positioned && visibleArea(best.workArea) >= 64 * 64;
    const area = (visible ? best : primaryDisplay).workArea;
    const width = Math.min(saved.width, area.width);
    const height = Math.min(saved.height, area.height);
    if (!visible) return { width, height };
    return {
        width, height,
        x: Math.min(Math.max(saved.x, area.x), area.x + area.width - width),
        y: Math.min(Math.max(saved.y, area.y), area.y + area.height - height),
    };
}

module.exports = { validatedPrefs, writePreferences, restoredWindowBounds };
