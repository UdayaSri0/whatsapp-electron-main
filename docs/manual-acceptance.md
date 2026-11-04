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
| Help → Check for Updates status | PASS (Xvfb) | PASS (Xvfb) | Run [41792547119](https://github.com/UdayaSri0/whatsapp-electron-main/actions/runs/41792547119) independently opened both menus and verified Personal's current-release text and Business's distribution-restricted text. Native GNOME/KDE menu rendering and desktop integration remain NOT RUN. |
| Package names, executable paths, desktop files and icons | PASS | PASS | `dpkg-deb` metadata and payload inspection; identities are distinct. Desktop click/WM_CLASS/icon rendering remain NOT RUN. |
| Install both DEBs together; verify launcher and package identities | PASS | PASS | GitHub Actions run [41792547119](https://github.com/UdayaSri0/whatsapp-electron-main/actions/runs/41792547119), Ubuntu 24.04 disposable runner: installed RC2 packages together, verified versions, unique executable/desktop identities, alternatives and AppArmor registration. This does not verify click-to-launch or icon rendering in GNOME/KDE. |
| Upgrade each package over an older build | PASS | PASS | Same run upgraded Personal from the SHA256-verified published RC1 DEB and Business from a source build at trusted `main` commit `c9d8601` to RC2. |
| Remove one package while the other remains installed | PASS | PASS | Same run performed independent removals in both orders; checked the remaining variant's files and integration entries, then checked cleanup of package-owned files, desktop entries, alternatives and AppArmor registrations. `update-alternatives` emitted transient dangling-link cleanup warnings; final state assertions passed. |
| Remove either package and preserve its user profile | PASS | PASS | Same run used synthetic profile sentinels; both survived package removal. No real user profile or credentials were used. |
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
then runs actual package-manager scripts inside the disposable hosted VM. Run
[41792547119](https://github.com/UdayaSri0/whatsapp-electron-main/actions/runs/41792547119)
on 2026-11-04 passed the lifecycle checks on committed source
`90bdbdb002db7f01dea78cc7a32390eac9a03319`. The full test suite also passed
after package creation on Node 22 (97/97) and Node 24 (97/97).

The lifecycle checks installed each RC2 package, verified their coexistence
and distinct files, upgraded Personal from the published RC1 package and
Business from a source build at trusted `main` commit `c9d8601`, then removed
each variant independently. Synthetic profile sentinels survived removal. The
workflow also attempted signed-out Xvfb window startup and the Help update-check
menu in a fresh D-Bus session. Run 41780841459 found both windows but did not
open the Personal dialog; the old test tried Alt+H without a menu mnemonic and
used an unchecked fixed F10/arrow sequence. That was a test activation flaw;
there was no evidence of an application update-handler defect. The application
now marks Help with Electron's documented Alt+H mnemonic. The revised test
records title, WM_CLASS, active window and focus, checks Personal and Business
independently, and validates each static update dialog's expected text from a
temporary dialog-only image that is deleted. After two result-file permission
failures, runner-owned output capture succeeded in run 41792547119: Personal
displayed “You are using the latest matching release.” and Business displayed
the public-distribution restriction. Both Xvfb menu checks are PASS. This is
real Electron menu interaction under Xvfb, not a GNOME/KDE desktop test. Xvfb
does not verify GNOME/KDE trays, notifications, Wayland behavior or hardware
acceleration. No screenshots or account data were uploaded.

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
