#!/usr/bin/env bash
set -Eeuo pipefail

personal_rc1=${PERSONAL_RC1_DEB:?Missing verified Personal RC1 package}
business_rc1=${BUSINESS_RC1_DEB:?Missing provenance-checked Business RC1 package}
personal_rc2=${PERSONAL_RC2_DEB:?Missing Personal RC2 package}
business_rc2=${BUSINESS_RC2_DEB:?Missing Business RC2 package}
work_dir="${RUNNER_TEMP:-/tmp}/whatsapp-deb-acceptance"
home_dir=/home/whatsapp-acceptance

for package_file in "$personal_rc1" "$business_rc1" "$personal_rc2" "$business_rc2"; do
    test -f "$package_file"
done

sudo apparmor_status --enabled
sudo useradd --create-home --home-dir "$home_dir" --shell /bin/bash whatsapp-acceptance
sudo install -d -o whatsapp-acceptance -g whatsapp-acceptance \
    "$home_dir/.config/WhatsApp" "$home_dir/.config/WhatsApp-Business-Unofficial"
printf 'synthetic-personal-profile\n' | sudo tee "$home_dir/.config/WhatsApp/acceptance-sentinel" >/dev/null
printf 'synthetic-business-profile\n' | sudo tee "$home_dir/.config/WhatsApp-Business-Unofficial/acceptance-sentinel" >/dev/null
sudo chown -R whatsapp-acceptance:whatsapp-acceptance "$home_dir/.config"
mkdir -p "$work_dir"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
assert_version() {
    local package=$1 expected=$2 actual
    actual=$(dpkg-query -W -f='${Version}' "$package")
    [[ "$actual" == "$expected" ]] || fail "$package version is $actual; expected $expected"
}
assert_installed() {
    [[ "$(dpkg-query -W -f='${db:Status-Status}' "$1" 2>/dev/null || true)" == installed ]] \
        || fail "$1 is not installed"
}
assert_alternative() {
    local name=$1 target=$2
    sudo update-alternatives --query "$name" | grep -Fqx "Value: $target" \
        || fail "$name alternative does not resolve to its own executable"
    [[ "$(readlink -f "/usr/bin/$name")" == "$target" ]] || fail "/usr/bin/$name points elsewhere"
}
assert_profile_active() {
    local name=$1
    [[ -f "/etc/apparmor.d/$name" ]] || fail "AppArmor profile file missing: $name"
    sudo apparmor_status --show=profiles | grep -Eq "(^|[[:space:]])${name}([[:space:]]|$)" \
        || fail "AppArmor profile is not registered: $name"
}
assert_desktop_entry() {
    local path=$1 desktop_name=$2 executable=$3 wm_class=$4
    [[ -f "$path" ]] || fail "Desktop entry missing: $path"
    desktop-file-validate "$path"
    grep -Fqx "Name=$desktop_name" "$path" || fail "Unexpected launcher name in $path"
    grep -Fq "$executable" "$path" || fail "Unexpected launcher executable in $path"
    grep -Fqx "StartupWMClass=$wm_class" "$path" || fail "Unexpected launcher class in $path"
}
record_package_files() {
    local package=$1 destination=$2
    dpkg-query -L "$package" | while IFS= read -r path; do
        if [[ -f "$path" || -L "$path" ]]; then printf '%s\n' "$path"; fi
    done | sort -u >"$destination"
}
assert_no_orphaned_files() {
    local file_list=$1
    while IFS= read -r path; do
        [[ ! -e "$path" && ! -L "$path" ]] || fail "Package-owned file remains after removal: $path"
    done <"$file_list"
}
assert_package_files_present() {
    local file_list=$1
    while IFS= read -r path; do
        [[ -e "$path" || -L "$path" ]] || fail "Other variant lost a package-owned file: $path"
    done <"$file_list"
}
assert_profile_sentinels() {
    grep -Fqx synthetic-personal-profile "$home_dir/.config/WhatsApp/acceptance-sentinel" \
        || fail 'Personal synthetic profile was changed or removed'
    grep -Fqx synthetic-business-profile "$home_dir/.config/WhatsApp-Business-Unofficial/acceptance-sentinel" \
        || fail 'Business synthetic profile was changed or removed'
}
assert_package() {
    local variant=$1 version=$2
    if [[ "$variant" == personal ]]; then
        assert_installed whatsapp-electron
        assert_version whatsapp-electron "$version"
        assert_alternative whatsapp /opt/WhatsApp/whatsapp
        assert_profile_active whatsapp
        assert_desktop_entry /usr/share/applications/whatsapp.desktop \
            'WhatsApp (unofficial)' /opt/WhatsApp/whatsapp WhatsApp
    else
        assert_installed business-chat-for-whatsapp-unofficial
        assert_version business-chat-for-whatsapp-unofficial "$version"
        assert_alternative whatsapp-business-unofficial \
            '/opt/Business Chat for WhatsApp (Unofficial)/whatsapp-business-unofficial'
        assert_profile_active whatsapp-business-unofficial
        assert_desktop_entry \
            /usr/share/applications/com.udayasri0.business-chat-whatsapp-unofficial.desktop \
            'Business Chat for WhatsApp (Unofficial)' \
            '/opt/Business Chat for WhatsApp (Unofficial)/whatsapp-business-unofficial' \
            com.udayasri0.business-chat-whatsapp-unofficial
    fi
}
assert_removed() {
    local package=$1 name=$2 executable=$3 desktop=$4
    [[ "$(dpkg-query -W -f='${db:Status-Status}' "$package" 2>/dev/null || true)" != installed ]] \
        || fail "$package is still installed"
    [[ ! -e "$executable" && ! -L "$executable" ]] || fail "Executable remains: $executable"
    [[ ! -e "$desktop" && ! -L "$desktop" ]] || fail "Desktop file remains: $desktop"
    if sudo update-alternatives --query "$name" >/dev/null 2>&1; then
        fail "Alternative registration remains: $name"
    fi
    [[ ! -e "/etc/apparmor.d/$name" ]] || fail "AppArmor file remains: $name"
    local loaded_profile
    loaded_profile=$(sudo apparmor_status --show=profiles | grep -E "(^|[[:space:]])${name}([[:space:]]|$)" || true)
    if [[ -n "$loaded_profile" ]]; then
        printf 'Loaded AppArmor profile remained: %s\n' "$loaded_profile" >&2
        fail "Loaded AppArmor registration remains: $name"
    fi
}
remove_package() {
    local package=$1 name=$2 executable=$3 desktop=$4 files=$5
    record_package_files "$package" "$files"
    sudo apt-get remove -y "$package"
    assert_removed "$package" "$name" "$executable" "$desktop"
    assert_no_orphaned_files "$files"
}
assert_no_owned_file_overlap() {
    record_package_files whatsapp-electron "$work_dir/personal-files"
    record_package_files business-chat-for-whatsapp-unofficial "$work_dir/business-files"
    if comm -12 "$work_dir/personal-files" "$work_dir/business-files" | grep -q .; then
        comm -12 "$work_dir/personal-files" "$work_dir/business-files" >&2
        fail 'Personal and Business packages own the same non-directory file'
    fi
}

rc2_version=$(dpkg-deb -f "$personal_rc2" Version)
test "$rc2_version" = '1.2.0~rc.2' || fail "Unexpected RC2 version: $rc2_version"

echo 'Fresh install: Personal RC2'
sudo apt-get install -y --no-install-recommends "$personal_rc2"
assert_package personal "$rc2_version"

echo 'Fresh install: Business RC2 alongside Personal'
sudo apt-get install -y --no-install-recommends "$business_rc2"
assert_package personal "$rc2_version"
assert_package business "$rc2_version"
assert_no_owned_file_overlap

echo 'Independent removal: Personal leaves Business intact'
remove_package whatsapp-electron whatsapp /usr/bin/whatsapp \
    /usr/share/applications/whatsapp.desktop "$work_dir/personal-fresh-files"
assert_package business "$rc2_version"
assert_package_files_present "$work_dir/business-files"
assert_profile_sentinels

echo 'Reinstall Personal and independently remove Business'
sudo apt-get install -y --no-install-recommends "$personal_rc2"
assert_package personal "$rc2_version"
assert_package business "$rc2_version"
assert_no_owned_file_overlap
remove_package business-chat-for-whatsapp-unofficial whatsapp-business-unofficial \
    '/usr/bin/whatsapp-business-unofficial' \
    /usr/share/applications/com.udayasri0.business-chat-whatsapp-unofficial.desktop \
    "$work_dir/business-fresh-files"
assert_package personal "$rc2_version"
assert_package_files_present "$work_dir/personal-files"
assert_profile_sentinels

echo 'Independent removal: Personal leaves no package integrations'
remove_package whatsapp-electron whatsapp /usr/bin/whatsapp \
    /usr/share/applications/whatsapp.desktop "$work_dir/personal-fresh-files"
assert_profile_sentinels

echo 'Install RC1 candidates and upgrade both packages to RC2'
sudo apt-get install -y --no-install-recommends "$personal_rc1" "$business_rc1"
assert_version whatsapp-electron '1.2.0~rc.1'
assert_version business-chat-for-whatsapp-unofficial '1.2.0~rc.1'
sudo apt-get install -y --no-install-recommends "$personal_rc2" "$business_rc2"
assert_package personal "$rc2_version"
assert_package business "$rc2_version"
assert_no_owned_file_overlap

echo 'Remove Business after upgrade; Personal remains registered and runnable'
remove_package business-chat-for-whatsapp-unofficial whatsapp-business-unofficial \
    '/usr/bin/whatsapp-business-unofficial' \
    /usr/share/applications/com.udayasri0.business-chat-whatsapp-unofficial.desktop \
    "$work_dir/business-upgrade-files"
assert_package personal "$rc2_version"
assert_package_files_present "$work_dir/personal-files"
assert_profile_sentinels

echo 'Remove Personal after upgrade and verify profile data survives'
remove_package whatsapp-electron whatsapp /usr/bin/whatsapp \
    /usr/share/applications/whatsapp.desktop "$work_dir/personal-upgrade-files"
assert_profile_sentinels

echo 'Reinstall RC2 packages for the optional signed-out Xvfb smoke'
sudo apt-get install -y --no-install-recommends "$personal_rc2" "$business_rc2"
assert_package personal "$rc2_version"
assert_package business "$rc2_version"
if scripts/xvfb-smoke.sh; then
    xvfb_status=PASS
else
    xvfb_status=FAIL
    echo '::warning::Xvfb smoke did not complete; DEB lifecycle checks passed independently and report the graphical limitation.'
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    cat >>"$GITHUB_STEP_SUMMARY" <<'SUMMARY'
### Ubuntu 24.04 DEB lifecycle acceptance

- PASS: Fresh Personal and Business DEB installation and simultaneous coexistence.
- PASS: Package versions, executables, desktop entries, AppArmor profiles, and update-alternatives registration.
- PASS: Personal RC1 official release package and Business RC1 package built from trusted `main` commit upgraded to RC2.
- PASS: Independent removal, package-owned file cleanup, integration cleanup, and synthetic profile preservation.
SUMMARY
    printf '\n- %s: Xvfb signed-out window and Help-menu smoke; this does not test a real desktop environment.\n\nNo installer or profile artifacts were uploaded. The GitHub-hosted runner is discarded after the job.\n' \
        "$xvfb_status" >>"$GITHUB_STEP_SUMMARY"
fi

echo 'PASS: Ubuntu 24.04 package lifecycle acceptance completed.'
