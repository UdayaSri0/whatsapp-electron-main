# Changelog

## 1.2.0-rc.2 — stable update hardening candidate (2026-11-04)

- Update Electron from 43.7.0 to 43.8.6 and electron-builder from 26.15.3 to
  26.18.1 while retaining Electron 43 and the existing hardened runtime.
- Add **Help → Check for Updates** using the fixed GitHub Releases API, strict
  semantic-version ordering and exact Personal release assets. No package is
  downloaded or installed by the application.
- Add optional daily checks, disabled for existing and new profiles by default.
  Business update notices stay closed while public distribution is unauthorized.
- Document the remaining minimatch advisory across the development packaging
  dependency tree; preserve original author credit, GPL notices and identities.
- Release, account, package-manager and call acceptance remain pending review;
  this candidate does not publish or authorize Business binaries.

## 1.2.0-rc.1 — first fork candidate (2026-10-23)

- Add visible native application menus, editing shortcuts, zoom/fullscreen,
  About and privacy-conscious Copy Diagnostics, including tray-free desktops.
- Add separate saved microphone/camera controls; changing them reloads WhatsApp.
- Add explicit reversible packaged Linux autostart with XDG support and
  preservation of foreign or edited entries.
- Surface desktop integration and clipboard failures; handle native dialog
  rejection safely during teardown.
- Identify UdayaSri0 as project owner/maintainer in package metadata; retain
  original authorship and licensing in NOTICE, contributors and source notices.
- Rewrite installation, usage, troubleshooting and developer documentation.
- This is a candidate, not a stable calling release. Real account/device/call,
  installation and Linux desktop acceptance remain required; screen sharing is blocked.

### Included secure foundation (based on 1.1.1)

- Bind permission requests/checks to the live main-window Web origin and restrict
  media to named camera/microphone types. Deny ambiguous desktop media requests.
- Harden the capture handler against wrong frames, navigation, cancellation,
  concurrent pickers and device/portal failures. Screen sharing remains blocked
  on the pinned runtime until its preceding permission flow can be made safe.
- Isolate inherited browser compatibility and add a native identity test mode.
- Recover from unavailable trays; preserve sessions and validate/private-write
  preferences. Install navigation guards before initial loading.
- Make AppImage shortcut creation explicit, preserve existing launchers, and
  escape both desktop Exec parsing layers and literal field codes. Verify unusual
  filenames with actual harmless Gio launches. Use English menu/dialog labels.
- Add policy/lifecycle/packaging regressions, static checks, CI, and manually
  generated candidate artifacts with source, provenance and SHA-256 checksums.
- Correct fork metadata while preserving upstream authorship, GPL licensing and
  application/profile identifiers.

## 1.1.1 — baseline

Imported upstream-derived application at d131725. Prior upstream release history
and downloads belong to DomiLuebben/whatsapp-electron, not this fork's candidates.
