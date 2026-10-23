# Security boundaries and capture limitation

The application trusts the live main window at exactly
`https://web.whatsapp.com`, including its default HTTPS port. It does not trust
other WhatsApp subdomains with device permissions. Both permission checks and
requests require that window, a main-frame request, and consistent requesting,
security and embedding origins when Electron supplies them. Requests without a
document owner, including service-worker and some notification checks, fail
closed; background web notifications therefore need desktop validation.

Explicit audio/video device requests may access microphone/camera. Unknown,
missing or empty media types are denied. Other allowed permissions are
notifications, fullscreen and sanitized clipboard writes. Access to location,
USB/HID, clipboard reading, arbitrary external protocols and persistent screen
permission is denied. Device permission grants trust WhatsApp's client code;
this application does not add its own camera/microphone confirmation dialog.

Renderer Node integration remains disabled, with context isolation, sandboxing
and web security enabled. The optional browser identity preload exposes no
privileged Electron or Node interfaces. Existing authentication/profile paths
remain unchanged. No account credentials, message automation or encryption
mechanisms are modified.

## Screen sharing is currently blocked in Electron 43.7.0

Do not interpret passing display-handler unit tests as working screen sharing.
The pinned runtime's source routes media requests through a permission check
**before** its display chooser. Both modern `getDisplayMedia()` and legacy
`getUserMedia({chromeMediaSource: ...})` requests reach the generic `media`
permission with empty `mediaTypes`. The legacy path bypasses the display handler
entirely and can capture the whole desktop without a source picker if granted.
There is no safe frame-bound approval token to establish inside the chooser
before this preceding permission decision. Empty media requests consequently
fail closed, blocking screen sharing on this runtime.

Mixed device/legacy-desktop constraints are also rejected by Chromium's
[stream-type validation](https://github.com/chromium/chromium/blob/150.0.7871.114/content/browser/renderer_host/media/media_stream_dispatcher_host.cc).
This browser-side restriction matters: Electron's device-only `mediaTypes`
would otherwise hide a desktop component combined with a normal device request.

Evidence: both the baseline Electron v43.1.1
[RequestMediaAccessPermission and MediaAccessAllowed](https://github.com/electron/electron/blob/v43.1.1/shell/browser/web_contents_permission_helper.cc)
and the updated
[Electron v43.7.0 source](https://github.com/electron/electron/blob/v43.7.0/shell/browser/web_contents_permission_helper.cc)
show the shared permission request followed by separate legacy/modern capture
branches. The updated
[permission manager](https://github.com/electron/electron/blob/v43.7.0/shell/browser/electron_permission_manager.cc)
sets `isMainFrame` and requesting URLs for requests/checks and audio/video types
for device checks. This version-specific behavior takes precedence over
[latest session documentation](https://www.electronjs.org/docs/latest/api/session),
which describes a distinct `display-capture` permission.
The same-major security update to 43.7.0 does not resolve this API limitation.

The separate display handler is hardened for a future verified safe API path:
it requires a user gesture, the current main frame, exact origin, and explicit
screen/window selection. It rejects cancellation and enumeration/dialog errors
with `callback(null)`, grants no system audio, allows only one pending picker,
and revalidates ownership after asynchronous work. Navigation, destruction,
renderer failure and window/frame replacement invalidate a pending request.
The selector intentionally does not infer consent from a single returned
PipeWire source. A portal dialog plus the application selector may both appear.

Enabling screen sharing requires a reviewed Electron version/API whose modern
capture permission can be distinguished safely from legacy capture, followed by
actual X11 and Wayland/PipeWire testing. Do not restore broad empty-media grants
to make the screen button work.

## Validation boundaries

Node tests inject Electron-shaped session/window/frame/desktop/dialog mocks.
They verify decision logic and asynchronous cancellation, not Chromium's actual
permission ordering, portal ownership, source contents or media hardware.
Microphone, camera, calling, notifications and desktop capture require the
manual account/device/desktop matrix before release acceptance.

The baseline follows Electron's
[official security recommendations](https://www.electronjs.org/docs/latest/tutorial/security).
Remote navigation is constrained to the Web client; external links use an
explicit HTTP(S)/mail/telephone allowlist. External programs remain an operating
system trust boundary. The app cannot protect against compromised local user
accounts or compromised trusted WhatsApp service code.
