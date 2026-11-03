# Dependency security review — stable update hardening

Reviewed 2026-11-04 against `npm audit` after upgrading Electron to 43.8.6 and
electron-builder to 26.18.1. Result: **15 moderate npm audit records, zero high
or critical**. All records trace to [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
(CVE-2026-118764), a **moderate** (CVSS v4 6.9, CWE-405) minimatch denial of
service through globparts amplification. The common available patched version
is `minimatch@11.0.1`; audited parent packages do not all declare this major
compatible, and npm reports no non-breaking fix for this tree. The advisory lists
`<11.0.1` as affected. Its technical
description identifies attacker-controlled pattern expansion and quadratic
follow-up work; GitHub's range is broader than the version named in that
description, so this report retains npm's full affected range rather than
assuming older API generations are safe.

Every affected package is a transitive dependency of the direct development
dependency `electron-builder`; none is a production dependency. These modules
are not copied into the packaged WhatsApp application. They are reachable
during packaging while filtering/crawling files and constructing archives.
Patterns in this repository's build config are fixed, but CI builds repository
content, so the advisory remains an actionable build/CI availability risk. This
is not a reason to call the findings harmless.

| npm audit record | Direct? | Installed route / flagged minimatch version | Exposure, fix and decision |
| --- | --- | --- | --- |
| `@electron/asar` | Transitive | `@electron/asar` → `minimatch@3.1.5` and `glob@7.2.3` → `minimatch@3.1.5` | Development archive creation; not shipped in app. Advisory patch is `minimatch@11.0.1`; API-major replacement risks `@electron/asar` callers. **Unresolved; no override.** |
| `@electron/universal` | Transitive | `@electron/universal` → `minimatch@9.0.9`, plus `dir-compare@4.2.0` → `minimatch@3.1.5` | Development packaging/comparison; not shipped. Requires compatible parent release or verified major override. **Unresolved.** |
| `app-builder-lib` | Transitive | Direct `minimatch@10.2.6`; also depends on the affected archive/universal paths | Development file matching and packaging; not shipped. `electron-builder@26.18.1` still declares `minimatch@^10.2.5`; replacing it with 11 crosses the declared major. **Unresolved.** |
| `dir-compare` | Transitive | `dir-compare@4.2.0` → `minimatch@3.1.5` | Development comparison helper; not shipped. Requires compatible patched parent or tested override. **Unresolved.** |
| `dmg-builder` | Transitive | `dmg-builder@26.18.1` → `app-builder-lib` and its affected minimatch tree | Development-only macOS builder is not used by Linux targets; not shipped. Transitive record remains in the install tree. **Unresolved, low reachability for this Linux project.** |
| `ejs` | Transitive | `ejs@3.1.10` → `jake@10.9.4` → `filelist@1.0.6` → `minimatch@5.1.9` | Development template/build helper; not shipped. Upgrade the chain or test a major override. **Unresolved.** |
| `electron-builder` | Direct dev dependency | `electron-builder@26.18.1` → affected `app-builder-lib` and `dmg-builder` | Build-time only, not app runtime. Upgraded from 26.15.3 to the latest 26.x patch; official notes list patch dependency updates. It still contains affected minimatch, so the audit count did not fall. **Unresolved.** |
| `electron-builder-squirrel-windows` | Transitive | Builder's Windows-only package → `app-builder-lib` and `electron-winstaller` | Not used by Linux targets and not shipped. Remains in the dev dependency tree. **Unresolved, low reachability for supported targets.** |
| `electron-winstaller` | Transitive | Builder's Windows-only path → `@electron/asar` and `temp` → `rimraf` → `glob` → minimatch | Not used by Linux targets and not shipped. **Unresolved, low reachability for supported targets.** |
| `filelist` | Transitive | `filelist@1.0.6` → `minimatch@5.1.9` | Development build-file matching; not shipped. Parent upgrade/major override needs tests. **Unresolved.** |
| `glob` | Transitive | `glob@7.2.3` → `minimatch@3.1.5` | Development archive crawling; not shipped. Parent upgrade/major override needs tests. **Unresolved.** |
| `jake` | Transitive | `jake@10.9.4` → `filelist@1.0.6` → `minimatch@5.1.9` | Development build helper; not shipped. **Unresolved.** |
| `minimatch` | Transitive | Copies: `3.1.5` (three routes), `5.1.9`, `9.0.9`, `10.2.6` | The vulnerable matching implementation is reachable in builder/archive paths. Fixed advisory version 11.0.1 is a major API change from all installed copies. **Unresolved; no unverified global override.** |
| `rimraf` | Transitive | `rimraf@2.6.3` → `glob@7.2.3` → `minimatch@3.1.5` | Development cleanup helper through builder's Windows-only chain; not shipped. **Unresolved.** |
| `temp` | Transitive | `temp@0.9.4` → `rimraf@2.6.3` → `glob@7.2.3` → `minimatch@3.1.5` | Development temporary-file helper through builder's Windows-only chain; not shipped. **Unresolved.** |

## Remediation decision

`electron-builder` 26.18.1 is a compatible same-major maintenance update from
26.15.3, but its published `app-builder-lib` still depends on minimatch 10.x.
The advisory's fixed release is minimatch 11.0.1; forcing that major into
packages which currently resolve minimatch 3, 5, 9, and 10 would ignore their
declared API ranges. A future fix should use a released compatible builder
dependency chain or individually tested overrides, then rerun the complete
Personal and Business package verification. `npm audit fix --force` proposes
electron-builder 20.23.1 and is a disruptive downgrade; it was not applied.

References: [GitHub advisory GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249),
[minimatch upstream security advisories](https://github.com/isaacs/minimatch/security/advisories),
[electron-builder 26.18.1 release notes](https://github.com/electron-userland/electron-builder/releases).
