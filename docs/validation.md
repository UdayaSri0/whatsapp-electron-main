# Validation and delivery record

Date: 2026-10-22. Baseline `d131725221b31d8d55cb7d45ae3a0637e9943178`.
Feature branch: `feat/secure-linux-foundation`. Build host: Linux x86_64,
Node 24.19.0, npm 11.16.0. Baseline suite: 5/5 passed before implementation.

## Engineering and independent gates

Independent Security, Calling, Linux Integration, Release, Testing, Core
Engineering and Independent Review agents contributed actual audits, implementation or review.
The primary agent coordinated integration. Separate reviewers found the incorrect
`will-frame-navigate` callback signature and incomplete AppImage file handling;
both were fixed and regression tested. Native desktop-entry validation also found
a two-layer Exec escaping defect; the fix passed independent review and actual
harmless Gio launches for spaces, quotes, backslashes, dollar signs, backticks
and literal `%U` filenames. No real AppImage or user launcher was launched. A hypothesized mixed device/desktop media
bypass was investigated and withdrawn after checking Chromium's validation.

Current code-level coverage includes malicious/credential/alternate-port URLs,
exact main-window permission ownership, device type checks, wrong frames,
gesture checks, stale requests, cancelled/failed/concurrent source selection,
preferences corruption/atomic failures, monitor bounds, tray absence, early second
instances, startup guard ordering, retry reset/shutdown, identity opt-out,
packaged metadata/source archives and launcher rollback.

Mocks verify application decisions. They do not establish Electron's native
permission ordering, WebRTC behavior, capture contents, portal/tray availability
or notification delivery. Version-specific source review identified the capture
limitation documented in [security.md](security.md).

## Commands and results

- Baseline `npm test`: **5/5 PASS**.
- Expanded `npm test`: **47/47 PASS** after final dependency and desktop escaping changes.
- `npm run check`: **PASS** (supported Node gate, JavaScript and shell syntax).
- `git diff --check`: **PASS** after fixing a trailing blank line.
- Workflow YAML parsing: **PASS** (PyYAML BaseLoader); GitHub-hosted jobs also accepted the workflows.
- Initial `npm ci`: interrupted after extended registry stalls, **not passed**.
- Baseline `npm audit --json`: completed with exit 1, **19 advisories** (15 high,
  4 moderate); triggered targeted same-major maintenance. See packaging notes.
- Targeted update: exact Electron **43.7.0**, builder **26.15.3**, transitive
  Undici **7.30.1**. Independent engine and lock review passed.
- Final `npm audit --json`: completed exit 1, **8 moderate, 0 high/critical**.
  The eight affected entries trace to the `sprintf-js`/`roarr`/`global-agent`
  build-tool chain; automatic fixes suggest a builder downgrade and were not
  applied blindly. An earlier audit retry failed with ECONNRESET; the subsequent
  completed report is the result above.
- The original checkout is on exFAT (`findmnt`); an isolated symlink probe failed
  with **EPERM**. Installation attempts there were interrupted, not passed.
  `npm run build:dir` and `npm run build:deb` there both executed and exited 127
  (`electron-builder: not found`, incomplete installation).
- Clean installation and build retry use the identical source copy at
  `/tmp/whatsapp-foundation-build.QczR5p` on a native filesystem. Its clean
  installation **failed with `EIDLETIMEOUT`** downloading a locked registry
  dependency. Its directory/DEB commands also executed and exited 127 because
  the installer never reached binary-link creation.
- GitHub-hosted [run 39828510108](https://github.com/UdayaSri0/whatsapp-electron-main/actions/runs/39828510108)
  **PASSED** for code/build commit `3fea6a471c8d075d49b34955adffd8b55fb973b7`:
  clean `npm ci`, static checks and 46 tests on Node 22/24; directory and DEB
  builds plus `dpkg-deb` metadata/content inspection on Ubuntu 24.04.5 with
  Node 24.21.0/npm 11.19.0. It generated a 91,499,068-byte DEB.
  [Download validation artifact](https://github.com/UdayaSri0/whatsapp-electron-main/actions/runs/39828510108/artifacts/12446649906)
  (seven-day retention; ZIP SHA-256
  `a9fbdcb7d552744dd41cb238ace7477836a849f8b38acb144d4022b7e703596a`).
- Final desktop-path fix `91e7127` passed all 47 local tests, static checks,
  independent review and six actual harmless Gio launcher checks. Its CI
  [CI rerun 39829887263](https://github.com/UdayaSri0/whatsapp-electron-main/actions/runs/39829887263)
  **PASSED**: clean installs/checks/47 tests on both Node 22/24, directory/DEB
  builds, package inspection and upload.
  [Updated DEB artifact](https://github.com/UdayaSri0/whatsapp-electron-main/actions/runs/39829887263/artifacts/12447993248)
  expires 2026-10-29; ZIP SHA-256
  `362072daf413ff136203a0f1bbd30fe76b63010919b3b3353c551198c0399111`.
  [Corresponding tested source](https://github.com/UdayaSri0/whatsapp-electron-main/archive/91e71273c043eaa6ea60afe5a7a3c82ff13a4fb0.tar.gz).
  The final documentation commit also removes unverified calling claims from
  package descriptions. AppImage/RPM/Arch builds remain unverified.

## Required manual acceptance

Use the full [call/device matrix](calling-validation.md), in both browser modes,
and the [Linux packaging checklist](packaging.md). No account, physical media,
compositor, portal, visible tray provider, DEB/RPM installation or GPU coverage is
claimed. The environment has no `xvfb-run` or `rpmbuild`; a live Wayland/X11 session is
present, but this is not a distribution/device matrix. Do not run with
`--no-sandbox` to conceal a graphical/sandbox startup failure.

Before production distribution, screen capture needs an API/runtime with safe
modern-vs-legacy permission separation plus real X11/Wayland validation. Verify
messaging/session restoration and service-worker notifications too; no-owner
permission checks are intentionally denied.

## Ranked follow-up acceptance criteria

1. **Safe modern capture:** establish a supported distinguishable permission
   path, reject legacy capture, prove wrong-frame/cancel/navigation rejection
   and remotely verify actual screen/window contents on X11 and Wayland.
2. **Calling and native identity:** run all incoming/outgoing/group/background
   rows with two accounts and real devices; make native identity the default
   only once it passes without loss of messaging or login persistence.
3. **Linux desktop acceptance:** record Ubuntu/Mint, GNOME/KDE, Wayland/X11,
   available Intel/AMD/NVIDIA results for tray, notifications, launcher identity,
   multi-monitor restore and session-preserving package upgrade/uninstall.
4. **Dependency maintenance:** review remaining advisories and version-specific
   APIs; rerun clean install, tests and package validation with each update.
5. **Separate enhancements:** opt-in reversible autostart, advanced settings,
   multiple profiles and ARM64 only in separate tested contributions.
