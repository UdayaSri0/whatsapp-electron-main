# Release candidate validation

Candidate: **1.2.0-rc.1**, dated 2026-10-23. Owner/maintainer: UdayaSri0.
Feature branch: `feat/first-linux-release-candidate`, based on foundation commit
`0ec99b9714a95a5ac667dea53f2c0f0424f22b76`. This is a release candidate, not
production acceptance. No merge, stable tag or production publication is implied.

## Current engineering checks

A fresh checkout was restored under `/home/rog/Projects/whatsapp-electron-main`
because the previous removable-volume checkout is no longer mounted. This avoids
the earlier exFAT symlink limitation. Current host: Linux x86_64, Ubuntu/GNOME,
Wayland session, Node 24.19.0. The existing account/profile was not accessed.

- Clean `npm ci --no-audit --fetch-retries=1 --fetch-timeout=30000`: **PASS**, 284
  packages installed. Electron's binary is fetched lazily by this pinned npm package;
  installation alone does not establish binary/runtime availability.
- `npm test`: **62/62 PASS** after integration and native-service error fixes.
- `npm run check`: **PASS**, JavaScript and packaging shell syntax.
- Independent review of device policies/preferences/diagnostics and UI integration:
  **PASS**; native dialog promise handling was improved following review.
- Independent autostart review: **5/5 unit tests PASS**, plus actual desktop-file
  validation and harmless Gio launches for **7/7 filenames** including spaces,
  quotes, backslashes, dollar signs, backticks and literal percent characters.
  Fixtures were temporary and no user autostart entry was changed.
- First local `npm run build:dir`: **FAILED**, Electron download `ECONNRESET`.
  An attempted explicit local electronDist also failed because no binary had yet
  been installed. The normal retry also **FAILED** with `ETIMEDOUT`. No local
  directory/DEB/AppImage success is claimed from these failed downloads.
- A DEB command started during the retry was cancelled; it is not a successful
  build. Builds must run sequentially against their shared output directory.

New code tests cover separate device denial/recovery, combined media denial,
malformed policy fail-closed behavior, saved privacy settings, redacted diagnostics,
tray-free menus, packaged-only explicit autostart, preserving foreign/edited
startup entries, concurrent creation, native integration failures, failed dialogs
and unavailable clipboard. Existing origin/frame/navigation/lifecycle regressions
remain enabled. Mocks do not verify hardware or Chromium media behavior.

- Actual developer runtime attempt: `timeout 55s node node_modules/electron/cli.js --version`
  reached binary download, then **TIMED OUT** (exit 124). No Electron process,
  QR page, sandbox result or real call was verified by that attempt.

## Candidate artifacts and runtime

The updated CI builds directory, DEB and AppImage candidates and pairs them with
corresponding source, BUILD-COMMIT.txt and SHA256SUMS. The manual candidate workflow
also supports RPM. Current commit/run URLs and final command results are recorded
in the draft pull request after execution. A queued or pending workflow is not PASS.

Native sandboxed startup/QR rendering, account linking, existing session restore,
real messaging and calls must each be distinguished. A fresh-profile smoke test
must not read a user's existing chats or claim real-device operation.

## Manual release acceptance

| Gate | Required evidence | Current result |
| --- | --- | --- |
| Account/session | QR link, send/receive, attachments, upgrade preserves login | NOT RUN |
| Voice/video | Incoming/outgoing/group calls, audible two-way audio and visible video | NOT RUN |
| Background calls | Incoming ringing and ten-minute call while minimized/hidden | NOT RUN |
| Privacy controls | Disabled devices denied; re-enable recovers; reload ends prior tracks | Policy tests PASS; hardware NOT RUN |
| Notifications/tray | GNOME/KDE visibility, delivery, focus and badge behavior | NOT RUN |
| Packages | Ubuntu/Mint install/upgrade/removal and desktop/taskbar identity | NOT RUN |
| Compositors/GPUs | X11/Wayland, available Intel/AMD/NVIDIA | NOT RUN |
| Screen sharing | Supported safe permission API, intended remote frames, cancellation | BLOCKED by pinned runtime |

Complete the [calling matrix](calling-validation.md) and [packaging checklist](packaging.md)
before promoting to a stable release. Do not change drivers, kernel, AppArmor,
Secure Boot or sandbox policy to turn a failed runtime test into a pass.

## Historical foundation evidence

[Foundation validation record](https://github.com/UdayaSri0/whatsapp-electron-main/blob/0ec99b9714a95a5ac667dea53f2c0f0424f22b76/docs/validation.md)
retains the original exFAT/registry failures, dependency audit and independent
review history. [Foundation final CI](https://github.com/UdayaSri0/whatsapp-electron-main/actions/runs/39830318537)
passed 47 tests on Node 22/24 and directory/DEB builds. Those are historical
results, not proof that this new candidate has built or passed runtime acceptance.
The lockfile dependency versions are unchanged in this candidate; the prior audit
reported eight moderate build-tool entries and no high/critical entries.
