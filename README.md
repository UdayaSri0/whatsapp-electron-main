# WhatsApp Electron for Linux

An unofficial WhatsApp Web desktop application, owned and maintained as a fork by
[UdayaSri0](https://github.com/UdayaSri0). Messaging, account linking and call
controls come from WhatsApp Web. This project is not affiliated with WhatsApp or Meta.

**Current candidate: 1.2.0-rc.1.** This is the first release candidate of this fork,
following the inherited 1.1.1 version. It is not a verified stable calling release.
No public production release has been published by this change.

## What is included

- A sandboxed WhatsApp window with persistent login and window placement.
- Visible File, Edit, View, Settings and Help menus, even without a system tray.
- Optional close-to-tray and start-minimized behavior, unread indicators and reload recovery.
- Separate microphone and camera switches in Settings.
- Opt-in startup at login and AppImage desktop shortcuts.
- Native About and Copy Diagnostics actions for support.
- Linux x86_64 directory, DEB, AppImage and RPM build targets.

Calls depend on the WhatsApp Web feature rollout, account and devices. Actual
incoming/outgoing, video, group and background calls still require the
[call validation matrix](docs/calling-validation.md). **Screen sharing is blocked**
on this runtime because its capture permission boundary cannot be safely separated
from legacy capture. Installing PipeWire alone does not resolve that limitation.

## Get the candidate

Official releases are listed on the project's [GitHub Releases page](https://github.com/UdayaSri0/whatsapp-electron-main/releases).
Report reproducible problems through the [issue tracker](https://github.com/UdayaSri0/whatsapp-electron-main/issues).

Use an artifact linked from this fork's reviewed pull request or build the exact
candidate commit yourself. Do not mistake an upstream download or an old CI artifact
for this candidate. CI artifacts expire; no stable download is promised yet.

For Ubuntu/Mint, install the generated DEB with your normal package manager:

```bash
sudo apt install ./whatsapp-electron-1.2.0-rc.1-amd64.deb
```

Start **WhatsApp (unofficial)** from the application launcher. For an AppImage:

```bash
chmod +x WhatsApp-1.2.0-rc.1-x86_64.AppImage
./WhatsApp-1.2.0-rc.1-x86_64.AppImage
```

Your system must support AppImage execution and Electron sandboxing. See
[installation and packaging](docs/packaging.md) for candidate checksums, prerequisites,
RPM/Arch notes, upgrades and removal. Never use `--no-sandbox` as an installation fix.

## Link your account and use chats

1. Open the application and wait for WhatsApp Web to load.
2. On your phone, open WhatsApp's **Linked devices** and link the displayed QR code.
3. Use WhatsApp's own chat list, messages, attachments and call controls.

Existing linked sessions use the same `WhatsApp` profile as before. Reloading or
upgrading does not intentionally clear it. Logging out through WhatsApp unlinks
the account; do not delete the profile as a routine repair step.

For calls, keep **Settings → Allow microphone** enabled and allow the camera for
video. Use WhatsApp's microphone, camera and audio-output selectors where offered.
If call buttons are unavailable or calls fail, complete the diagnostic steps below;
this wrapper cannot enable account features that WhatsApp does not provide.

## Desktop settings

The Settings menu is available without a tray. New profiles close normally.
**Minimize to tray on close** and **Start minimized** require a constructed tray;
a desktop can still hide its tray provider. If you cannot find the window, quit
and restart with `WHATSAPP_DISABLE_TRAY=1` to force visible operation.

**Allow microphone** and **Allow camera** independently control future device
permission requests. Changing either setting saves it and reloads WhatsApp,
interrupting active calls. Reload must complete to end any existing media stream;
use WhatsApp's hang-up button for an immediate ordinary call stop.

**Start automatically at login** is off until explicitly enabled. It is available
in packaged builds and creates only a user-owned XDG autostart entry. Uncheck it
before uninstalling; no startup service or root access is used.

For AppImages, move the file to its permanent location first, then select
**Install AppImage desktop shortcut**. Existing customized files are preserved.
See [desktop integration](docs/packaging.md#desktop-integration) for exact paths
and reversible removal instructions.

## Troubleshooting

- **Blank/offline page:** use **File → Reload** (`Ctrl+R`); check network access to
  WhatsApp Web. Recovery retries back off automatically.
- **Microphone/camera failure:** check the two Settings switches, reconnect the
  device, then retry in WhatsApp. A camera permission is not proof of a working camera.
- **Missing tray:** use the native menu or restart with `WHATSAPP_DISABLE_TRAY=1`.
- **Startup/shortcut conflict:** the application displays an error and preserves
  your existing file. Inspect it yourself before replacing or deleting it.
- **Report a bug:** use **Help → Copy Diagnostics**, describe the reproduction and
  submit it through the [bug report template](https://github.com/UdayaSri0/whatsapp-electron-main/issues/new?template=bug_report.yml).
  Diagnostics contain selected runtime/settings values, not chats, credentials or
  profile paths. Check any additional logs before sharing them.

Compare ordinary browser identity without deleting your login: quit every
instance, then prefix the executable with `WHATSAPP_BROWSER_IDENTITY=native`.
Restart with that variable unset to restore the inherited compatibility mode.
Neither mode has completed the real-device call acceptance matrix.

## Build from source

Use Linux x86_64, Node.js 24 (recommended; `.nvmrc`) and a native filesystem such as
ext4/btrfs. Node 22.12+ within the 22 series is also supported. npm installation
requires symlinks; an exFAT checkout is unsuitable.

```bash
git clone https://github.com/UdayaSri0/whatsapp-electron-main.git
cd whatsapp-electron-main
git checkout v1.2.0-rc.1  # exact published candidate, when available
npm ci
npm run check
npm test
npm start
```

Build commands and release gates are in [packaging](docs/packaging.md).
Development builds deliberately disable autostart so they do not create a login
entry for the Electron development runner.

Do not attach QR codes, chats, contacts, media, cookies, access tokens or full
profiles to issue reports. Calls and screen sharing are not certified by this
release; screen sharing is intentionally blocked.

## Project records and licensing

[Documentation index](docs/README.md) · [Changelog](CHANGELOG.md) ·
[Security boundaries](docs/security.md) · [Validation](docs/validation.md)

Owner and maintainer: **UdayaSri0**. Wrapper source: **GPL-2.0-or-later**.
Original authorship, dependency notices and trademark information are preserved
in [NOTICE](NOTICE) and [LICENSE](LICENSE). Project ownership does not replace
copyright notices belonging to contributors.
