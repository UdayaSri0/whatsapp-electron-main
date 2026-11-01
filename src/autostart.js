'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { desktopExecArgument } = require('./security');

const HEADER = '[Desktop Entry]\nType=Application\nName=WhatsApp (unofficial)\nComment=Start WhatsApp desktop\nTerminal=false\nX-WhatsApp-Electron-Managed=1\n';

function location({ homeDir, configDir, variant = {} }) {
    const directory = configDir || (typeof homeDir === 'string' && path.join(homeDir, '.config'));
    if (!directory || !path.isAbsolute(directory) || /[\u0000-\u001f\u007f]/.test(directory)) {
        throw new Error('Invalid autostart configuration directory');
    }
    return path.join(directory, 'autostart', variant.autostartFile || 'whatsapp-electron.desktop');
}

function header(variant) {
    return variant && variant.name !== 'personal'
        ? `[Desktop Entry]\nType=Application\nName=${variant.productName}\nComment=Start ${variant.productName}\nTerminal=false\nX-WhatsApp-Electron-Managed=1\n`
        : HEADER;
}

function content(options) {
    const executable = options.appImagePath || options.executablePath;
    const argument = desktopExecArgument(executable);
    if (!argument || !path.isAbsolute(executable)) throw new Error('Invalid autostart executable path');
    const command = `Exec=${executable.includes('%') ? '/usr/bin/env -- ' : ''}${argument}\n`;
    const digest = crypto.createHash('sha256').update(command).digest('hex');
    const entryHeader = header(options.variant);
    return `${entryHeader}${command}X-WhatsApp-Electron-Checksum=${digest}\n`;
}

function inspect(filename, variant) {
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Existing autostart entry preserved: not a regular file');
    const descriptor = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
        const opened = fs.fstatSync(descriptor);
        if (opened.ino !== stat.ino || opened.dev !== stat.dev || opened.size > 65536) {
            throw new Error('Existing autostart entry changed or is too large');
        }
        const bytes = fs.readFileSync(descriptor, 'utf8');
        const entryHeader = header(variant);
        const suffix = bytes.startsWith(entryHeader) ? bytes.slice(entryHeader.length) : '';
        const match = /^(Exec=[^\r\n]+\n)X-WhatsApp-Electron-Checksum=([a-f0-9]{64})\n$/.exec(suffix);
        if (!match || crypto.createHash('sha256').update(match[1]).digest('hex') !== match[2]) {
            throw new Error('Existing or modified autostart entry preserved');
        }
        return { bytes, stat: opened };
    } finally { fs.closeSync(descriptor); }
}

function unchanged(filename, entry, variant) {
    const current = fs.lstatSync(filename);
    if (current.ino !== entry.stat.ino || current.dev !== entry.stat.dev || !current.isFile() ||
        inspect(filename, variant).bytes !== entry.bytes) throw new Error('Autostart entry changed concurrently');
}

function getAutostartStatus(options) {
    const filename = location(options);
    return { enabled: Boolean(inspect(filename, options.variant)), filename };
}

// Called only after an explicit user action. The checksum detects edited entries;
// it is not an authentication boundary against another process owned by the user.
function setAutostart(options) {
    if (typeof options.enabled !== 'boolean') throw new Error('Autostart enabled must be a boolean');
    const filename = location(options);
    const desired = options.enabled ? content(options) : null;
    if (!options.enabled && !inspect(filename, options.variant)) return { enabled: false, filename };
    fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    const lock = `${filename}.lock`;
    const descriptor = fs.openSync(lock, 'wx', 0o600);
    let temporary;
    try {
        const existing = inspect(filename, options.variant);
        if (!options.enabled) {
            if (existing) { unchanged(filename, existing, options.variant); fs.unlinkSync(filename); }
        } else if (existing?.bytes !== desired) {
            temporary = `${filename}.${crypto.randomBytes(12).toString('hex')}.tmp`;
            fs.writeFileSync(temporary, desired, { flag: 'wx', mode: 0o600 });
            if (existing) {
                unchanged(filename, existing, options.variant);
                fs.renameSync(temporary, filename);
            } else {
                // Unlike rename, link refuses to overwrite a concurrent entry.
                fs.linkSync(temporary, filename);
            }
        }
        return { enabled: options.enabled, filename };
    } finally {
        if (temporary) { try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
        fs.closeSync(descriptor);
        fs.unlinkSync(lock);
    }
}

module.exports = { getAutostartStatus, setAutostart };
