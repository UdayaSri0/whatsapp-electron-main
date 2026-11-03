# Stable update hardening validation

Candidate metadata: `1.2.0-rc.2`. Branch: `feat/stable-update-hardening`, based
on `origin/main` at `c9d8601075ccf6e1183423e41f3b4a3226e0bc32`. The public
`v1.2.0-rc.1` release and its assets were not changed.

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| Clean dependency install | PASS | `npm ci` on Node 24.19.0 / npm 11.16.0 installed 283 packages; audit found the 15 moderate records below |
| `npm run check` | PASS | Node 24.19.0 and Node 22.23.4 |
| `npm test` | PASS | Node 24.19.0 and Node 22.23.4 before builds: 94 tests, 93 passed, 1 package-lifecycle test skipped; after builds on Node 24.19.0: 94 passed, 0 skipped, 0 failed |
| `npm run verify:packages` | PASS | DEB package identities, desktop launchers, removal isolation, and profile preservation verified |
| `npm run test:packages` | PASS | Both DEB payloads installed, upgraded, and removed in a temporary root; profile sentinels preserved |
| `npm audit` | FAIL | 15 moderate, 0 high/critical; all trace to GHSA-g3hv-75wg-m249; see [dependency review](security-audit-stable-update.md) |
| GitHub CI | PASS | Draft PR #7: Node 22 and Node 24 test jobs and package build plus DEB lifecycle job passed on the implementation and documentation-only follow-up commits |

The pre-build skip was `dual DEB install, upgrade and removal simulation stays
inside a temporary root`. It skipped because the expected DEBs did not exist
yet. After both builds, the dedicated simulation and full suite passed. The
simulation only extracts files and manipulates synthetic profile sentinels in a
temporary root; it does not install into the host package database or touch a
real user profile.

## Package verification

| Package | Build | Metadata, checksum and provenance | Install/removal simulation |
| --- | --- | --- | --- |
| Personal AppImage | PASS | PASS; SHA-256 below; source commit `b3dbeb55517d2ce9d0b3b02dd5e50966ef094018` | Headless launch stayed running for 15 seconds with a disposable profile; no package lifecycle |
| Personal DEB | PASS | PASS; SHA-256 below; source commit `b3dbeb55517d2ce9d0b3b02dd5e50966ef094018` | PASS in temporary-root install/upgrade/removal simulation |
| Business AppImage | PASS | PASS; SHA-256 below; source commit `b3dbeb55517d2ce9d0b3b02dd5e50966ef094018` | Headless launch stayed running for 15 seconds with a separate disposable profile; no package lifecycle |
| Business DEB | PASS | PASS; SHA-256 below; source commit `b3dbeb55517d2ce9d0b3b02dd5e50966ef094018` | PASS in temporary-root install/upgrade/removal simulation |
| RPM pair | SKIPPED | SKIPPED | SKIPPED |

The DEB package names are `whatsapp-electron` and
`business-chat-for-whatsapp-unofficial`; their executable and desktop file names
are distinct. Each build metadata record's digest matches its artifact. A
Personal-only source archive and `SHA256SUMS` were generated in a disposable
detached worktree, and `sha256sum --check` passed for all six included files.

| Artifact | SHA-256 |
| --- | --- |
| `WhatsApp-1.2.0-rc.2-x86_64.AppImage` | `1d31452930058adcd1a0248347f9d6680bca128feb0e6717159994fd7132f8e9` |
| `whatsapp-electron-1.2.0-rc.2-amd64.deb` | `75e95ef19768e2910dea7a1cdd2aeaf9eeb2eac1a5ed8df8ffb57e562ff0ade7` |
| `Business-Chat-for-WhatsApp-1.2.0-rc.2-x86_64.AppImage` | `100ac9125a55b53d415412b22d16538d804088285ad4505650261fe4efe78fa8` |
| `business-chat-for-whatsapp-unofficial-1.2.0-rc.2-amd64.deb` | `1c2feb6bf88bf813022e2b387c1b1adb91cc07d4d15e114a20fdb5be17bbccaf` |

No packages are installed on the host. RPM tooling remains unavailable
(`rpmbuild` not found). Real desktop interaction and distro package-manager
installation are not covered by the headless launch and temporary-root checks.
Public dual-variant release assets remain blocked. No release tag, publication,
merge, or Business authorization secret is created by this branch.

## Runtime and policy limits

The Electron update from 43.7.0 to 43.8.6 stays within major version 43. The
43.8.6 release notes include upstream Chromium/V8/WebRTC and related backports.
The permission manager source is unchanged from 43.7.0; permission helper source
changes preserve device/desktop separation and improve pointer/keyboard-lock
request attribution. Screen sharing remains blocked. Calls, live accounts,
notifications, and distro/desktop hardware acceptance remain unverified as
listed in [manual acceptance](manual-acceptance.md).
