# Build, install and release

Owner and maintainer: UdayaSri0. Next candidate: **1.2.0-rc.2**.
Supported build contract: Linux x86_64, Node 22.12+ within 22 or Node 24.
Exact build dependencies are Electron 43.8.6 and electron-builder 26.18.1.
Use a native filesystem with symlink and Unix permission support; clone under
your Linux home directory rather than on exFAT.

## Build targets

```bash
npm ci
npm run check
npm test
npm run build:personal # Personal AppImage and DEB
npm run build:business # Business AppImage and DEB
npm run build:all      # both variants from the same source version
npm run build:rpm:all  # optional matching RPMs; requires rpmbuild
npm run build:dir     # dist/linux-unpacked
npm run build:deb     # Debian/Ubuntu package
npm run build         # AppImage
npm run build:rpm     # RPM
```

`npm run build:linux` builds AppImage, DEB and RPM. RPM packaging needs `rpmbuild`;
install distribution build prerequisites using your normal administration process.
Build commands specify `--publish never`. They do not create production releases.
Do not add sandbox-disabling flags to make a failing launch appear successful.

Legacy build commands continue to select Personal. The variant commands package
one shared `src/main.js` with variant-specific immutable metadata, executable,
desktop identity, Linux package name and icon. See
[Business variant](business-variant.md) for profile and distribution limits.

`arch-pkg/PKGBUILD` wraps the existing directory output. Run `build:dir` first,
then `makepkg` from `arch-pkg`; the Arch candidate version is `1.2.0rc1` because
PKGBUILD versions cannot contain the semver hyphen. Arch packaging and setuid
sandbox installation still require distribution acceptance testing.

## Candidate installation and removal

Check the artifact's commit, version, architecture and SHA-256 before installing.
For a DEB, use your package manager to install the local `.deb`, then open
**WhatsApp (unofficial)**. For an RPM, use the target distribution's package manager.
These operations may require administrative privileges; application startup and
AppImage integration do not.

For an AppImage, put it in a permanent user-owned location, grant executable
permission and run it. Some distributions need AppImage/FUSE support. Extraction
with AppImage's supported `--appimage-extract-and-run` option can avoid a FUSE
mount requirement, but does not remove Electron's sandbox requirements.

Before upgrading, quit all application instances. Existing product name,
executable, application ID, WM_CLASS and profile are retained. The profile is
normally `~/.config/WhatsApp`, subject to Electron's existing XDG behavior.
Do not remove it during upgrade/uninstall unless you deliberately want to unlink
and delete local session data. No package installer or profile migration is
introduced; the optional update-check preference defaults off for older profiles.
Uninstall DEB/RPM using the package manager; remove an AppImage manually.
Disable autostart before removing the executable.

**Help → Check for Updates** only opens a matching GitHub release page. It does
not download packages. For a DEB or RPM, download the matching asset yourself,
verify its SHA-256, then install the local package with your distribution's
package manager; installing a newer package with the same package identity
upgrades that variant. For an AppImage, quit the app, download and verify the
new image, then replace the old file at its existing path (or update the
explicit autostart/shortcut path if you move it). None of these operations
changes the profile. See [update notifications](update-notifications.md).

## Desktop integration

All integration is explicit. The native Settings menu is available without a tray.

**Start automatically at login** creates:
`$XDG_CONFIG_HOME/autostart/whatsapp-electron.desktop`, or
`~/.config/autostart/whatsapp-electron.desktop` when XDG_CONFIG_HOME is unset.
It starts the packaged executable or permanent AppImage path. It follows saved
start-minimized preferences, subject to tray fallback. Disable it from Settings
to remove only the application's unmodified managed entry. Existing foreign,
modified, empty and symlink entries are preserved. The checksum detects edits;
it is not an authentication boundary against another process running as you.
A stale `.lock` left by a process crash causes a visible error: after quitting all
instances, inspect and remove only the matching `whatsapp-electron.desktop.lock`
if no operation is running, then retry. Never delete another application's entry.

**Install AppImage desktop shortcut** creates:

- `~/.local/share/applications/whatsapp-desktop.desktop`
- `~/.local/share/icons/hicolor/512x512/apps/whatsapp-desktop.png`

Existing different launchers/icons are preserved. To reverse integration, remove
only these generated files if they belong to this application. Move an AppImage
before integration; an old customized path is intentionally not overwritten.

Desktop Exec escaping handles string and argument parsing without a shell.
Literal percent filenames use `/usr/bin/env --` to avoid GIO executable checking
before field expansion. Paths with `=` or control characters are rejected; rename
the executable before enabling integration. See the
[desktop-entry specification](https://specifications.freedesktop.org/desktop-entry/latest/exec-variables.html).

## CI, candidate artifacts and release modes

CI performs clean installs, static checks and tests on Node 22/24, then builds
both variants' DEBs and AppImages, inspects their metadata and simulates install,
upgrade and removal under a temporary root. CI uploads no packages. The manual
candidate workflow requires an explicit `personal` or `dual` selection. Dual
candidate uploads require the protected `business-distribution` environment
and its authorization secret.

For a Personal-only candidate, build from a clean committed tree with an empty
`dist`, run `npm run build:personal`, `npm run verify:packages:personal`, then
`npm run release:assets -- --mode personal`. For dual assets, only after required
authorization, run `npm run build:all`, then
`npm run release:assets -- --mode dual --business-distribution-authorized`.
If RPMs are wanted, build only the selected variant set: `npm run build:personal -- rpm` or `npm run build:rpm:all`. The script requires exact matching package
and provenance files for the selected mode, rejects stale or unexpected variant
packages, records the source commit and hashes the selected source/packages.
Verify with `cd dist && sha256sum --check SHA256SUMS`.

The `Prepare gated draft release` workflow requires an existing version tag and
creates a draft GitHub Release containing only the selected variant assets. It
does not publish the draft; publication requires a separate maintainer action.
Dual mode additionally requires a protected environment and authorization
secret. Review [release gates](release-readiness.md) before any public release.
Do not pair stale binaries with a new source archive. Include LICENSE, NOTICE,
corresponding wrapper source and bundled Electron/Chromium notices. Review all
third-party source/license obligations separately.

The CLI flag is an intent check, not authorization. Business binaries must not
be publicly distributed without the required WhatsApp/Meta authorization. The
existing Personal wrapper is also unofficial; Personal-only mode does not
establish policy compliance.

## Safe package lifecycle checks

`npm run test:packages` extracts DEB payloads only under a fresh temporary
directory, overlays a synthetic higher-version package and simulates removal
from that directory. It creates synthetic profile sentinels and verifies the
other package and both sentinels remain. It never installs packages into the
host, changes its package database or executes Debian maintainer scripts.
`npm run verify:packages` statically checks those scripts for cross-variant and
user-profile removal paths.

Real package-manager installation, upgrade and removal still require a
disposable VM/snapshot with a dedicated test user and temporary `XDG_CONFIG_HOME`.
Restore the snapshot after each sequence. Never point this test at a real
profile. See [manual acceptance](manual-acceptance.md) for the full checklist.

## Stable release gate

Before a stable version/tag or production publication, complete the
[validation record](validation.md) and real-device [call matrix](calling-validation.md).
Test install/upgrade/removal, linked-session preservation, notifications, tray
visibility and window/taskbar identity on Ubuntu/Mint, GNOME/KDE and X11/Wayland.
Cover available Intel/AMD/NVIDIA hardware without changing drivers, kernel or
system security settings. Screen sharing remains unavailable until a safe capture
permission path and actual remote-frame/cancellation tests pass.
