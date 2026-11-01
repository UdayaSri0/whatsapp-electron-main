'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { variants, resolveVariant, userDataPath, buildConfig } = require('../config/variants');
const pkg = require('../package.json');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

test('personal identity preserves the installed application and profile names', () => {
    const personal = variants.personal;
    assert.equal(personal.appId, pkg.build.appId);
    assert.equal(personal.executableName, pkg.build.linux.executableName);
    assert.equal(personal.profileDirectory, 'WhatsApp');
    assert.equal(userDataPath('/home/test/.config', personal), '/home/test/.config/WhatsApp');
});

test('business identity and user data are independent from personal', () => {
    const business = variants.business;
    assert.notEqual(business.appId, variants.personal.appId);
    assert.notEqual(business.executableName, variants.personal.executableName);
    assert.notEqual(business.desktopFile, variants.personal.desktopFile);
    assert.notEqual(userDataPath('/home/test/.config', business), userDataPath('/home/test/.config', variants.personal));
    assert.equal(userDataPath('/custom/config', business), path.join('/custom/config', business.profileDirectory));
});

test('packaged builds ignore environment variant selection and require baked identity', () => {
    assert.equal(resolveVariant({ packaged: true, packagedVariant: 'personal', requested: 'business' }).name, 'personal');
    assert.equal(resolveVariant({ packaged: true, packagedVariant: 'business', requested: 'personal' }).name, 'business');
    assert.throws(() => resolveVariant({ packaged: true, requested: 'business' }), /packaged variant/);
    assert.throws(() => resolveVariant({ packaged: true, packagedVariant: 'other' }), /Unknown application variant/);
});

test('runtime identity loads when electron-builder removes build metadata from package.json', () => {
    const module = { exports: {} };
    const load = vm.runInNewContext(`(function(require, module, exports) {${fs.readFileSync('config/variants.js', 'utf8')}\n})`, { __dirname: path.resolve('config') });
    load(name => {
        if (name === 'node:path') return path;
        throw new Error(`Unexpected runtime dependency: ${name}`);
    }, module, module.exports);
    assert.equal(module.exports.resolveVariant({ packaged: true, packagedVariant: 'business' }).appId,
        'com.udayasri0.business-chat-whatsapp-unofficial');
});

test('only development runs accept an explicit variant request', () => {
    assert.equal(resolveVariant({ packaged: false, requested: 'business' }).name, 'business');
    assert.equal(resolveVariant({ packaged: false }).name, 'personal');
    assert.throws(() => resolveVariant({ packaged: false, requested: 'other' }), /Unknown application variant/);
});

test('Linux build metadata separates both package managers and desktop identities', () => {
    const personal = buildConfig('personal');
    const business = buildConfig('business');
    assert.equal(personal.extraMetadata.whatsappVariant, 'personal');
    assert.equal(business.extraMetadata.whatsappVariant, 'business');
    assert.equal(personal.deb.packageName, 'whatsapp-electron');
    assert.equal(business.deb.packageName, variants.business.packageName);
    assert.notEqual(personal.linux.executableName, business.linux.executableName);
    assert.notEqual(personal.linux.desktop.entry.StartupWMClass, business.linux.desktop.entry.StartupWMClass);
    assert.equal(personal.deb.artifactName, variants.personal.artifactNames.deb);
    assert.equal(business.deb.artifactName, variants.business.artifactNames.deb);
    assert.equal(personal.appImage.artifactName, variants.personal.artifactNames.appImage);
    assert.equal(business.appImage.artifactName, variants.business.artifactNames.appImage);
});
