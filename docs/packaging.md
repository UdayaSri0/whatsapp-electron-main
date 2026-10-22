# Packaging and Linux integration

Modified 2026-10-22. This fork is maintained at
https://github.com/UdayaSri0/whatsapp-electron-main. Original wrapper author:
Dominik Lübben, https://github.com/DomiLuebben/whatsapp-electron.
The wrapper remains GPL-2.0-or-later; this is unofficial software, unaffiliated
with WhatsApp or Meta.

## Build and validate

Build on a native Linux filesystem that supports symlinks and Unix permissions.
The development checkout on exFAT rejected symlink creation (`EPERM`), so clean
installation and package builds were moved to an identical source copy under
`/tmp/whatsapp-foundation-build.QczR5p`. Cloning under `~/src` on ext4/btrfs is
preferable for ongoing development. Do not change mount or system security
settings to work around this limitation.

Use Node.js 24 (recommended, `.nvmrc`) or Node.js 22.12 or newer within the 22
series. Both are covered by CI. Odd releases 23 and 25 are EOL and are no longer
accepted. Node.js 26 remains outside the tested build range; this is a project
support boundary rather than proof of a specific electron-builder defect.
See [Node.js releases](https://nodejs.org/en/about/previous-releases).
The lock pins Electron 43.7.0 and electron-builder 26.15.3; Electron's installer
requires Node.js >=22.12. Do not confuse build-host Node with Electron's embedded
runtime. Review [Electron's support policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)
and advisories before each release. The targeted maintenance update is recorded
in the technical audit; exact pins avoid unreviewed version drift.

```
npm ci
npm run check
npm test
npm run build:dir
npm run build:deb
```

`npm run build` produces AppImage; `build:rpm` needs `rpmbuild`; `build:linux`
produces all three formats. Builds never publish. `dist/` is local output.
`arch-pkg/PKGBUILD` packages the previously generated `dist/linux-unpacked`
directory and is intended for a local `makepkg`, not as a standalone source
recipe. Its sandbox helper retains the existing setuid packaging behavior;
never run the app with `--no-sandbox` as an installation workaround.

The CI workflow validates clean installation, syntax, tests on Node 22/24 and
directory/DEB packaging on Ubuntu 24.04. The manually dispatched candidate
workflow additionally builds AppImage/RPM, archives corresponding tracked source,
records the commit, generates SHA-256 checksums and uploads temporary CI
artifacts. It creates no GitHub release. Successful builds do not verify runtime
calls, distribution dependencies or desktop behavior.

## Candidate and release procedure

Build from a fresh, committed checkout; run tests and `npm run build:linux`, then
`npm run release:assets`. The asset script rejects a dirty checkout and archives
HEAD, including LICENSE and build scripts. Use a clean `dist` for every candidate
to avoid checksumming stale binaries from an earlier build. Inspect DEB/RPM
metadata and installation/removal, compare the recorded commit, and verify from
`dist/` with `sha256sum --check SHA256SUMS`. Publish only after manual acceptance.
Distribute the matching source archive and wrapper license alongside binaries;
preserve Electron/Chromium third-party notices. The workflow does not supply a
complete third-party source compliance determination for redistributors.

Keep package.json and package-lock.json versions aligned, add release notes,
create a versioned tag only after validation, and attach artifacts for that exact
commit. No update service or automatic updater is configured.

## Identity and desktop acceptance

The existing name `WhatsApp`, package name, executable, app ID and WM_CLASS are
retained to preserve installed profiles and taskbar matching. Launchers explicitly
say unofficial. The profile remains `~/.config/WhatsApp` (or Electron's existing
XDG location); upgrades must not delete it. AppImage launcher installation is
user-invoked. To reverse it, remove only the generated files:
`~/.local/share/applications/whatsapp-desktop.desktop` and
`~/.local/share/icons/hicolor/512x512/apps/whatsapp-desktop.png`.
Autostart is not enabled automatically. Desktop Exec quoting handles both desktop
string and argument parsing, including literal field-code characters. Paths with
`%` use `/usr/bin/env --` to avoid GIO interpreting the escaped executable name
before field expansion. Paths containing `=` or control characters are rejected;
rename the AppImage before installing its shortcut. No shell is invoked.
See the [desktop-entry Exec specification](https://specifications.freedesktop.org/desktop-entry/latest/exec-variables.html).

Before release, record results on Ubuntu/Mint, GNOME/KDE, X11/Wayland and available
Intel/AMD/NVIDIA hardware. Verify notifications, taskbar identity, multi-monitor
bounds restoration, tray unavailable fallback, close/restore, start minimized,
and session persistence across upgrade. Wayland screen sharing needs a working
PipeWire and desktop portal backend for the session. Test portal cancellation,
screen/window choice and multi-monitor capture with real content. A returned
capture source does not establish working video or calls. Do not modify drivers,
kernel options or system-wide GPU configuration for these tests.

The post-update audit retained a high advisory in Undici 7.28.0, used by build
download tooling. A targeted lock-only update selected 7.30.1 within the existing
`@electron/get` 7.x dependency range, without adding a direct dependency. See the
[official Undici patched-version advisory](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3)
and final validation for the audit outcome. Automatic audit fixes suggesting a
builder downgrade were deliberately not applied.
