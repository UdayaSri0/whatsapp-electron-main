'use strict';

const fs = require('node:fs');
const { variants, buildConfig, userDataPath } = require('../config/variants');

const personal = variants.personal;
const business = variants.business;
const unique = field => new Set([personal[field], business[field]]).size === 2;
for (const field of ['appId', 'packageName', 'executableName', 'profileDirectory', 'desktopFile', 'autostartFile', 'launcherName', 'wmClass', 'diagnosticsIdentifier']) {
    if (!unique(field)) throw new Error(`Application variants share ${field}`);
}
if (personal.appId !== require('../package.json').build.appId || personal.profileDirectory !== 'WhatsApp') {
    throw new Error('Personal application identity changed');
}
if (userDataPath('/tmp/codex-config', personal) === userDataPath('/tmp/codex-config', business)) {
    throw new Error('Application profile paths collide');
}
if (!fs.readFileSync(business.iconPath).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error('Business icon must be a PNG');
}
for (const name of ['personal', 'business']) {
    const config = buildConfig(name);
    if (config.extraMetadata.whatsappVariant !== name || config.deb.packageName !== variants[name].packageName || config.rpm.packageName !== variants[name].packageName) {
        throw new Error(`Invalid packaged identity for ${name}`);
    }
}
console.log('Personal and Business build identities are isolated.');
