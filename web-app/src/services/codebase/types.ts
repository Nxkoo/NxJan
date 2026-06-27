/**
 * Codebase Service Types
 *
 * The Codebase Service is a thin wrapper around the native
 * `codebase-memory-mcp` CLI bridge. It exposes the same JSON shape the Rust
 * commands return so the UI can stay loosely coupled.
 */

export type CodebaseMemoryAvailability = {
  available: boolean
  /** Full stdout of `codebase-memory-mcp --version` (trimmed). */
  version_output?: string | null
  /** First non-empty line of the version output. */
  version?: string | null
  /** Path returned by `where` / `which`. */
  path?: string | null
  /** Exit code, when the CLI was launched. */
  exit_code?: number | null
  /** Human-readable error string, when the CLI is unavailable. */
  error?: string | null
}

export type CodebaseMemoryProject = {
  /** Canonical project id used by the MCP tools (e.g. `D-My-Projects-NxLib`). */
  project: string
  /** Human-readable label, if the CLI provides one. */
  label?: string | null
  /** Resolved filesystem path, if known. */
  path?: string | null
  /** Optional node count surfaced from list_projects. */
  nodes?: number | null
  /** Optional edge count surfaced from list_projects. */
  edges?: number | null
}

export type CodebaseMemoryIndexResult = {
  project: string
  repo_path: string
  status: string
  nodes?: number | null
  edges?: number | null
  excluded_dirs: string[]
}

export type CodebaseMemorySearchResult = {
  output: unknown
  raw: string
}

export type ProjectCodebaseStatus =
  | 'not_linked'
  | 'indexing'
  | 'indexed'
  | 'mcp_disabled'
  | 'error'
  /** Legacy Phase 2 status kept for localStorage migration. */
  | 'pending'
  /** Legacy Phase 2 status kept for localStorage migration. */
  | 'ok'
  /** Legacy Phase 2 status kept for localStorage migration. */
  | 'missing'

/**
 * Per-project metadata persisted in Jan's localStorage. We deliberately keep
 * this metadata-only — the indexed data lives inside the Codebase Memory MCP
 * store and is queried at chat time.
 */
export type ProjectCodebaseMeta = {
  /** Absolute folder path the user picked. */
  folderPath: string
  /** Project name returned by `codebase-memory-mcp`. */
  codebaseMemoryProjectName: string
  /** ISO timestamp of the last successful index. */
  indexedAt?: string
  /** Optional node count surfaced from the CLI. */
  nodes?: number | null
  /** Optional edge count surfaced from the CLI. */
  edges?: number | null
  /** Optional list of excluded directories. */
  excludedDirs?: string[]
  /** Current codebase link/index status. */
  status: ProjectCodebaseStatus
  /** Last error message, if any. */
  lastError?: string | null
  /** Per-project kill switch for automatic Codebase Memory chat behavior. */
  enabled: boolean
}

export type ProjectCodebaseState = {
  meta: ProjectCodebaseMeta | null
  status: 'idle' | 'checking' | 'indexing' | 'refreshing' | 'error'
}

export interface CodebaseService {
  /** Probe CLI availability. */
  checkAvailable(): Promise<CodebaseMemoryAvailability>

  /** List every project known to the CLI. */
  listProjects(): Promise<CodebaseMemoryProject[]>

  /** Index a folder; returns the generated project name + counts. */
  indexRepository(repoPath: string): Promise<CodebaseMemoryIndexResult>

  /** Debug helper used by the in-app inspector. */
  searchGraph(
    project: string,
    label?: string,
    namePattern?: string
  ): Promise<CodebaseMemorySearchResult>
}
