#!/usr/bin/env bash
set -Eeuo pipefail

home_dir=/home/whatsapp-acceptance
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

sudo -u whatsapp-acceptance env -i \
    HOME="$home_dir" \
    PATH=/usr/local/bin:/usr/bin:/bin \
    XDG_CONFIG_HOME="$home_dir/.config" \
    XDG_DATA_HOME="$home_dir/.local/share" \
    XDG_CACHE_HOME="$home_dir/.cache" \
    xvfb-run -a -s '-screen 0 1280x800x24 -nolisten tcp' \
    dbus-run-session -- /bin/bash -euo pipefail -c '
        ulimit -c 0
        openbox >/dev/null 2>&1 &
        wm_pid=$!
        personal_pid=
        business_pid=
        cleanup() {
            [[ -z "$personal_pid" ]] || kill -- "-$personal_pid" 2>/dev/null || true
            [[ -z "$business_pid" ]] || kill -- "-$business_pid" 2>/dev/null || true
            kill "$wm_pid" 2>/dev/null || true
        }
        trap cleanup EXIT
        sleep 2

        setsid /usr/bin/whatsapp >/dev/null 2>&1 &
        personal_pid=$!
        personal_window=
        for _ in $(seq 1 40); do
            personal_window=$(xdotool search --onlyvisible --name "WhatsApp" 2>/dev/null | head -n 1 || true)
            [[ -z "$personal_window" ]] || break
            kill -0 "$personal_pid" || exit 1
            sleep 1
        done
        [[ -n "$personal_window" ]] || { echo "Personal window did not appear" >&2; exit 1; }

        setsid /usr/bin/whatsapp-business-unofficial >/dev/null 2>&1 &
        business_pid=$!
        business_window=
        for _ in $(seq 1 40); do
            while IFS= read -r window; do
                [[ -n "$window" && "$window" != "$personal_window" ]] && business_window=$window
            done < <(xdotool search --onlyvisible --name "WhatsApp" 2>/dev/null || true)
            [[ -z "$business_window" ]] || break
            kill -0 "$business_pid" || exit 1
            sleep 1
        done
        [[ -n "$business_window" ]] || { echo "Business window did not appear independently" >&2; exit 1; }

        open_update_dialog() {
            local window=$1 dialog_window=
            wmctrl -ia "$window"
            xdotool key --clearmodifiers F10
            sleep 0.4
            xdotool key --clearmodifiers Right Right Right Right Down Return
            for _ in $(seq 1 12); do
                dialog_window=$(xdotool search --onlyvisible --name "Check for Updates" 2>/dev/null | head -n 1 || true)
                [[ -z "$dialog_window" ]] || break
                sleep 1
            done
            if [[ -z "$dialog_window" ]]; then
                wmctrl -ia "$window"
                xdotool key --clearmodifiers alt+h
                sleep 0.4
                xdotool key --clearmodifiers Down Return
                for _ in $(seq 1 12); do
                    dialog_window=$(xdotool search --onlyvisible --name "Check for Updates" 2>/dev/null | head -n 1 || true)
                    [[ -z "$dialog_window" ]] || break
                    sleep 1
                done
            fi
            [[ -n "$dialog_window" ]] || {
                echo "Help update check dialog did not appear; visible window titles:" >&2
                wmctrl -l >&2
                return 1
            }
            xdotool key --clearmodifiers Escape
            sleep 0.4
        }

        open_update_dialog "$personal_window"
        open_update_dialog "$business_window"
        kill -0 "$personal_pid"
        kill -0 "$business_pid"
        [[ -d "$XDG_CONFIG_HOME/WhatsApp" && -d "$XDG_CONFIG_HOME/WhatsApp-Business-Unofficial" ]]
        [[ -f "$XDG_CONFIG_HOME/WhatsApp/Preferences" ]]
        [[ -f "$XDG_CONFIG_HOME/WhatsApp-Business-Unofficial/Preferences" ]]
        grep -Fqx synthetic-personal-profile "$XDG_CONFIG_HOME/WhatsApp/acceptance-sentinel"
        grep -Fqx synthetic-business-profile "$XDG_CONFIG_HOME/WhatsApp-Business-Unofficial/acceptance-sentinel"
    ' || fail 'Xvfb signed-out window or Help → Check for Updates smoke failed'

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    cat >>"$GITHUB_STEP_SUMMARY" <<'SUMMARY'

### Xvfb signed-out graphical smoke

- PASS: Both installed binaries displayed independent windows in Xvfb under a fresh user D-Bus session.
- PASS: Keyboard Help → Check for Updates opened and dismissed a dialog in each variant.
- PASS: The application profiles remained separate and synthetic sentinels were preserved.
- LIMIT: This does not exercise GNOME/KDE trays, notifications, Wayland, GPU acceleration, or real desktop integration. No screenshots or profile data were captured or uploaded.
SUMMARY
fi

echo 'PASS: Xvfb signed-out window and Help-menu smoke completed; real desktop integration remains untested.'
