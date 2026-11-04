# Business variant, installation and distribution limits

## Architecture and identity

`src/main.js` remains the single Electron main process. `config/variants.js`
defines the Personal and Business identities. `scripts/build-variant.js` passes
the selected identity to electron-builder as packaged metadata; installed builds
do not accept `WHATSAPP_VARIANT` overrides. That variable is used only by
`npm run start:personal` and `npm run start:business` during development.
The inherited compatibility identity behavior remains available to Personal;
the new Business variant uses Chromium's native identity and adds no browser
feature or account-identity bypass.

| Identity | Personal | Business prototype |
| --- | --- | --- |
| Product | WhatsApp (unofficial) | Business Chat for WhatsApp (Unofficial) |
| Application ID | `com.dluebben.whatsapp-desktop` | `com.udayasri0.business-chat-whatsapp-unofficial` |
| Executable | `whatsapp` | `whatsapp-business-unofficial` |
| Electron profile | `appData/WhatsApp` | `appData/WhatsApp-Business-Unofficial` |
| DEB package | `whatsapp-electron` | `business-chat-for-whatsapp-unofficial` |
| Packaged desktop file / WM_CLASS | `whatsapp.desktop` / existing WhatsApp identity | `com.udayasri0.business-chat-whatsapp-unofficial.desktop` / `com.udayasri0.business-chat-whatsapp-unofficial` |
| User autostart file | `whatsapp-electron.desktop` | `whatsapp-business-unofficial.desktop` |
| AppImage shortcut | `whatsapp-desktop.desktop` | `com.udayasri0.business-chat-whatsapp-unofficial.desktop` |

Electron's `appData` directory honors its platform/XDG configuration. On a
typical Linux setup it is `~/.config`; the actual profile is resolved at runtime
from `app.getPath('appData')`, rather than a hard-coded home path. The Personal
profile resolves to the same `WhatsApp` directory as before. No profile contents
are copied, migrated, renamed or deleted. Electron uses the distinct user-data
directories for cookies, browser storage, caches, preferences and its
single-instance lock. Package names, executables, WM_CLASS values, tray names,
AppImage launcher files and autostart entries are also distinct.

## Linking and feature limits

Build `Business Chat for WhatsApp (Unofficial)` and scan its WhatsApp Web QR
code using **WhatsApp Business → Linked devices → Link a device** on the
authorised primary phone. Persistent login, chats, messages, attachments,
notifications, unread counts and any call controls are provided by the same
WhatsApp Web page used by Personal. Their availability depends on WhatsApp,
account eligibility and the deployed Web client. This wrapper does not add or
simulate Business catalogues, labels, broadcasts, automations, customer
management or other Business APIs. Screen sharing remains blocked by the
existing Electron permission limitation.

WhatsApp's [linked-device guidance](https://faq.whatsapp.com/378279804439436/)
specifically warns that linking through unofficial apps or websites is
unsupported, may put account privacy/security at risk, and may result in a
temporary or permanent ban. WhatsApp's [Terms of Service](https://www.whatsapp.com/legal/terms-of-service)
also restrict unauthorized use and non-personal use absent authorization. This
project has no written authorization from Meta/WhatsApp. **Public distribution
of Business binaries is therefore blocked.** The local build is a prototype,
not evidence that account linking is permitted, safe, or supported. Do not
present it as an official WhatsApp Business app.

Product names and icon artwork are original and include an explicit unofficial
label. WhatsApp names and marks remain their owners' property; original artwork
does not confer permission to reference or distribute a client of the service.
Obtain qualified legal review and the applicable written authorization before
publishing Business binaries. Existing source notices and GPL-2.0-or-later
obligations remain in force.

## Update notifications

The Business build includes **Help → Check for Updates**, but checks return a
distribution-restricted result without querying releases or identifying a
Business asset. Automatic checks default off and do not advertise Business
packages. Enabling future Business release notices requires a reviewed change
after written distribution authorization; a GitHub CLI acknowledgement or
release asset alone is not authorization.

## Install, remove and preserve profiles

The Business DEB/AppImage artifacts have independent package, executable,
desktop and autostart names. Removing the Business package does not remove the
Personal package, launcher, autostart file or profile. Removing Personal has the
corresponding effect on only Personal's package-managed files. User profiles
under the XDG data directory are intentionally left in place when either
application is uninstalled, to preserve linked sessions and local data.

Disable that application's **Start automatically at login** setting before
removing its executable. The app removes only its own unchanged autostart file.
AppImage desktop shortcuts are installed explicitly from Settings and are
separate per variant; removing the AppImage does not automatically delete the
shortcut or its icon. Remove only the corresponding generated
`com.udayasri0.business-chat-whatsapp-unofficial.desktop` and same-named icon
when you deliberately want to remove the Business shortcut. See
[packaging](packaging.md#desktop-integration).

## Build and release

```bash
npm ci
npm run check
npm test
npm run build:personal
npm run build:business
npm run build:all
npm run build:rpm:all # optional; requires rpmbuild
```

`build:all` also runs `verify:packages`, which inspects both generated DEBs for
distinct package names, desktop files and removal scripts that leave user
profiles untouched. It does not install or remove the packages.

DEB and AppImage targets build on Linux x86_64. RPMs are optional and should be
built as a matching pair. The build script writes per-variant/per-target
`BUILD-METADATA.*.json` records containing the source commit and artifact SHA-256.
`npm run release:assets -- --mode personal` prepares Personal-only assets.
Dual assets require `--mode dual --business-distribution-authorized`, matching
packages and provenance. The CLI flag is an intent check, not authorization;
the GitHub dual-upload workflow also requires a protected environment and
authorization secret. A public Business binary release remains blocked pending
written authorization plus successful security, installation and supervised
manual acceptance. See [release gates](release-readiness.md) and the
[manual acceptance checklist](manual-acceptance.md).

## Manual acceptance status

The [manual acceptance checklist](manual-acceptance.md) tracks both variants.
No live account, real messaging, attachments, calls, notifications, graphical
desktop or hardware acceptance was run for this variant during implementation.
Record each result as PASS, FAIL, NOT RUN, BLOCKED or NOT AVAILABLE. Do not link
real accounts until policy/legal review, any required authorization and the
account owner's explicit approval are in place; never attach QR codes, messages,
contacts, media, cookies, tokens or profile contents.

| Platform check | Result |
| --- | --- |
| Ubuntu 26.10, GNOME Wayland package install/desktop behavior | NOT RUN (AppImage launch smoke only) |
| X11 session where available | NOT RUN |
| Ubuntu/Mint package install, upgrade, removal | NOT RUN |
| KDE desktop integration | NOT RUN |
| NVIDIA hardware | NOT RUN |
| Separate account QR login and restoration | NOT RUN |
| Messaging and image/document transfers | NOT RUN |
| Disconnect/reconnect | NOT RUN |
| Tray, unread indicator, notifications, autostart | NOT RUN |
| Microphone/camera denial and recovery | NOT RUN |
| Incoming/outgoing voice and video calls, minimized | NOT RUN |
| Simultaneous Personal + Business AppImage startup and profile separation | PASS (Ubuntu 26.10 GNOME Wayland; shared temporary XDG config root; environment selectors intentionally conflicted; both processes and separate profile directories observed; no account linked) |

Automated tests cover identity selection, profile path separation, launcher and
autostart filenames, security handlers, diagnostics redaction and package
metadata/removal-script isolation. They do not substitute for package-manager or
live account checks.
