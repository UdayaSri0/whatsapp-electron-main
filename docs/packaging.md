# Build, install and release

Owner and maintainer: UdayaSri0. Current candidate: **1.2.0-rc.1**.
Supported build contract: Linux x86_64, Node 22.12+ within 22 or Node 24.
Exact build dependencies remain Electron 43.7.0 and electron-builder 26.15.3.
Use a native filesystem with symlink and Unix permission support; clone under
your Linux home directory rather than on exFAT.

## Build targets

```bash
npm ci
npm run check
npm test
npm run build:dir     # dist/linux-unpacked
npm run build:deb     # Debian/Ubuntu package
npm run build         # AppImage
npm run build:rpm     # RPM
```

`npm run build:linux` builds AppImage, DEB and RPM. RPM packaging needs `rpmbuild`;
install distribution build prerequisites using your normal administration process.
Build commands specify `--publish never`. They do not create production releases.
Do not add sandbox-disabling flags to make a failing launch appear successful.

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
and delete local session data. No new updater or profile migration is introduced.
Uninstall DEB/RPM using the package manager; remove an AppImage manually.
Disable autostart before removing the executable.

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

## CI and corresponding source

CI performs clean installs, static checks and tests on Node 22/24, then builds
directory, DEB and AppImage output and inspects the DEB. It generates matching
source, provenance and SHA-256 checksums. The manually dispatched candidate
workflow additionally supports RPM. Neither publishes production releases.
Temporary CI downloads are not permanent release assets.

For any distribution candidate, build from a clean committed tree with an empty
`dist` and run `npm run release:assets` after the builds. The script archives HEAD,
records it in BUILD-COMMIT.txt and hashes the binaries/source. A dirty tree is rejected.
Verify with `cd dist && sha256sum --check SHA256SUMS`. Do not pair stale binaries
with a new source archive. Include LICENSE, NOTICE, corresponding wrapper source
and the bundled Electron/Chromium notices. Redistributors must review all third-party
source/license obligations separately.

## Stable release gate

Before a stable version/tag or production publication, complete the
[validation record](validation.md) and real-device [call matrix](calling-validation.md).
Test install/upgrade/removal, linked-session preservation, notifications, tray
visibility and window/taskbar identity on Ubuntu/Mint, GNOME/KDE and X11/Wayland.
Cover available Intel/AMD/NVIDIA hardware without changing drivers, kernel or
system security settings. Screen sharing remains unavailable until a safe capture
permission path and actual remote-frame/cancellation tests pass.
