# Stable update hardening validation

Candidate metadata: `1.2.0-rc.2`. Branch: `feat/stable-update-hardening`, based
on `origin/main` at `c9d8601075ccf6e1183423e41f3b4a3226e0bc32`. The public
`v1.2.0-rc.1` release and its assets were not changed.

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| Clean dependency install | PASS | `npm ci` on Node 24.19.0 / npm 11.16.0 installed 283 packages; audit found the 15 moderate records below |
| `npm run check` | PASS | Node 24.19.0 and Node 22.23.4 |
| `npm test` | PASS | After package builds: Node 22.23.4 and Node 24.19.0 each ran 94 tests, 94 passed, 0 skipped, 0 failed |
| `npm run verify:packages` | PASS | DEB package identities, desktop launchers, removal isolation, and profile preservation verified |
| `npm run test:packages` | PASS | Both DEB payloads installed, upgraded, and removed in a temporary root; profile sentinels preserved |
| `npm audit` | FAIL | 15 moderate, 0 high/critical; all trace to GHSA-g3hv-75wg-m249; see [dependency review](security-audit-stable-update.md) |
| GitHub CI | PASS | Draft PR #7: Node 22 and Node 24 test jobs and package build plus DEB lifecycle job passed on code commit `f0898486ae18b002183117cd42db752f2e09d73c` |

The pre-build skip was `dual DEB install, upgrade and removal simulation stays
inside a temporary root`. It skipped because the expected DEBs did not exist.
After both builds, the dedicated simulation and both Node suites passed with no
skips. The simulation only extracts files and manipulates synthetic profile
sentinels in a temporary root; it does not install into the host package
database or run Debian maintainer scripts.

## Package verification

| Package | Build | Metadata, checksum and provenance | Install/removal simulation |
| --- | --- | --- | --- |
| Personal AppImage | PASS | PASS; SHA-256 below; source commit `f0898486ae18b002183117cd42db752f2e09d73c` | Headless process stayed running for 15 seconds in a separate temporary XDG root; graphical checks NOT RUN |
| Personal DEB | PASS | PASS; SHA-256 below; source commit `f0898486ae18b002183117cd42db752f2e09d73c` | Temporary-root file simulation PASS; real dpkg install/removal BLOCKED |
| Business AppImage | PASS | PASS; SHA-256 below; source commit `f0898486ae18b002183117cd42db752f2e09d73c` | Headless process stayed running for 15 seconds in a separate temporary XDG root; graphical checks NOT RUN |
| Business DEB | PASS | PASS; SHA-256 below; source commit `f0898486ae18b002183117cd42db752f2e09d73c` | Temporary-root file simulation PASS; real dpkg install/removal BLOCKED |
| RPM pair | SKIPPED | SKIPPED | SKIPPED |

The DEB package names are `whatsapp-electron` and
`business-chat-for-whatsapp-unofficial`; their executable, desktop file and icon
names are distinct. Payload metadata inspection and `npm run verify:packages`
passed. Each build metadata digest matches its artifact. A Personal-only source
archive and `SHA256SUMS` were generated from the recorded commit in a disposable
detached worktree, and `sha256sum --check` passed for all six included files.

| Artifact | SHA-256 |
| --- | --- |
| `WhatsApp-1.2.0-rc.2-x86_64.AppImage` | `03775ff55a7b7ff50cd244be3fd0895e82aeeea65453dfcde6c8a9a504e34843` |
| `whatsapp-electron-1.2.0-rc.2-amd64.deb` | `f6cacd2aa9c74ac30f0e301a1b24bf899805721163101bec4e7acaa8b14f74a7` |
| `Business-Chat-for-WhatsApp-1.2.0-rc.2-x86_64.AppImage` | `1aff1d04bcff7a09ebd78d7643f791b81d8d6aaa0e4782ed2c4a80d4538afb44` |
| `business-chat-for-whatsapp-unofficial-1.2.0-rc.2-amd64.deb` | `e56b921b566b78f34dc5b3c8e0a6fef0eb77bf525b6dc9cf7b899ede2fc4ac4a` |

No packages are installed on the host. Actual dpkg lifecycle acceptance is
BLOCKED because no disposable Ubuntu VM or container runtime is available;
maintainer scripts can change alternatives and AppArmor. The rootless overlay
mount probe failed. RPM tooling is unavailable (`rpmbuild` not found). Window
names, rendered icons, menus, tray, desktop-click launch, manual update UI and
real-session independence remain NOT RUN. The live fixed-endpoint API check
returned `current` for Personal rc.2 and `restricted` for Business; no newer
published Personal asset exists for a live detection test. Unit tests cover
newer-release matching, offline/rate-limit handling, safe links, and opt-in.
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
