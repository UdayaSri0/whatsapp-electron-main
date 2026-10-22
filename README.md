# WhatsApp Electron for Linux

Modified 2026-10-22 by UdayaSri0; original implementation by Dominik Lübben.

An unofficial Linux desktop wrapper for the official WhatsApp Web client.
Messaging, authentication and encryption are provided by WhatsApp Web. This
project is not affiliated with, endorsed by or sponsored by WhatsApp or Meta.
WhatsApp and its artwork are trademarks of their respective owners.

This fork is maintained at [UdayaSri0/whatsapp-electron-main](https://github.com/UdayaSri0/whatsapp-electron-main).
Original implementation: [Dominik Lübben / whatsapp-electron](https://github.com/DomiLuebben/whatsapp-electron).
Original authorship and GPL-2.0-or-later licensing are preserved.

## Current status

Version 1.1.1 is the starting version for this foundation contribution; these
changes are unreleased. Calling support in WhatsApp Web does not establish that
calls work in this wrapper. Actual microphone, camera, incoming/outgoing/group
calls and Linux desktop behavior still require the
[manual validation matrix](docs/calling-validation.md).

**Screen sharing is deliberately blocked on the pinned Electron runtime**:
its permission API cannot safely distinguish modern display capture from legacy
capture before approval. See [security boundaries](docs/security.md). No passing
mock test or returned capture source is evidence of working screen sharing.

## Features and defaults

- Sandboxed remote renderer, context isolation, web security and no Node access.
- Device permissions restricted to the current main window at exactly
  `https://web.whatsapp.com`; explicit audio/video types only.
- Navigation guards, denied new windows/webviews and allowlisted external links.
- Persistent window geometry, unread title badges and bounded network/crash retries.
- Optional tray and start-minimized preferences, with a visible fallback when
  tray construction fails. New profiles close normally by default.
- English application menus and explicit AppImage desktop shortcut installation.
- Existing profile, app ID and session storage preserved; no automatic updater.

## Build and run

Use a native Linux filesystem (such as ext4/btrfs), Linux x86_64 and Node.js 24 (`.nvmrc`).
exFAT does not support the symlinks needed by npm; clone under your Linux home directory for builds. Node 22.12+ is also supported within
22.x. Node 23/25/26 are outside this contribution's tested build contract.
The host Node version builds the app; Electron bundles a separate runtime.

```bash
git clone https://github.com/UdayaSri0/whatsapp-electron-main.git
cd whatsapp-electron-main
nvm install
nvm use
npm ci
npm run check
npm test
npm start
```

Link the account using WhatsApp Web's QR flow. Existing login data remains in
Electron's `WhatsApp` userData profile (normally `~/.config/WhatsApp`, subject to
XDG configuration). Updates do not delete it. Do not delete the profile as a
troubleshooting step unless you intend to unlink the session.

## Browser compatibility and calling

The inherited Chromium identity workaround remains enabled pending actual
comparison testing. It now applies only to the WhatsApp window and attributable
WhatsApp resource requests. No global app/session user agent is changed; the
preload patches only the exact main-frame Web origin and exposes no native APIs.
Requests without an attributable window retain their original identity.

Test ordinary Electron/Chromium identity first by quitting every instance, then:

```bash
WHATSAPP_BROWSER_IDENTITY=native npm start
```

Quit and restart without the variable to compare compatibility mode with the
same account. Background throttling remains disabled for calling. The
[calling matrix](docs/calling-validation.md) covers device denial/recovery,
audio output, background calls, screen cancellation and Wayland/X11.

## Linux desktop behavior

Tray support depends on the desktop and its StatusNotifier/AppIndicator provider.
A successful tray constructor does not prove the icon is visible. On desktops
without a usable tray, launch with `WHATSAPP_DISABLE_TRAY=1` to force a visible
window and normal close behavior, overriding saved start-minimized preferences.
Launching a second instance restores the existing window.

AppImage startup no longer writes launcher files automatically. Use the tray's
**Install AppImage desktop shortcut** action to opt in. An existing different
launcher is preserved. The action writes only these user-owned files:

- `~/.local/share/applications/whatsapp-desktop.desktop`
- `~/.local/share/icons/hicolor/512x512/apps/whatsapp-desktop.png`

Remove those files to undo integration if they are this application's files.
Move an AppImage before installing its shortcut; an existing launcher referring
to an old location is intentionally not overwritten. This contribution does not
add autostart; future autostart must be explicit and reversible.

Wayland capture requires PipeWire and an appropriate XDG desktop portal, but those
components do not resolve the pinned runtime's capture permission limitation.
No drivers, kernel settings, Secure Boot or system-wide graphics options need
changing. Actual GNOME/KDE, Ubuntu/Mint, X11/Wayland and GPU coverage is pending.

## Packaging

```bash
npm run build:dir    # unpacked app
npm run build:deb    # Debian/Ubuntu
npm run build:rpm    # Fedora; requires rpmbuild
npm run build       # AppImage
npm run build:linux # AppImage + DEB + RPM
```

Local build commands never publish. See [packaging and CI](docs/packaging.md)
for prerequisites, Arch packaging, source archives, checksums and candidate
workflows. No production release is authorized by successful unit tests alone.

## Technical records

- [Baseline audit](docs/technical-audit.md)
- [Security policy and capture limitation](docs/security.md)
- [Calling and Linux validation matrix](docs/calling-validation.md)
- [Validation and delivery record](docs/validation.md)
- [Changelog](CHANGELOG.md)

## License

Wrapper source: [GNU GPL-2.0-or-later](LICENSE). Original author Dominik Lübben;
this fork preserves upstream credits. Electron, Chromium, dependencies and the
WhatsApp client remain subject to their respective licenses. Binary candidates
include the wrapper license and Electron/Chromium notices; corresponding source
archives must accompany distributions as described in the packaging guide.
