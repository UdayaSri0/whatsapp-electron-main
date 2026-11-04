# Manual acceptance checklist

Run package-manager checks only in a disposable VM or container snapshot with a
dedicated test user and a fresh, temporary `XDG_CONFIG_HOME`. Never point a test
at an existing home directory, copy a real profile, or inspect credentials,
QR contents, cookies, messages, contacts or media. Restore the snapshot after
each install/upgrade/removal sequence.

The current status is **NOT RUN** unless a row says otherwise. Issue #5 has
Personal login/session/text boxes checked, but the published RC notes say those
checks were not verified. Treat that historical evidence as **BLOCKED** until
the records are reconciled. New account and live-service checks are also
**BLOCKED** until policy/legal review and any required written authorization are
complete. Even then, use only consenting test accounts and participants after
the account owner explicitly approves the test. No live test is authorized by
this checklist.

| Acceptance case | Personal | Business | Safe evidence / notes |
| --- | --- | --- | --- |
| Fresh launch, app name, icon, WM_CLASS and menu identity | NOT RUN | NOT RUN | Final AppImages started headlessly; this does not verify a graphical window, icon or menu |
| Simultaneous launch and separate profile directories | PASS | PASS | Final AppImages ran simultaneously for 15 seconds with separate temporary XDG config/data/cache roots; no account linked; runtime window identity not inspected |
| QR linking and initial session creation | BLOCKED | BLOCKED | Issue #5 marks Personal complete, but published RC notes say NOT verified. Reconcile evidence; Business also needs policy clearance and explicit account-owner approval. |
| Relaunch restores only that variant's linked session | BLOCKED | BLOCKED | Same conflicting historical Personal record; Business needs policy clearance and approval. Cross-variant logout independence remains NOT RUN. |
| Send and receive text messages | BLOCKED | BLOCKED | Same conflicting historical Personal record; Business needs policy clearance and two consenting participants. |
| Send and receive image and document attachments | BLOCKED | BLOCKED | Use non-sensitive test files only after authorization |
| Notification delivery, unread count and focus behavior | BLOCKED | BLOCKED | Requires linked account; inspect no message content in logs |
| Tray open, hide, restore, close-to-tray and quit behavior | NOT RUN | NOT RUN | Requires graphical desktop interaction; headless startup does not exercise tray behavior |
| Minimized incoming call ringing and restore | BLOCKED | BLOCKED | Requires authorized live call with consenting participant |
| Outgoing/incoming voice and video calls | BLOCKED | BLOCKED | Test microphone/camera, two-way audio/video and call teardown |
| Deny and re-enable microphone/camera permissions | NOT RUN | NOT RUN | Device permission UX may be checked without account; call recovery is BLOCKED |
| Disconnect network and recover | NOT RUN | NOT RUN | Local reconnect behavior may be checked signed out; message continuity is BLOCKED |
| Help → Check for Updates and opt-in setting | NOT RUN | NOT RUN | API-only Personal check returned `current`; Business returned `restricted`. Automated tests cover newer releases, offline/rate limits, safe links and opt-in. Menu interaction was not run. |
| Package names, executable paths, desktop files and icons | PASS | PASS | `dpkg-deb` metadata and payload inspection; identities are distinct. Desktop click/WM_CLASS/icon rendering remain NOT RUN. |
| Install both DEBs together; verify launcher and package identities | NOT RUN | NOT RUN | Dedicated GitHub Actions lifecycle workflow added; results remain blocked until a successful run on the trusted branch. |
| Upgrade each package over an older build | NOT RUN | NOT RUN | Workflow uses the published Personal RC1 package and a provenance-checked Business RC1 build from `c9d8601`; results remain blocked until it passes. |
| Remove one package while the other remains installed | NOT RUN | NOT RUN | Workflow executes real `apt-get remove` operations and checks alternatives, AppArmor profiles, desktop files and package-owned files. |
| Remove either package and preserve its user profile | NOT RUN | NOT RUN | Workflow uses synthetic profile sentinels only; results remain blocked until it passes. |
| X11, Ubuntu/Mint, KDE and available NVIDIA systems | NOT RUN | NOT RUN | Test only on available hardware; do not change drivers or security settings |

## Manual sequence after authorization

On 2026-11-04 the available host was Ubuntu 26.10 Wayland. VirtualBox 7.2.20
was installed, but its only registered VM was a powered-off GNS3 VM with no
snapshots; no Ubuntu 24.04 VM or ISO was available. The GNS3 VM was not touched.
The official Ubuntu 24.04.5.1 ISO transfer was too slow to complete, so no local
guest was created. No package manager was run against the host. The generated
DEB maintainer scripts invoke `update-alternatives` and register AppArmor
profiles, so real package-manager acceptance must run in the disposable
GitHub-hosted `ubuntu-24.04` runner described below.

## Automated isolated package acceptance

`.github/workflows/deb-acceptance.yml` runs only on pushes to the trusted
`feat/stable-update-hardening` branch in `UdayaSri0/whatsapp-electron-main`.
It has read-only repository permissions, checkout credentials are not persisted,
and it uses no repository secrets or artifact uploads. The runner builds both
RC2 DEBs from the checked-out commit, verifies their recorded commit and hashes,
then runs actual package-manager scripts inside the disposable hosted VM.

The lifecycle checks install each RC2 package, verify their coexistence and
distinct files, upgrade Personal from the published RC1 package and Business
from a source build at trusted `main` commit `c9d8601`, then remove each variant
independently. Synthetic profile sentinels verify that package removal does not
touch user data. The workflow also attempts signed-out Xvfb window startup and
the Help update-check menu in a fresh D-Bus session. The initial workflow run
must pass before those cases are marked PASS; no result is inferred from the
workflow definition alone.

1. Record distro/version, desktop, display server, GPU, package hash and source
   commit. Start from a disposable snapshot with separate empty profile paths.
2. Install both packages. Confirm their launcher names, window grouping, tray
   labels, executables and package-manager identities differ.
3. Link only with explicitly approved test accounts. Send a short text in both
   directions, then non-sensitive image and document fixtures.
4. Verify notifications, unread indicators, tray behavior, minimized incoming
   ringing, audio/video calls, and reconnect after a network interruption.
5. Quit and relaunch each app. Sign out of one and confirm the other remains
   linked. Record the result without capturing QR codes or private content.
6. Upgrade each variant separately, then remove each separately. Confirm the
   other variant's package and integration remain and both profile sentinels
   are unchanged. Revert the VM snapshot.
7. Record each case as PASS, FAIL, NOT RUN, BLOCKED or NOT AVAILABLE. Attach only
   sanitized diagnostics, package hashes and screenshots with all account data
   removed.
