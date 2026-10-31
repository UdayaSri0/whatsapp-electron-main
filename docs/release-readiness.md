# Release modes and distribution gates

## Current status

Current package version: `1.2.0-rc.1`. No stable release, public binary upload
or WhatsApp/Meta authorization is recorded. A release workflow can prepare a
**draft** only; a maintainer must review and manually publish it.

| Requirement | Status | Evidence / next action |
| --- | --- | --- |
| Personal and Business share one application implementation | PASS | `src/main.js` and immutable `config/variants.js` identities |
| Personal profile and install identity preserved in source configuration | PASS | Existing app ID, executable and `appData/WhatsApp` path retained |
| Separate package metadata and user-profile paths | PASS | Build verifier, DEB metadata and isolated profile-path tests |
| Personal-only asset mode | PASS | `npm run release:assets -- --mode personal` requires only Personal packages and rejects Business packages/provenance in `dist/` |
| Dual-variant asset mode requires explicit selection | PASS | `--mode dual` requires `--business-distribution-authorized`; workflow additionally requires a protected environment secret |
| Routine pull-request CI uploads binaries | PASS | CI builds and validates packages but uploads no artifacts |
| Public publication policy clearance for Personal wrapper | BLOCKED | Official policy review/legal advice required; being the existing Personal app does not establish third-party client support |
| Public Business distribution authorization | BLOCKED | No written WhatsApp/Meta authorization; keep `BUSINESS_DISTRIBUTION_AUTHORIZED` environment secret unset |
| Historical Personal QR/login/text checks | PASS* | Owner-marked in [issue #5](https://github.com/UdayaSri0/whatsapp-electron-main/issues/5) for the earlier `1.2.0-rc.1` candidate; not independently repeated on PR #6 |
| Business login and communication acceptance | BLOCKED | Requires policy clearance, any required written authorization, explicit account-owner approval and consenting test participants |
| Cross-variant logout/session isolation with linked accounts | NOT RUN | Must be verified after account-use authorization; no account was linked during this task |
| Real DEB package-manager install/upgrade/removal on target distros | NOT RUN | Use disposable VM/snapshot; package scripts must not run on the developer's host for this acceptance |
| Calls, notification and desktop matrix | NOT RUN | Follow [manual acceptance](manual-acceptance.md) |
| GPL source and original contributor notices | PASS | `LICENSE`, `NOTICE`, contributor metadata and source archive retained; recheck bundled dependency notices for each release |

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
Actual package-manager lifecycle acceptance remains NOT RUN and belongs in a
disposable VM that can be discarded.

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
