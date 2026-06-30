# NxJan v0.8.3+1

First NxJan fork revision on top of upstream Jan v0.8.3.

## Highlights

### Codebase Memory ships with the installer

The `codebase-memory-mcp` static binary is now bundled inside the Jan
installer for every supported platform. A fresh install of NxJan works
out of the box — no `pip install`, no `npm i -g`, no PATH tweaks. The
"codebase-memory-mcp CLI is missing" banner is gone for normal users;
it now only fires for genuinely broken builds and points at
`CODEBASE_MEMORY_MCP_PATH` for power users who want to override.

- Build pipeline pulls the binary from
  `DeusData/codebase-memory-mcp` GitHub releases at build time.
- macOS installer signs the bundled binary with the same Developer ID
  Application identity Jan already uses for `mlx-server` and `jan-cli`,
  so Gatekeeper stops blocking the first launch.
- `.deb` installs the binary under `/usr/bin/codebase-memory-mcp`.
- Runtime resolver tries the bundled location before any user-installed
  one; `CODEBASE_MEMORY_MCP_PATH` and `where`/`which` still win for
  overrides.

## Versioning

This build bumps NxJan to `0.8.3+1`. The SemVer build-metadata `+1`
keeps the connection to upstream Jan v0.8.3 visible to every tool, while
every package manager treats the build as equivalent to `0.8.3` for
dependency resolution. The `1` is the NxJan fork revision counter —
bump to `0.8.3+2`, `+3`, … as more patches land. The metadata is
intentionally purely numeric because the Tauri MSI target (Windows WiX)
requires it; richer branding can move to a `1.0.0` style SemVer later.

## Commits in this release

- `feat(codebase-memory): bundle CLI binary with Jan installer`
- `feat(codebase-memory): resolve bundled binary at runtime`
- `chore(release): bump version to 0.8.3+1`
- `i18n(codebase-memory): refresh CLI-missing copy now that binary is bundled`

## Installers

- **Windows (NSIS):** `NxJan_0.8.3+1_x64-setup.exe` (56 MB)
- **Windows (MSI):** `NxJan_0.8.3+1_x64_en-US.msi` (81 MB)
