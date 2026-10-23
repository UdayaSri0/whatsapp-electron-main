# Foundation audit — 2026-10-22

Baseline: `d131725221b31d8d55cb7d45ae3a0637e9943178`, local and remote default
branch `main`; clean initial tree; version 1.1.1. Reviewed all three source
modules, dependency manifest and lockfile (including resolved versions and engine
requirements), existing five security tests, README, GPL text, Node gate,
Arch recipe, launcher, desktop entry and Git history before implementation.
No existing CI. Public GitHub API review found one initial commit, only the main
branch, and no issues or PRs (including closed) on 2026-10-22.

## Verified defects

- Permission checks ignore the owning webContents, while request handlers only
  check ownership at request time. Origin allowlist includes every WhatsApp
  subdomain and alternate ports rather than the Web application origin.
- Screen selection checks origin and gesture, but not requesting frame/owner,
  frame lifecycle or navigation while awaiting enumeration/confirmation.
- Legacy ambiguous media requests need fail-closed handling; a generic media
  grant must never become an implicit desktop grant.
- User-agent overrides affect app/session globally; preload identity patch has
  no origin or main-frame guard. The existing workaround is not runtime-proven
  obsolete and must remain selectable until comparison testing is performed.
- Tray construction is unguarded. Close-to-tray and start-minimized assume a
  usable tray. Successful construction itself cannot prove a visible tray host.
- Preferences accept malformed geometry, and retry/lifecycle code is embedded
  in main.js without regression coverage. Preferences use atomic replacement
  already; preserve that behavior and existing profile and settings paths.
- Automatic AppImage integration overwrites a predictable user launcher on
  startup without consent. Desktop Exec percent field-code escaping is missing;
  native validation also confirmed incorrect escaping across both parsing layers.
- Manifest ownership URLs still point at upstream; packaged file list omits
  wrapper LICENSE. Preserve original author and GPL-2.0-or-later attribution.
- README claims working calling based on compatibility code, without actual
  account/device/platform acceptance evidence.

## Preserved boundaries

Sandbox enabled globally and per renderer; context isolation and web security
are on; Node integration is off. No privileged bridge is exposed to WhatsApp.
External protocols are allowlisted; webviews and new windows are denied.
The profile identity (`WhatsApp`), app ID and persistent default session must
remain unchanged. Do not modify authentication, messages or encryption.

## Evidence and uncertainty

Baseline tests will be recorded separately from the expanded suite. Host Node
is 24.19.0/npm 11.16.0. The original lock used Electron 43.1.1 and builder
26.11.1; targeted maintenance after the dependency audit is recorded below. Native Chromium vs
compatibility mode, real media devices, portal cancellation and background calls
require graphical/account validation. Screen source enumeration alone proves
nothing about actual sharing. No distribution, GPU or compositor matrix is
claimed tested by mocks.

Security baseline: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security),
[session permissions and capture](https://www.electronjs.org/docs/latest/api/session),
[webContents navigation](https://www.electronjs.org/docs/latest/api/web-contents).
Version-specific Electron 43 API/source behavior takes precedence over newer docs.


## Dependency maintenance decision — 2026-10-22

The completed baseline `npm audit --json` reported 19 affected dependency entries:
15 high and 4 moderate. This is not a count of independent exploitable application
paths. Electron itself is shipped in binary packages; many builder findings affect
build-time tooling. Do not dismiss them solely because package.json lists Electron
under devDependencies.

After reviewing the published releases and security advisories, the selected
same-major updates are exact pins Electron **43.7.0** and electron-builder
**26.15.3**. Keeping Electron 43 and builder 26 limits architectural changes and
keeps the existing build-host Node 22.12+/24 support policy. Exact pins and the
regenerated lock make the candidate reviewable. These changes still require a
clean installation, regression tests, packaging and graphical acceptance; staying
within a major version does not establish runtime compatibility.

[Electron 43.7.0 release notes](https://github.com/electron/electron/releases/tag/v43.7.0)
include frame validation and display-handler lifetime fixes. Relevant baseline
advisories include [sandboxed child windows](https://github.com/advisories/GHSA-gr2m-v5gq-v685)
and [sandboxed preload cache poisoning](https://github.com/advisories/GHSA-qmv3-fv6v-rmhq).
The [builder 26.15.3 release](https://github.com/electron-userland/electron-builder/releases/tag/electron-builder%4026.15.3)
updates its dependency chain; the baseline builder runtime was affected by
[cross-origin credential forwarding](https://github.com/advisories/GHSA-p2f4-r6v6-j797).
The application does not configure an automatic updater. Other baseline findings
include XML/glob parsing, HTTP tooling and archive processing and must be checked
against the regenerated lock rather than assumed fixed by these two upgrades.

Permission-flow review against Electron 43.7.0 does not justify enabling automatic
screen capture. The application continues to deny display capture at the shared
permission boundary until an unambiguous explicit-selection path is verified.
A post-update audit and real installation/build evidence must be recorded in the
validation report; this decision does not claim zero remaining vulnerabilities.
