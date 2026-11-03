# Stable update hardening validation

Candidate metadata: `1.2.0-rc.2`. Branch: `feat/stable-update-hardening`, based
on `origin/main` at `c9d8601075ccf6e1183423e41f3b4a3226e0bc32`. The public
`v1.2.0-rc.1` release and its assets were not changed.

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| Clean dependency install | PASS | `npm ci` on Node 24.19.0 / npm 11.16.0 installed 283 packages; audit found the 15 moderate records below |
| `npm run check` | PASS | Node 24.19.0 and Node 22.23.4 |
| `npm test` | PASS WITH ONE PRE-BUILD SKIP | Node 24.19.0 and Node 22.23.4: 94 tests, 93 passed, 1 skipped, 0 failed; rerun after package builds |
| `npm audit` | FAIL | 15 moderate, 0 high/critical; all trace to GHSA-g3hv-75wg-m249; see [dependency review](security-audit-stable-update.md) |
| GitHub CI | NOT RUN | Draft pull request and push are pending final local verification |

The pre-build skipped test is `dual DEB install, upgrade and removal
simulation stays inside a temporary root`. Its source skips when either
expected DEB is missing; no code bypasses or removes the skip. Rerun the suite
after package builds so the simulation can execute. Package lifecycle
simulation only extracts files and manipulates synthetic profile sentinels in a
temporary root; it does not install into the host package database or touch a
real user profile.

## Package verification

| Package | Build | Metadata, checksum and provenance | Install/removal simulation |
| --- | --- | --- | --- |
| Personal AppImage | PENDING | PENDING | NOT APPLICABLE |
| Personal DEB | PENDING | PENDING | PENDING |
| Business AppImage | PENDING | PENDING | NOT APPLICABLE |
| Business DEB | PENDING | PENDING | PENDING |
| RPM pair | SKIPPED | SKIPPED | SKIPPED |

No packages are installed on the host. RPM tooling was not available at the
initial inventory (`rpmbuild` not found); recheck before finalizing this record.
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
