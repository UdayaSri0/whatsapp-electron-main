# Update notifications

Use **Help → Check for Updates** for a manual check. The app requests the
public GitHub Releases API for `UdayaSri0/whatsapp-electron-main` over HTTPS,
with a short timeout and redirects disabled. It compares versions using
SemVer precedence, including prerelease identifiers; build metadata does not
change precedence and is retained in valid release links. It only recognizes
an exact artifact name defined for the installed variant.
Drafts and releases without a matching package are ignored. The release page
link is constructed for this repository and opened through the app's existing
external-link policy.

The check sends the app version and variant only as local matching inputs; no
variant, profile path, chat, contact, session token, cookie, account detail or
telemetry is sent. The HTTPS request includes no credentials or cookies. GitHub
rate limits, timeouts, offline errors, missing releases and malformed responses
produce a clear result and do not interrupt the app.
GitHub `403`/`429` primary and secondary rate-limit responses are recognized; the
app does not retry an API request after a rate-limit response. See GitHub's
[REST API rate-limit guidance](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api).

An available update opens its GitHub release page when selected. The app never
downloads or runs an installer, requests administrator privileges, invokes a
shell installation command or changes profile data. Release assets should be
checked against the published SHA-256 before installation.

## Automatic checks

Automatic daily checks are **off by default**, including for existing profiles.
To opt in, select **Settings → Automatically check for updates**. The app checks
once at startup and then at most once per day while it is running. Disable the
setting to stop the checks. No background service or scheduled OS job is
installed. If enabled, an available update is shown in the same native dialog;
offline and rate-limit results do not produce recurring error dialogs.

The Business variant is currently distribution-restricted. Its check returns
without contacting the API and does not identify or advertise Business assets.
This remains closed until a reviewed code change follows written distribution
authorization. A CLI acknowledgement or existence of a GitHub asset does not
establish authorization.

## Installing manually

- **DEB:** download the matching Personal `.deb`, verify its checksum, then use
  the Debian/Ubuntu package manager to install or upgrade it. Package-manager
  upgrades preserve the existing profile.
- **RPM:** download the matching Personal `.rpm`, verify its checksum, then use
  the target distribution's package manager to install or upgrade it.
- **AppImage:** quit the app, download and verify the matching Personal image,
  then replace the old file. If you move it, review any explicit autostart or
  desktop-shortcut path.

The notification feature does not claim silent Linux updates. See
[packaging](packaging.md) for full build, install and removal guidance and
[release readiness](release-readiness.md) for distribution restrictions.
