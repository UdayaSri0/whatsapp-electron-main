'use strict';

const path = require('node:path');

const variants = Object.freeze({
    personal: Object.freeze({
        name: 'personal', productName: 'WhatsApp', description: 'Unofficial WhatsApp Web desktop wrapper for Linux',
        packageSynopsis: 'WhatsApp Web Desktop', packageDescription: 'Unofficial WhatsApp Web desktop wrapper with tray integration and native notifications.', desktopComment: 'Unofficial WhatsApp Web desktop wrapper',
        packageName: 'whatsapp-electron', appId: 'com.dluebben.whatsapp-desktop', executableName: 'whatsapp',
        windowTitle: 'WhatsApp', wmClass: 'WhatsApp', desktopName: 'whatsapp', profileDirectory: 'WhatsApp', trayName: 'WhatsApp',
        desktopFile: 'whatsapp.desktop', launcherName: 'whatsapp-desktop', launcherLabel: 'WhatsApp (unofficial)', launcherComment: 'WhatsApp Web Desktop',
        autostartFile: 'whatsapp-electron.desktop', iconFile: 'src/icon.png', iconPath: path.join(__dirname, '../src/icon.png'),
        diagnosticsIdentifier: 'whatsapp-personal',
        artifactNames: { appImage: 'WhatsApp-${version}-x86_64.AppImage', deb: 'whatsapp-electron-${version}-amd64.deb', rpm: 'whatsapp-electron-${version}-x86_64.rpm' },
    }),
    business: Object.freeze({
        name: 'business', productName: 'Business Chat for WhatsApp (Unofficial)',
        description: 'Unofficial desktop wrapper for WhatsApp Business linked devices',
        packageName: 'business-chat-for-whatsapp-unofficial', appId: 'com.udayasri0.business-chat-whatsapp-unofficial',
        executableName: 'whatsapp-business-unofficial', windowTitle: 'Business Chat for WhatsApp (Unofficial)', desktopName: 'com.udayasri0.business-chat-whatsapp-unofficial', wmClass: 'com.udayasri0.business-chat-whatsapp-unofficial',
        profileDirectory: 'WhatsApp-Business-Unofficial', trayName: 'Business Chat for WhatsApp (Unofficial)',
        desktopFile: 'com.udayasri0.business-chat-whatsapp-unofficial.desktop', launcherName: 'com.udayasri0.business-chat-whatsapp-unofficial',
        autostartFile: 'whatsapp-business-unofficial.desktop', iconFile: 'build/business/icon.png', iconPath: path.join(__dirname, '../build/business/icon.png'),
        diagnosticsIdentifier: 'whatsapp-business-unofficial',
        artifactNames: { appImage: 'Business-Chat-for-WhatsApp-${version}-x86_64.AppImage', deb: 'business-chat-for-whatsapp-unofficial-${version}-amd64.deb', rpm: 'business-chat-for-whatsapp-unofficial-${version}-x86_64.rpm' },
    }),
});

function resolveVariant({ packaged, packagedVariant, requested } = {}) {
    const name = packaged ? packagedVariant : (requested || 'personal');
    if (packaged && !name) throw new Error('Missing packaged variant identity');
    if (!Object.hasOwn(variants, name)) throw new Error(`Unknown application variant: ${name}`);
    return variants[name];
}

function userDataPath(appDataPath, variant) {
    if (typeof appDataPath !== 'string' || !path.isAbsolute(appDataPath)) throw new TypeError('Electron appData path must be absolute');
    return path.join(appDataPath, variant.profileDirectory);
}

function buildConfig(variantName, baseBuild = require('../package.json').build) {
    const variant = variants[variantName];
    if (!variant) throw new Error(`Unknown application variant: ${variantName}`);
    const linux = baseBuild.linux;
    return {
        ...baseBuild,
        appId: variant.appId,
        productName: variant.productName,
        extraMetadata: { name: variant.packageName, productName: variant.productName, description: variant.description, desktopName: variant.desktopName, whatsappVariant: variant.name },
        directories: { ...baseBuild.directories, buildResources: variant.name === 'personal' ? 'build' : 'build/business' },
        linux: {
            ...linux,
            executableName: variant.executableName,
            ...(variant.name === 'business' ? { syncDesktopName: true } : {}),
            icon: variant.iconPath,
            synopsis: variant.packageSynopsis || variant.description,
            description: variant.packageDescription || variant.description,
            desktop: { ...linux.desktop, entry: { Name: variant.name === 'personal' ? 'WhatsApp (unofficial)' : variant.productName, Comment: variant.desktopComment || variant.description, StartupWMClass: variant.wmClass } },
        },
        appImage: { ...baseBuild.appImage, artifactName: variant.artifactNames.appImage },
        deb: { ...baseBuild.deb, artifactName: variant.artifactNames.deb, packageName: variant.packageName },
        rpm: { ...baseBuild.rpm, artifactName: variant.artifactNames.rpm, packageName: variant.packageName },
    };
}

module.exports = { variants, resolveVariant, userDataPath, buildConfig };
