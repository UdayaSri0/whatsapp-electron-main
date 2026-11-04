#!/usr/bin/env bash
set -Eeuo pipefail

home_dir=/home/whatsapp-acceptance
results_file=$(mktemp /tmp/whatsapp-xvfb-results.XXXXXX)
chmod 644 "$results_file"
sudo chown whatsapp-acceptance:whatsapp-acceptance "$results_file"
trap 'rm -f "$results_file"' EXIT
fail() { printf 'FAIL: %s\n' "$*" >&2; }

smoke_status=0
sudo -u whatsapp-acceptance env -i \
    HOME="$home_dir" \
    PATH=/usr/local/bin:/usr/bin:/bin \
    XDG_CONFIG_HOME="$home_dir/.config" \
    XDG_DATA_HOME="$home_dir/.local/share" \
    XDG_CACHE_HOME="$home_dir/.cache" \
    RESULT_FILE="$results_file" \
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

        log_windows() {
            local label=$1 window=$2
            printf "DIAG %s window list (id desktop pid geometry wm-class host title):\n" "$label"
            wmctrl -lpGx
            printf "DIAG %s target properties:\n" "$label"
            xprop -id "$window" WM_NAME WM_CLASS 2>&1 || true
            printf "DIAG %s active=%s focus=%s\n" "$label" \
                "$(xdotool getactivewindow 2>/dev/null || echo unavailable)" \
                "$(xdotool getwindowfocus -f 2>/dev/null || echo unavailable)"
        }

        find_window() {
            local expected=$1 window title
            while IFS= read -r window; do
                title=$(xdotool getwindowname "$window" 2>/dev/null || true)
                if [[ "$title" == "$expected" ]]; then
                    printf '%s\n' "$window"
                    return 0
                fi
            done < <(xdotool search --onlyvisible --name . 2>/dev/null || true)
            return 1
        }

        wait_window() {
            local expected=$1 pid=$2 window=
            for _ in $(seq 1 40); do
                window=$(find_window "$expected")
                [[ -n "$window" ]] && { printf "%s\n" "$window"; return 0; }
                kill -0 "$pid" 2>/dev/null || return 1
                sleep 1
            done
            return 1
        }

        check_update_menu() {
            local variant=$1 expected_title=$2 expected_text=$3 window=$4
            local active focus dialog_window image recognized
            printf "DIAG %s activating window %s\n" "$variant" "$window"
            wmctrl -ia "$window"
            for _ in $(seq 1 20); do
                active=$(xdotool getactivewindow 2>/dev/null || true)
                [[ "$active" == "$window" ]] && break
                sleep 0.1
            done
            xdotool windowfocus --sync "$window" || true
            active=$(xdotool getactivewindow 2>/dev/null || true)
            focus=$(xdotool getwindowfocus -f 2>/dev/null || true)
            log_windows "$variant before-menu" "$window"
            if [[ "$active" != "$window" || -z "$focus" ]]; then
                printf "NOT VERIFIED: %s window could not be focused (active=%s focus=%s).\n" "$variant" "$active" "$focus" >&2
                return 1
            fi

            # Electron documents &Help as the Linux/Windows Alt+H menu accelerator.
            xdotool key --clearmodifiers alt+h
            sleep 0.25
            printf "DIAG %s after Alt+H active=%s focus=%s\n" "$variant" \
                "$(xdotool getactivewindow 2>/dev/null || echo unavailable)" \
                "$(xdotool getwindowfocus -f 2>/dev/null || echo unavailable)"
            xdotool key --clearmodifiers --delay 120 Home Return

            for _ in $(seq 1 15); do
                dialog_window=$(find_window "$expected_title")
                [[ -n "$dialog_window" ]] && break
                sleep 0.4
            done
            if [[ -z "$dialog_window" ]]; then
                printf "NOT VERIFIED: %s Help menu did not produce the expected dialog.\n" "$variant" >&2
                log_windows "$variant no-dialog" "$window"
                return 1
            fi

            # Capture only the static native update dialog, OCR it in memory,
            # and never print or upload the image or recognized text.
            image=$(mktemp --suffix=.png "${TMPDIR:-/tmp}/whatsapp-${variant}-dialog.XXXXXX")
            if ! import -window "$dialog_window" "$image" 2>/dev/null; then
                rm -f "$image"
                wmctrl -ic "$dialog_window" 2>/dev/null || true
                printf "NOT VERIFIED: %s update dialog could not be captured for text validation.\n" "$variant" >&2
                return 1
            fi
            recognized=$(tesseract "$image" stdout 2>/dev/null | tr "[:upper:]" "[:lower:]" | tr -s "[:space:]" " ") || recognized=
            rm -f "$image"
            if ! grep -Fq "$expected_text" <<<"$recognized"; then
                wmctrl -ic "$dialog_window" 2>/dev/null || true
                printf "NOT VERIFIED: %s update dialog did not contain the expected status text.\n" "$variant" >&2
                return 1
            fi
            printf "PASS: %s Help → Check for Updates displayed its expected status.\n" "$variant"
            xdotool key --clearmodifiers Escape
            sleep 0.25
        }

        : >"$RESULT_FILE"
        setsid /usr/bin/whatsapp >/dev/null 2>&1 &
        personal_pid=$!
        personal_window=$(wait_window "WhatsApp" "$personal_pid" || true)
        if [[ -n "$personal_window" ]]; then
            printf "PASS: Personal signed-out window started independently.\n"
            if check_update_menu Personal "Check for Updates" "you are using the latest matching release" "$personal_window"; then
                printf "Personal: PASS — current release status verified.\n" >>"$RESULT_FILE"
            else
                printf "Personal: NOT VERIFIED — Help menu or expected update status was not confirmed.\n" >>"$RESULT_FILE"
            fi
        else
            printf "Personal: NOT VERIFIED — signed-out window did not start.\n" >>"$RESULT_FILE"
            fail "Personal window did not appear"
        fi

        setsid /usr/bin/whatsapp-business-unofficial >/dev/null 2>&1 &
        business_pid=$!
        business_window=$(wait_window "Business Chat for WhatsApp (Unofficial)" "$business_pid" || true)
        if [[ -n "$business_window" ]]; then
            printf "PASS: Business signed-out window started independently.\n"
            if check_update_menu Business "Check for Updates" "public distribution is unauthorized" "$business_window"; then
                printf "Business: PASS — distribution restriction verified.\n" >>"$RESULT_FILE"
            else
                printf "Business: NOT VERIFIED — Help menu or restriction message was not confirmed.\n" >>"$RESULT_FILE"
            fi
        else
            printf "Business: NOT VERIFIED — signed-out window did not start.\n" >>"$RESULT_FILE"
            fail "Business window did not appear"
        fi

        [[ -d "$XDG_CONFIG_HOME/WhatsApp" && -d "$XDG_CONFIG_HOME/WhatsApp-Business-Unofficial" ]]
        [[ -f "$XDG_CONFIG_HOME/WhatsApp/Preferences" && -f "$XDG_CONFIG_HOME/WhatsApp-Business-Unofficial/Preferences" ]]
        grep -Fqx synthetic-personal-profile "$XDG_CONFIG_HOME/WhatsApp/acceptance-sentinel"
        grep -Fqx synthetic-business-profile "$XDG_CONFIG_HOME/WhatsApp-Business-Unofficial/acceptance-sentinel"
        grep -q "NOT VERIFIED" "$RESULT_FILE" && exit 1 || true
    ' || smoke_status=$?

if [[ ! -s "$results_file" ]]; then
    printf 'Personal: NOT VERIFIED — Xvfb or D-Bus session did not complete.\nBusiness: NOT VERIFIED — Xvfb or D-Bus session did not complete.\n' >"$results_file"
    smoke_status=1
fi
cat "$results_file"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
        printf '\n### Xvfb signed-out Electron menu check\n\n'
        sed 's/^/- /' "$results_file"
        printf '\n- LIMIT: Xvfb checks Electron menu input and static update-dialog text, not GNOME/KDE integration, real tray/notifications, Wayland, or hardware acceleration. Dialog-only temporary images were deleted; no screenshots or profile data were uploaded.\n'
    } >>"$GITHUB_STEP_SUMMARY"
fi

exit "$smoke_status"
