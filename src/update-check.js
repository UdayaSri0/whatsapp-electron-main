'use strict';

const OWNER = 'UdayaSri0';
const REPOSITORY = 'whatsapp-electron-main';
const RELEASES_API = `https://api.github.com/repos/${OWNER}/${REPOSITORY}/releases?per_page=100`;
const RELEASE_PAGE = `https://github.com/${OWNER}/${REPOSITORY}/releases/tag/`;
// shortcut: inspect one API page of 100 releases; paginate if this repository grows beyond that history.
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parseVersion(value) {
    const match = typeof value === 'string' && value.match(versionPattern);
    if (!match) throw new TypeError(`Invalid semantic version: ${value}`);
    return { core: match.slice(1, 4).map(BigInt), prerelease: match[4]?.split('.') || null };
}

function compareVersions(left, right) {
    const a = parseVersion(left);
    const b = parseVersion(right);
    for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i] ? 1 : -1;
    if (!a.prerelease || !b.prerelease) return a.prerelease === b.prerelease ? 0 : a.prerelease ? -1 : 1;
    const count = Math.max(a.prerelease.length, b.prerelease.length);
    for (let i = 0; i < count; i++) {
        if (a.prerelease[i] === undefined || b.prerelease[i] === undefined) return a.prerelease[i] === b.prerelease[i] ? 0 : a.prerelease[i] === undefined ? -1 : 1;
        const an = /^\d+$/.test(a.prerelease[i]);
        const bn = /^\d+$/.test(b.prerelease[i]);
        if (an && bn) {
            const av = BigInt(a.prerelease[i]);
            const bv = BigInt(b.prerelease[i]);
            if (av !== bv) return av > bv ? 1 : -1;
        } else if (an !== bn) return an ? -1 : 1;
        else if (a.prerelease[i] !== b.prerelease[i]) return a.prerelease[i] > b.prerelease[i] ? 1 : -1;
    }
    return 0;
}

function releaseVersion(release) {
    if (typeof release?.tag_name !== 'string') return null;
    const value = release.tag_name.startsWith('v') ? release.tag_name.slice(1) : release.tag_name;
    try { parseVersion(value); return value; } catch { return null; }
}

function hasMatchingAsset(release, variant) {
    const version = releaseVersion(release);
    if (!version || !Array.isArray(release.assets) || !variant?.artifactNames) return false;
    return ['appImage', 'deb', 'rpm'].some(target => {
        const template = variant.artifactNames[target];
        return typeof template === 'string' && release.assets.some(asset => asset?.name === template.replace('${version}', version));
    });
}

async function checkForUpdate({ currentVersion, variant, fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
    if (variant?.name === 'business') return { status: 'restricted' };
    try {
        parseVersion(currentVersion);
        if (variant?.name !== 'personal' || typeof fetchImpl !== 'function') return { status: 'unavailable' };
        const response = await fetchImpl(RELEASES_API, {
            headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'WhatsApp-Electron-update-check' },
            redirect: 'error', signal: AbortSignal.timeout(Math.min(30000, Math.max(1, timeoutMs))),
        });
        if (response.status === 404) return { status: 'none' };
        if (response.status === 429 || (response.status === 403 && (response.headers?.get('x-ratelimit-remaining') === '0' || response.headers?.get('retry-after')))) return { status: 'rate-limited' };
        if (response.status === 403) {
            const body = await response.json().catch(() => null);
            if (/rate limit/i.test(body?.message || '')) return { status: 'rate-limited' };
        }
        if (!response.ok) return { status: 'unavailable' };
        const releases = await response.json();
        if (!Array.isArray(releases)) return { status: 'unavailable' };
        let newest = null;
        let hasMatchingRelease = false;
        for (const release of releases) {
            if (!release || typeof release !== 'object' || typeof release.draft !== 'boolean' || !Array.isArray(release.assets)) return { status: 'unavailable' };
            if (release.draft || !hasMatchingAsset(release, variant)) continue;
            hasMatchingRelease = true;
            const version = releaseVersion(release);
            if (!version || compareVersions(version, currentVersion) <= 0) continue;
            if (!newest || compareVersions(version, newest.version) > 0) newest = { version, tag: release.tag_name };
        }
        return newest ? { status: 'available', version: newest.version, releaseUrl: `${RELEASE_PAGE}${encodeURIComponent(newest.tag)}` }
            : { status: hasMatchingRelease ? 'current' : 'none' };
    } catch (error) {
        return { status: error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'unavailable' };
    }
}

module.exports = { compareVersions, hasMatchingAsset, checkForUpdate };
