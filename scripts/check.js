'use strict';

// Syntax validation without executing Electron or loading a user profile.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function checkDirectory(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) checkDirectory(filename);
        else if (entry.name.endsWith('.js')) execFileSync(process.execPath, ['--check', filename], { stdio: 'inherit' });
    }
}

for (const directory of ['src', 'scripts', 'test']) checkDirectory(directory);
for (const file of ['arch-pkg/PKGBUILD', 'arch-pkg/whatsapp.sh']) {
    execFileSync('bash', ['-n', file], { stdio: 'inherit' });
}
console.log('JavaScript and packaging shell syntax checks passed.');
