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
| Fresh launch, app name, icon, executable, WM_CLASS and menu identity | NOT RUN | NOT RUN | In snapshot; do not log in |
| Simultaneous launch and separate profile directories | PASS | PASS | AppImage startup on Ubuntu 26.10 GNOME Wayland; temporary shared XDG root; no account linked |
| QR linking and initial session creation | BLOCKED | BLOCKED | Issue #5 marks Personal complete, but published RC notes say NOT verified. Reconcile evidence; Business also needs policy clearance and explicit account-owner approval. |
| Relaunch restores only that variant's linked session | BLOCKED | BLOCKED | Same conflicting historical Personal record; Business needs policy clearance and approval. Cross-variant logout independence remains NOT RUN. |
| Send and receive text messages | BLOCKED | BLOCKED | Same conflicting historical Personal record; Business needs policy clearance and two consenting participants. |
| Send and receive image and document attachments | BLOCKED | BLOCKED | Use non-sensitive test files only after authorization |
| Notification delivery, unread count and focus behavior | BLOCKED | BLOCKED | Requires linked account; inspect no message content in logs |
| Tray open, hide, restore, close-to-tray and quit behavior | NOT RUN | NOT RUN | Test GNOME/KDE where available; no account needed for shell behavior |
| Minimized incoming call ringing and restore | BLOCKED | BLOCKED | Requires authorized live call with consenting participant |
| Outgoing/incoming voice and video calls | BLOCKED | BLOCKED | Test microphone/camera, two-way audio/video and call teardown |
| Deny and re-enable microphone/camera permissions | NOT RUN | NOT RUN | Device permission UX may be checked without account; call recovery is BLOCKED |
| Disconnect network and recover | NOT RUN | NOT RUN | Local reconnect behavior may be checked signed out; message continuity is BLOCKED |
| Help → Check for Updates and opt-in setting | NOT RUN | NOT RUN | Verify offline/rate-limit messaging, Personal asset match, Business restriction, and that automatic checks stay off until enabled; do not install from the prompt |
| Install both DEBs together; verify launcher and package identities | NOT RUN | NOT RUN | Disposable VM only; no host package database changes |
| Upgrade each package over an older build | NOT RUN | NOT RUN | Snapshot rollback; verify package paths and test profile sentinel survive |
| Remove one package while the other remains installed | NOT RUN | NOT RUN | Snapshot rollback; verify the other launcher and profile sentinel survive |
| Remove either package and preserve its user profile | NOT RUN | NOT RUN | Use a synthetic sentinel in temporary XDG storage, never a real profile |
| X11, Ubuntu/Mint, KDE and available NVIDIA systems | NOT RUN | NOT RUN | Test only on available hardware; do not change drivers or security settings |

## Manual sequence after authorization

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
