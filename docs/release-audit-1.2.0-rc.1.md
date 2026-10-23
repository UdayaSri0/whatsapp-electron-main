# GitHub release audit — 1.2.0-rc.1

Audit date: 2026-10-23. This record captures the current facts available before
release preparation. It does not itself authorize deletion, tagging or release.

## Repository state

| Ref | SHA | Ahead of main | Behind main |
| --- | --- | ---: | ---: |
| `main` | `83be73708c01414e363f49c3421ccabbd7abde26` | — | — |
| `feat/secure-linux-foundation` | `0ec99b9714a95a5ac667dea53f2c0f0424f22b76` | 0 | 6 |
| `feat/first-linux-release-candidate` | `8687f45a31d4632c2d437c65e0105351fcaf46a3` | 0 | 1 |

PR #1 and PR #2 are recorded as merged; PR #3 is a merged history PR. No tag
or GitHub release was visible in the supplied audit snapshot.

The two feature branches are deletion candidates only after a fresh live check
confirms they remain fully merged, unprotected, unchanged and unused by any
open PR. A local bundle was created before any cleanup attempt at:
`/tmp/whatsapp-electron-pre-release-2026-10-23.bundle`.

## CI and artifacts

- Main CI success: [run 39933715913](https://github.com/UdayaSri0/whatsapp-electron-main/actions/runs/39933715913)
- Temporary artifact: [artifact 12492916793](https://github.com/UdayaSri0/whatsapp-electron-main/actions/runs/39933715913/artifacts/12492916793)
- Artifact expiration reported as 2026-10-30 09:43 UTC.
- Temporary Actions artifacts are not permanent release assets.

## Acceptance status

Automated checks and packaging workflow evidence are distinct from authenticated
WhatsApp acceptance. QR login, messaging, attachments, session restoration,
notifications, real voice/video calls and hardware/compositor coverage remain
`NOT RUN` in the supplied snapshot. Screen sharing remains `BLOCKED` by design.

## Current blocker

The local GitHub CLI is unauthenticated. Until an authorized GitHub session is
available, remote branch deletion, PR creation/merge, tag push, workflow
dispatch, issue creation and prerelease publication must remain `BLOCKED`.
