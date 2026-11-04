# Release modes and distribution gates

## Current status

Current package version: `1.2.0-rc.2`. The repository already has a public
Personal-only prerelease, `v1.2.0-rc.1` (published 2026-10-23), with Personal
DEB, AppImage and RPM assets. It predates PR #6; this change has not modified
that release. No stable release or Business binary is present, and no
WhatsApp/Meta authorization is recorded. The new workflow prepares a **draft**
only; a maintainer must review and manually publish it.

Current branch test, dependency and package evidence is recorded in
[stable update validation](stable-update-validation.md).

| Requirement | Status | Evidence / next action |
| --- | --- | --- |
| Personal and Business share one application implementation | PASS | `src/main.js` and immutable `config/variants.js` identities |
| Personal profile and install identity preserved in source configuration | PASS | Existing app ID, executable and `appData/WhatsApp` path retained |
| Separate package metadata and user-profile paths | PASS | Build verifier, DEB metadata and isolated profile-path tests |
| Personal-only asset mode | PASS | `npm run release:assets -- --mode personal` requires only Personal packages and rejects Business packages/provenance in `dist/` |
| Dual-variant asset mode requires explicit selection | PASS | `--mode dual` requires `--business-distribution-authorized`; workflow additionally requires a protected environment secret |
| Routine pull-request CI uploads binaries | PASS | CI builds and validates packages but uploads no artifacts |
| Manual update notifications | PASS | Fixed GitHub API endpoint, SemVer comparison, exact Personal asset names, opt-in daily checks default off; Business checks are restricted |
| Dependency audit | RISK ACCEPTANCE REQUIRED | 15 moderate development-tree records remain for GHSA-g3hv-75wg-m249; proposed disposition is code-merge-only acceptance, pending maintainer sign-off; see [dependency review](security-audit-stable-update.md) |
| Public publication policy clearance for Personal wrapper | BLOCKED | Official policy review/legal advice required; being the existing Personal app does not establish third-party client support |
| Public Business distribution authorization | BLOCKED | No written WhatsApp/Meta authorization; keep `BUSINESS_DISTRIBUTION_AUTHORIZED` environment secret unset |
| Historical Personal QR/login/text checks | BLOCKED | Issue #5 has these boxes checked, while the published RC notes say they were NOT verified; reconcile the evidence before treating them as PASS |
| Business login and communication acceptance | BLOCKED | Requires policy clearance, any required written authorization, explicit account-owner approval and consenting test participants |
| Cross-variant logout/session isolation with linked accounts | NOT RUN | Must be verified after account-use authorization; no account was linked during this task |
| Real DEB package-manager install/upgrade/removal on Ubuntu 24.04 | PASS | Disposable GitHub-hosted runner run [41779521078](https://github.com/UdayaSri0/whatsapp-electron-main/actions/runs/41779521078): fresh install, coexistence, RC1→RC2 upgrades, independent removal, integration cleanup and synthetic profile preservation passed |
| Xvfb window and Help update-menu smoke | NOT VERIFIED | Run 41780841459 launched both windows but did not open Personal's Help dialog and stopped before Business. The previous test assumed Alt+H despite no `&` mnemonic; the revised independent checks have not completed. See [manual acceptance](manual-acceptance.md). |
| Calls, notifications and real desktop matrix | NOT RUN | Follow [manual acceptance](manual-acceptance.md); live account checks require policy clearance and account-owner approval |
| GPL source and original contributor notices | PASS | `LICENSE`, `NOTICE`, contributor metadata and source archive retained; recheck bundled dependency notices for each release |

## Acceptance recommendation

- **Code merge: READY FOR CODE MERGE.** Node 22/24 tests and package CI pass;
  the independent review found no code findings. The 15 moderate build-tree
  minimatch records are documented. Proposed maintainer disposition: accept
  this build/CI availability risk for code merge only; no maintainer sign-off
  has been recorded yet, and this is not release risk acceptance.
- **Personal prerelease: BLOCKED.** Real Ubuntu 24.04 DEB lifecycle passes, but
  the Xvfb Help update-menu check failed and native desktop launcher, tray,
  notification and linked-account checks remain incomplete. Personal
  publication policy clearance is also unresolved.
- **Dual release: BLOCKED.** Personal acceptance blockers remain, and written
  Business distribution authorization plus protected-environment review are
  absent. Keep the Business distribution secret unset.

## What can be checked without a live account

These checks do not link an account and are safe to run locally or in CI:

- lint/static checks, unit tests, identity and profile-path assertions;
- build output names, package metadata, desktop launchers, checksums and source
  commit provenance;
- temporary-root package payload, upgrade-overlay and removal simulations;
- signed-out startup, menus, tray, local permission denial UI and XDG path
  selection, provided the test uses a disposable profile and does not link in;
- visual inspection of original icon artwork and package contents.

`npm run test:packages` unpacks DEB payloads under a newly created directory in
the OS temporary directory. It simulates package install, higher-version
payload overlay and package-owned-file removal there, with synthetic profile
sentinels. It does **not** run Debian maintainer scripts or invoke `dpkg -i` on
the host. Removal scripts are inspected statically by `npm run verify:packages`.
Actual local package-manager lifecycle acceptance remains NOT RUN, to avoid
changing the developer host. The dedicated trusted-branch GitHub Actions
workflow completed real install, upgrade and removal scripts in an ephemeral
`ubuntu-24.04` runner; run 41779521078 passed and is recorded in the manual
acceptance checklist. CI built the RC2 DEBs from commit
`de4aa85d1f0f79e6f6f361a3d522fd49be666906` and verified embedded commit/hash
provenance. No packages or sensitive diagnostics were uploaded from that run.

## Checks requiring further authorization

The current [WhatsApp linked-device guidance](https://faq.whatsapp.com/378279804439436/)
lists supported linking routes and warns that unofficial apps or websites are
unsupported and may risk account bans. The [Terms of Service](https://www.whatsapp.com/legal/terms-of-service)
also restrict unauthorized use and non-personal use absent authorization.
This Electron wrapper is third-party software even though it loads
`https://web.whatsapp.com/`; official Web content does not make the wrapper an
official supported client. This is a policy risk assessment, not legal advice.

Before either variant is linked to a real account, obtain appropriate legal
review and written authorization where required, then obtain the account
owner's explicit approval and use consenting test participants. The same
unsupported-client warning can apply to Personal as well as Business. The
Personal-only mode limits which binaries are prepared; it does not grant
WhatsApp permission or establish that public distribution complies with its
policies.

Before public Business distribution, the repository must have a protected
GitHub environment named `business-distribution`, configured with required
reviewers, and the environment secret `BUSINESS_DISTRIBUTION_AUTHORIZED` set to
the exact value `true` only after written authorization has been reviewed.
Neither is configured by this change. The dual mode is therefore fail-closed
in the current repository. Do not set the secret until the authorization
condition is met.

The project source remains GPL-2.0-or-later and retains upstream attribution.
That license covers the wrapper source, not WhatsApp's marks, Web service,
Electron/Chromium third-party notices, or permission to distribute a client of
that service. Each release still needs corresponding source and license
materials, third-party notices, trademark review and policy clearance.

## Release workflow

`Prepare gated draft release` is manually dispatched with an existing tag and
an explicit `personal` or `dual` mode. It verifies that the tag matches
`package.json`, runs checks, builds only the selected variant set, verifies
package isolation and provenance, and creates a GitHub **draft** with only
those selected assets. Drafts are not public releases. Publishing a reviewed
draft remains a separate maintainer action.

The dual workflow uses the protected `business-distribution` environment and
fails unless its authorization secret is set. Configure required reviewers on
that environment in GitHub settings; repository workflow files cannot enforce
an environment's reviewer configuration by themselves. The manual candidate
workflow uses the same gate before uploading temporary Actions artifacts. CI
never uploads package artifacts.

The next candidate is `1.2.0-rc.2`; `v1.2.0-rc.1` and its assets remain
unchanged. This version bump does not create a tag or authorize a release.

To prepare assets locally from a clean committed tree:

```bash
npm run build:personal
npm run verify:packages:personal
npm run release:assets -- --mode personal

# Only after authorization is secured:
npm run build:all
npm run release:assets -- --mode dual --business-distribution-authorized
```

The CLI acknowledgement only records explicit operator intent; it is not proof
of authorization. The protected GitHub environment secret is an additional
dual-upload gate. Never publish a public Business draft until the authorization
and manual acceptance blockers above are resolved.
