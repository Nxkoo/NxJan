# NxJan v0.8.3+2

Second NxJan fork revision on top of upstream Jan v0.8.3.

## Highlights

### Updater points at Nxkoo/NxJan releases

The bundled updater now reads `latest.json` straight from this
repository's GitHub Releases — no more notifications about Jan upstream
versions that NxJan does not control. The old HMAC-signed primary
endpoint on `apps.jan.ai` and the fallback to `janhq/jan/releases`
are gone.

- New `pubkey` in `tauri.conf.json` paired with a freshly generated
  NxJan minisign key. The private key is stored as a GitHub Actions
  secret (`TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`).
- `web-app/src/services/updater/tauri.ts` no longer calls the custom
  Rust updater. The Tauri plugin-updater reads the manifest and
  validates the installer's minisign signature against the embedded
  pubkey.
- All `template-tauri-build-{macos,windows-x64,linux-x64}*` workflows
  now use `github.com/${{ github.repository }}` instead of hard-coded
  `janhq/jan` URLs.
- `jan-tauri-build.yaml` accepts tags with SemVer build-metadata or
  pre-release identifiers (e.g. `v0.8.3+2`, `v0.8.3-rc1`) so future
  fork revisions don't need a manual `gh workflow run`.

### Codebase Memory ships with the installer (NxJan-hardened)

`v0.8.3+1` introduced bundling the `codebase-memory-mcp` binary, but
two issues made it silently ship a broken build on Windows:

- The download script only checked `fs.existsSync(finalPath)`, so a
  previous run that wrote a 0-byte file short-circuited every
  subsequent download attempt.
- The "non-fatal" catch around the download hid the failure, and the
  Makefile target used `[ ! -f ... ]` (size-blind) to decide whether
  to re-download.

Fixes in `scripts/download-bin.mjs`:

- Hard size floor (>= 1 MB) **plus** platform-correct magic-byte
  check (`MZ` for PE, `\x7fELF` for Linux, Mach-O envelopes for
  macOS). A 0-byte stub, an HTML error page, or a truncated download
  all fail validation and force a re-download.
- `download()` now verifies `content-length` and removes the
  destination on any error, redirect, or short read.
- The whole codebase-memory-mcp download block is **fatal** on failure
  — a broken binary would otherwise ship to end users as a silent
  non-functional MCP.

`Makefile` switched from `[ ! -f ... ]` to `[ ! -s ... ]` so a 0-byte
artifact from a prior run triggers a re-download.

### "Codebase Memory" MCP auto-configured on first launch

The `DEFAULT_MCP_CONFIG` in `src-tauri/src/core/mcp/constants.rs` now
includes the `Codebase Memory` server alongside `exa`, `Jan Browser
MCP`, etc. — active by default, pointing at the bundled binary.
Existing installs get the same server added via a new
`mcp_version` 3 → 4 migration in `migrate_mcp_servers`.

`web-app/src/hooks/useCodebase.ts` was already wired against
`CODEBASE_MEMORY_SERVER_NAME = 'Codebase Memory'`, so chat-side
codebase lookup, the "Link codebase" dialog, and the per-project
enable toggle all light up automatically without further code changes.

### Repository hygiene

- `.gitignore` ignores `*.key`, `*.privkey`, `*.minisign`, `*.pub`,
  `*.pem`, `*.pfx`, `*.p12`, `*.gpg`, `*.asc`, `*secrets*.json`,
  `*signing*.json`, and `**/NxJan-*.key`. The minisign key pair lives
  in your local shell, not in the repo.

## Installers

- **Windows (NSIS):** `NxJan_0.8.3+2_x64-setup.exe` (will appear once
  the `jan-tauri-build.yaml` workflow completes on the `v0.8.3+2` tag)
- **Windows (MSI):** `NxJan_0.8.3+2_x64_en-US.msi`
- **macOS (universal):** `NxJan_0.8.3+2_universal.dmg`
- **Linux (deb + AppImage):** `NxJan_0.8.3+2_amd64.deb` /
  `NxJan_0.8.3+2_amd64.AppImage`

(If the workflow hasn't been triggered yet, run
`gh workflow run jan-tauri-build.yaml --ref v0.8.3+2` from the repo
root with the `TAURI_SIGNING_*` secrets configured.)

## Commits in this release

- `fix(updater): point at Nxkoo/NxJan releases and drop custom HMAC path`
- `chore(gitignore): keep signing material out of version control`
- `ci(release): allow SemVer build-metadata + pre-release tags`

## Upgrading

If you're already on `0.8.3+1`, the in-app updater should pick up
`0.8.3+2` once the installers are attached to the release. If the
notification doesn't appear, click "Check for updates" under
Settings → General.
