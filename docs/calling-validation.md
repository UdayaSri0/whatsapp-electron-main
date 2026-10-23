# Calling and account acceptance — 1.2.0-rc.1

## Evidence and current status

WhatsApp's [July 28, 2026 announcement](https://blog.whatsapp.com/introducing-web-calling-on-whatsapp-plus-more-new-updates)
announces incoming/outgoing audio and video, individual/group calls and screen
sharing on WhatsApp Web, with gradual rollout. This confirms Web support; it
cannot prove support in this Electron wrapper or in a particular account.

No authenticated WhatsApp account, remote participant or real microphone/camera
call validation has been completed for this candidate. A successful UI smoke test
is not account or calling acceptance.
All runtime rows below remain **NOT RUN**. Unit tests establish policy and
identity isolation, not WebRTC interoperability or portal operation. Screen-sharing
rows are currently **BLOCKED** by the pinned runtime permission boundary described
in [security.md](security.md); they become acceptance checks after a safe API path
is available.

The inherited identity workaround remains enabled by default to avoid removing
an existing behavior without evidence. It is now isolated to the WhatsApp window
and HTTPS/WSS WhatsApp resource requests belonging to that window. The preload
only patches the exact `https://web.whatsapp.com` main frame. No application-wide
or session-wide user agent is changed. Requests without an attributable window
(such as some service-worker requests) retain their original headers; validate
this behavior with authenticated messaging and calls before a production release.

## Prepare privacy settings

Open Settings from the native menu even without a tray. Enable Allow microphone
for voice and Allow camera for video. Changing either reloads the page and ends
active calls once reload completes. Confirm denial with each switch disabled,
then enable and retry without deleting the linked profile. Copy Diagnostics from
Help records these settings but never certifies working hardware or calls.

## Compare ordinary identity first

Quit all instances, then run `WHATSAPP_BROWSER_IDENTITY=native npm start` to
leave Chromium/Electron's ordinary identity and Client Hints unchanged. For a
packaged executable, prefix its command with the same environment variable.
Use the existing profile; do not delete it or log out. Check messaging and QR
login/session restoration before testing calls. Record the exact Electron,
Chromium, app, distribution, session and portal versions, account call-button
availability, and whether a service-side rollout is suspected.

Quit and restart with the variable unset to compare inherited compatibility mode
using the same account and devices. If ordinary identity passes the full matrix
on representative Linux systems, make native identity the default in a reviewed
follow-up. Do not infer success from call buttons or a capture source alone.

Electron documents [page user-agent overrides](https://www.electronjs.org/docs/latest/api/web-contents#contentssetuseragentuseragent),
[session user-agent overrides](https://www.electronjs.org/docs/latest/api/session#sessetuseragentuseragent-acceptlanguages),
[request ownership](https://www.electronjs.org/docs/latest/api/web-request), and
[background throttling](https://www.electronjs.org/docs/latest/api/structures/web-preferences).
`backgroundThrottling: false` is retained; its presence alone is not proof of
background call reliability. No privileged bridge is exposed by the preload.

## Runtime matrix

Run every row in native and compatibility modes. Record NOT AVAILABLE rather
than PASS when WhatsApp does not expose a feature for the account.

| Scenario | Acceptance criterion | Result |
| --- | --- | --- |
| Existing login and messaging | Existing linked account restored; send/receive and attachments work | NOT RUN |
| New login | QR linking works without altered authentication | NOT RUN |
| Outgoing/incoming voice | Ringing, answer, reject and hangup; two-way audible audio for 10 minutes | NOT RUN |
| Outgoing/incoming video | Two-way audio/video; camera toggle, hangup; no unexpected camera activation | NOT RUN |
| Group voice/video | Join, participants, leave and rejoin where exposed by WhatsApp | NOT RUN |
| Background call | Continue a 10-minute call unfocused, minimized and hidden in tray; incoming ringing remains audible | NOT RUN |
| Microphone/camera missing | Useful web UI failure; application remains responsive | NOT RUN |
| Permission denied/recovery | Denial does not grant access; regrant via supported desktop settings and retry without relinking | NOT RUN |
| Device hotplug | Unplug/replug headset or camera; retry or switch using WhatsApp's controls | NOT RUN |
| Audio output | Select headset/speakers where WhatsApp/platform expose selection; remote party confirms audio | NOT RUN |
| Screen/window sharing | Explicit chooser; remote party sees intended live content; stop ends capture | NOT RUN |
| Screen-sharing cancel | Cancel portal/application picker; no capture indicator/track or remote content; retry works | NOT RUN |
| Multi-monitor sharing | Select each monitor/window; correct content and resolution observed remotely | NOT RUN |
| Network loss/recovery | Disconnect/reconnect; UI recovers without retry storms, logout or stale capture | NOT RUN |
| Reload/quit during capture | Sharing stops; no background camera/microphone use after quit | NOT RUN |

Cover Ubuntu and Mint, GNOME and KDE Plasma on both Wayland and X11 where
supported. Record Intel/AMD/NVIDIA hardware when available, without changing
system drivers or kernel/GPU settings. On Wayland verify PipeWire and the matching
XDG desktop portal backend are available in the user session. Confirm the picker
appears once, cancellation works, and the remote participant sees actual frames.
Portal or source enumeration success alone is insufficient.

Failures should include identity mode, OS/session/portal versions, reproduction,
non-sensitive application logs and the remote participant's observation. Do not
collect credentials, message contents, access tokens or raw profile directories.
