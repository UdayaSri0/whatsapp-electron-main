'use strict';

// Modified 2026-10-22 by the UdayaSri0 fork: secure Linux foundation.
// Original implementation by Dominik Lübben; GPL-2.0-or-later.

const [major, minor] = process.versions.node.split('.').map(Number);
const supported = (major === 22 && minor >= 12) || major === 24;

if (!supported) {
    console.error(`Node.js ${process.versions.node} is not supported for this build.`);
    console.error('Please use Node.js 24 (see .nvmrc).');
    process.exit(1);
}
