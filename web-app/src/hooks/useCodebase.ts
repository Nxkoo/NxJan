import { useCallback, useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { getServiceHub } from '@/hooks/useServiceHub'
import { localStorageKey } from '@/constants/localStorage'
import { toast } from 'sonner'
import type {
  CodebaseMemoryAvailability,
  CodebaseMemoryProject,
  ProjectCodebaseMeta,
  ProjectCodebaseStatus,
  ProjectCodebases,
} from '@/services/codebase/types'
import type { MCPTool } from '@/types/completion'
import type { MCPServerConfig } from '@/hooks/useMCPServers'

export const CODEBASE_MEMORY_SERVER_NAME = 'Codebase Memory'

export const CODEBASE_MEMORY_TOOL_NAMES = [
  'search_graph',
  'search_code',
  'trace_path',
  'query_graph',
  'get_code_snippet',
  'get_architecture',
]

type CodebaseState = {
  metas: Record<string, ProjectCodebases>
  loadAll: () => void
  setMetas: (projectId: string, metas: ProjectCodebases | null) => void
  upsertCodebase: (projectId: string, meta: ProjectCodebaseMeta) => void
  removeCodebase: (projectId: string, codebaseId: string) => void
  updateCodebase: (
    projectId: string,
    codebaseId: string,
    patch: Partial<ProjectCodebaseMeta>
  ) => void
  getCodebases: (projectId: string) => ProjectCodebases
  getCodebase: (
    projectId: string,
    codebaseId: string
  ) => ProjectCodebaseMeta | null
}

type StoredShape = {
  state?: {
    /**
     * v2 shape: `{ [projectId]: ProjectCodebaseMeta[] }`.
     * v1 shape: `{ [projectId]: ProjectCodebaseMeta }` (single codebase).
     */
    metas?: Record<string, unknown>
  }
  version?: number
}

export type CodebaseChatState =
  | 'not_linked'
  | 'indexing'
  | 'indexed'
  | 'disabled'
  | 'mcp_disabled'
  | 'error'

export type CodebaseChatResolution = {
  state: CodebaseChatState
  canInject: boolean
  hasLinkedCodebase: boolean
  hasCodebaseTools: boolean
  message: string
}

/**
 * Per-project chat resolution when one or more codebases can be injected.
 * `primary` is the single active codebase when `activeCount === 1`. When
 * `activeCount >= 2`, `primary` is the first active one (used for the chip
 * label) and `actives` carries the rest for popover / system-message use.
 */
export type CodebasesChatResolution = {
  state: CodebaseChatState
  canInject: boolean
  hasLinkedCodebase: boolean
  hasCodebaseTools: boolean
  message: string
  total: number
  activeCount: number
  primary: ProjectCodebaseMeta | null
  actives: ProjectCodebaseMeta[]
  all: ProjectCodebaseMeta[]
}

const storageKey = localStorageKey.projectCodebases
const STORAGE_VERSION = 2

function generateCodebaseId(): string {
  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto?.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID()
  }
  return `cb_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function normalizeIndexedAt(value: unknown): string | undefined {
  if (typeof value === 'string' && value) return value
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Date(value).toISOString()
  }
  return undefined
}

export function normalizeCodebaseStatus(
  status: ProjectCodebaseStatus | string | undefined,
  hasProjectName: boolean
): ProjectCodebaseStatus {
  if (status === 'ok') return 'indexed'
  if (status === 'pending' || status === 'missing') return 'not_linked'
  if (status === 'indexed' && !hasProjectName) return 'not_linked'
  if (
    status === 'not_linked' ||
    status === 'indexing' ||
    status === 'indexed' ||
    status === 'mcp_disabled' ||
    status === 'error'
  ) {
    return status
  }
  return hasProjectName ? 'indexed' : 'not_linked'
}

function deriveDisplayName(
  folderPath: string,
  existing?: string | null
): string {
  if (existing && existing.trim()) return existing.trim()
  if (!folderPath) return 'Codebase'
  const normalized = folderPath.replace(/\\/g, '/')
  const last = normalized.split('/').filter(Boolean).pop()
  return last || 'Codebase'
}

export function normalizeCodebaseMeta(
  meta: ProjectCodebaseMeta | null | undefined
): ProjectCodebaseMeta | null {
  if (!meta) return null
  const codebaseMemoryProjectName = meta.codebaseMemoryProjectName ?? ''
  const folderPath = meta.folderPath ?? ''
  return {
    ...meta,
    id: meta.id || generateCodebaseId(),
    displayName: deriveDisplayName(folderPath, meta.displayName),
    folderPath,
    codebaseMemoryProjectName,
    indexedAt: normalizeIndexedAt(meta.indexedAt),
    nodes: meta.nodes ?? null,
    edges: meta.edges ?? null,
    excludedDirs: meta.excludedDirs ?? [],
    status: normalizeCodebaseStatus(meta.status, Boolean(codebaseMemoryProjectName)),
    lastError: meta.lastError ?? null,
    enabled: meta.enabled !== false,
  }
}

function isCodebaseArray(value: unknown): value is ProjectCodebaseMeta[] {
  return Array.isArray(value)
}

function migrateLegacySingle(
  projectId: string,
  raw: Record<string, unknown>
): ProjectCodebases {
  const legacy = raw[projectId]
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return []
  return [normalizeCodebaseMeta(legacy as ProjectCodebaseMeta) as ProjectCodebaseMeta]
}

function readStorage(): Record<string, ProjectCodebases> {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredShape
    const metas = parsed.state?.metas ?? {}
    const result: Record<string, ProjectCodebases> = {}
    for (const [projectId, value] of Object.entries(metas)) {
      if (isCodebaseArray(value)) {
        const normalized = value
          .map((entry) => normalizeCodebaseMeta(entry))
          .filter((entry): entry is ProjectCodebaseMeta => entry !== null)
        if (normalized.length > 0) result[projectId] = normalized
      } else if (value && typeof value === 'object') {
        const migrated = migrateLegacySingle(projectId, { [projectId]: value })
        if (migrated.length > 0) result[projectId] = migrated
      }
    }
    return result
  } catch (error) {
    console.error('Failed to read project codebases from storage:', error)
    return {}
  }
}

function writeStorage(metas: Record<string, ProjectCodebases>): void {
  try {
    const payload: StoredShape = { state: { metas }, version: STORAGE_VERSION }
    localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch (error) {
    console.error('Failed to persist project codebases:', error)
  }
}

function normalizePathForCompare(path: string | null | undefined): string {
  return (path ?? '')
    .replace(/\\/g, '/')
    .replace(/\/+$/g, '')
    .toLowerCase()
}

function findMatchingProject(
  projects: CodebaseMemoryProject[],
  current: ProjectCodebaseMeta
): CodebaseMemoryProject | undefined {
  if (current.codebaseMemoryProjectName) {
    const byName = projects.find(
      (p) => p.project === current.codebaseMemoryProjectName
    )
    if (byName) return byName
  }

  const currentPath = normalizePathForCompare(current.folderPath)
  if (!currentPath) return undefined
  return projects.find(
    (p) => normalizePathForCompare(p.path) === currentPath
  )
}

function metaFromProjectMatch(
  current: ProjectCodebaseMeta,
  match: CodebaseMemoryProject
): ProjectCodebaseMeta {
  return {
    ...current,
    folderPath: match.path ?? current.folderPath,
    codebaseMemoryProjectName: match.project,
    indexedAt: current.indexedAt || new Date().toISOString(),
    nodes: match.nodes ?? current.nodes ?? null,
    edges: match.edges ?? current.edges ?? null,
    status: 'indexed',
    lastError: null,
    enabled: current.enabled !== false,
  }
}

export function isCodebaseMemoryTool(tool: MCPTool): boolean {
  return (
    tool.server === CODEBASE_MEMORY_SERVER_NAME ||
    CODEBASE_MEMORY_TOOL_NAMES.includes(tool.name)
  )
}

export function getCodebaseDisplayName(
  meta: ProjectCodebaseMeta | null | undefined
): string {
  if (!meta) return 'Codebase'
  if (meta.displayName && meta.displayName.trim()) return meta.displayName
  const normalizedPath = (meta.folderPath ?? '').replace(/\\/g, '/')
  return (
    normalizedPath.split('/').filter(Boolean).pop() ||
    meta.codebaseMemoryProjectName ||
    'Codebase'
  )
}

/**
 * Pick the codebase that should be surfaced as "the active one" for a
 * project. Returns `null` when the project has no codebases or every entry
 * is disabled / not ready.
 */
export function selectPrimaryCodebase(
  codebases: ProjectCodebases | null | undefined
): ProjectCodebaseMeta | null {
  if (!codebases || codebases.length === 0) return null
  const normalized = codebases
    .map((entry) => normalizeCodebaseMeta(entry))
    .filter((entry): entry is ProjectCodebaseMeta => entry !== null)
  if (normalized.length === 0) return null

  const readyActive = normalized.find(
    (entry) =>
      entry.enabled !== false &&
      normalizeCodebaseStatus(
        entry.status,
        Boolean(entry.codebaseMemoryProjectName)
      ) === 'indexed'
  )
  if (readyActive) return readyActive

  const indexedAny = normalized.find(
    (entry) =>
      normalizeCodebaseStatus(
        entry.status,
        Boolean(entry.codebaseMemoryProjectName)
      ) === 'indexed'
  )
  if (indexedAny) return indexedAny

  return normalized[0]
}

/**
 * Filter the project's codebases to those that can be auto-injected in chat.
 * A codebase is "injectable" when it is enabled, fully indexed, and has a
 * Codebase Memory project name. The order matches the user's storage order
 * so the chip / system message stay deterministic.
 */
export function getActiveCodebases(
  codebases: ProjectCodebases | null | undefined
): ProjectCodebaseMeta[] {
  if (!codebases || codebases.length === 0) return []
  return codebases.filter((entry) => {
    const normalized = normalizeCodebaseMeta(entry)
    if (!normalized) return false
    if (normalized.enabled === false) return false
    return (
      normalizeCodebaseStatus(
        normalized.status,
        Boolean(normalized.codebaseMemoryProjectName)
      ) === 'indexed'
    )
  })
}

export function resolveCodebaseChatState({
  meta,
  mcpServer,
  tools,
}: {
  meta: ProjectCodebaseMeta | null | undefined
  mcpServer?: MCPServerConfig
  tools?: MCPTool[]
}): CodebaseChatResolution {
  const normalized = normalizeCodebaseMeta(meta)
  if (!normalized) {
    return {
      state: 'not_linked',
      canInject: false,
      hasLinkedCodebase: false,
      hasCodebaseTools: false,
      message: 'No codebase linked to this project.',
    }
  }

  const hasProjectName = Boolean(normalized.codebaseMemoryProjectName)
  const hasCodebaseTools = (tools ?? []).some(isCodebaseMemoryTool)

  if (normalized.status === 'indexing') {
    return {
      state: 'indexing',
      canInject: false,
      hasLinkedCodebase: true,
      hasCodebaseTools,
      message: 'Codebase indexing is still running.',
    }
  }

  if (normalized.status === 'error' || !hasProjectName) {
    return {
      state: 'error',
      canInject: false,
      hasLinkedCodebase: true,
      hasCodebaseTools,
      message:
        normalized.lastError ||
        'Linked codebase metadata is incomplete. Project name is missing.',
    }
  }

  if (normalized.enabled === false) {
    return {
      state: 'disabled',
      canInject: false,
      hasLinkedCodebase: true,
      hasCodebaseTools,
      message: 'Codebase Memory is disabled for this project.',
    }
  }

  if (!mcpServer || mcpServer.active === false) {
    return {
      state: 'mcp_disabled',
      canInject: false,
      hasLinkedCodebase: true,
      hasCodebaseTools,
      message: 'Codebase Memory MCP server is disabled or not configured.',
    }
  }

  return {
    state: 'indexed',
    canInject: true,
    hasLinkedCodebase: true,
    hasCodebaseTools,
    message: hasCodebaseTools
      ? 'Codebase Memory is ready.'
      : 'Codebase Memory MCP is enabled; tools will load when the chat request starts.',
  }
}

export function resolveCodebasesChatState({
  metas,
  mcpServer,
  tools,
}: {
  metas: ProjectCodebases | null | undefined
  mcpServer?: MCPServerConfig
  tools?: MCPTool[]
}): CodebasesChatResolution {
  const all = (metas ?? [])
    .map((entry) => normalizeCodebaseMeta(entry))
    .filter((entry): entry is ProjectCodebaseMeta => entry !== null)
  const hasCodebaseTools = (tools ?? []).some(isCodebaseMemoryTool)

  if (all.length === 0) {
    return {
      state: 'not_linked',
      canInject: false,
      hasLinkedCodebase: false,
      hasCodebaseTools,
      message: 'No codebase linked to this project.',
      total: 0,
      activeCount: 0,
      primary: null,
      actives: [],
      all: [],
    }
  }

  const primary = selectPrimaryCodebase(all)
  const resolution = resolveCodebaseChatState({
    meta: primary,
    mcpServer,
    tools,
  })
  const actives = getActiveCodebases(all)

  if (actives.length > 1 && (mcpServer?.active ?? true) === false) {
    return {
      ...resolution,
      state: 'mcp_disabled',
      canInject: false,
      message: 'Codebase Memory MCP server is disabled or not configured.',
      total: all.length,
      activeCount: actives.length,
      primary,
      actives,
      all,
    }
  }

  if (actives.length >= 1) {
    return {
      ...resolution,
      canInject: resolution.state === 'indexed' && actives.length >= 1,
      total: all.length,
      activeCount: actives.length,
      primary,
      actives,
      all,
    }
  }

  return {
    ...resolution,
    total: all.length,
    activeCount: 0,
    primary,
    actives: [],
    all,
  }
}

export const useCodebaseStore = create<CodebaseState>((set, get) => ({
  metas: {},
  loadAll: () => {
    set({ metas: readStorage() })
  },
  setMetas: (projectId, metas) => {
    const next = { ...get().metas }
    if (metas && metas.length > 0) {
      const normalized = metas
        .map((entry) => normalizeCodebaseMeta(entry))
        .filter((entry): entry is ProjectCodebaseMeta => entry !== null)
      if (normalized.length > 0) next[projectId] = normalized
      else delete next[projectId]
    } else {
      delete next[projectId]
    }
    set({ metas: next })
    writeStorage(next)
  },
  upsertCodebase: (projectId, meta) => {
    const normalized = normalizeCodebaseMeta(meta)
    if (!normalized) return
    const current = get().metas[projectId] ?? []
    const existingIndex = current.findIndex((entry) => entry.id === normalized.id)
    const next = [...current]
    if (existingIndex >= 0) next[existingIndex] = normalized
    else next.push(normalized)
    const nextAll = { ...get().metas, [projectId]: next }
    set({ metas: nextAll })
    writeStorage(nextAll)
  },
  removeCodebase: (projectId, codebaseId) => {
    const current = get().metas[projectId] ?? []
    const next = current.filter((entry) => entry.id !== codebaseId)
    const nextAll = { ...get().metas }
    if (next.length === 0) delete nextAll[projectId]
    else nextAll[projectId] = next
    set({ metas: nextAll })
    writeStorage(nextAll)
  },
  updateCodebase: (projectId, codebaseId, patch) => {
    const current = get().metas[projectId] ?? []
    const next = current.map((entry) =>
      entry.id === codebaseId ? { ...entry, ...patch } : entry
    )
    const nextAll = { ...get().metas, [projectId]: next }
    set({ metas: nextAll })
    writeStorage(nextAll)
  },
  getCodebases: (projectId) => get().metas[projectId] ?? [],
  getCodebase: (projectId, codebaseId) => {
    const list = get().metas[projectId] ?? []
    return list.find((entry) => entry.id === codebaseId) ?? null
  },
}))

export type CodebaseStatus = 'idle' | 'checking' | 'indexing' | 'refreshing' | 'error'

type UseCodebaseReturn = {
  meta: ProjectCodebaseMeta | null
  status: CodebaseStatus
  availability: CodebaseMemoryAvailability | null
  isRefreshing: boolean
  isIndexing: boolean
  isChecking: boolean
  setFolder: (folderPath: string) => void
  refresh: () => Promise<void>
  index: () => Promise<ProjectCodebaseMeta | null>
  clear: () => void
  refreshAvailability: () => Promise<void>
  setEnabled: (enabled: boolean) => void
  setDisplayName: (name: string) => void
}

/**
 * Per-project, per-codebase hook for the Codebase feature.
 *
 * - `meta` is the persisted metadata for the given codebase id, or the
 *   primary active codebase when `codebaseId` is omitted (backwards-compat
 *   single-codebase flow).
 * - `setFolder` saves the folder path without re-indexing; `index()` runs
 *   the CLI and stores the generated project name on success.
 * - The hook is intentionally storage-only — no source code is copied into
 *   Jan; the indexed data lives inside the Codebase Memory MCP store.
 */
export function useCodebase(
  projectId: string | undefined,
  codebaseId?: string
): UseCodebaseReturn {
  const metas = useCodebaseStore((s) => s.metas)
  const upsertCodebase = useCodebaseStore((s) => s.upsertCodebase)
  const updateCodebase = useCodebaseStore((s) => s.updateCodebase)
  const removeCodebase = useCodebaseStore((s) => s.removeCodebase)
  const loadAll = useCodebaseStore((s) => s.loadAll)

  const [status, setStatus] = useState<CodebaseStatus>('idle')
  const [availability, setAvailability] =
    useState<CodebaseMemoryAvailability | null>(null)

  useEffect(() => {
    if (Object.keys(useCodebaseStore.getState().metas).length === 0) {
      loadAll()
    }
  }, [loadAll])

  const projectCodebases = useMemo<ProjectCodebases>(() => {
    if (!projectId) return []
    return metas[projectId] ?? []
  }, [metas, projectId])

  const meta = useMemo<ProjectCodebaseMeta | null>(() => {
    if (!projectId) return null
    if (codebaseId) {
      return projectCodebases.find((entry) => entry.id === codebaseId) ?? null
    }
    return selectPrimaryCodebase(projectCodebases)
  }, [projectCodebases, projectId, codebaseId])

  const refreshAvailability = useCallback(async () => {
    setStatus('checking')
    try {
      const result = await getServiceHub().codebase().checkAvailable()
      setAvailability(result)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error)
      setAvailability({
        available: false,
        version_output: null,
        version: null,
        path: null,
        exit_code: null,
        error: message,
      })
      toast.error('Failed to check Codebase Memory CLI', {
        description: message,
      })
    } finally {
      setStatus((current) => (current === 'checking' ? 'idle' : current))
    }
  }, [])

  // Probe availability once on mount so the UI can show a "not installed"
  // warning before the user clicks anything.
  useEffect(() => {
    let cancelled = false
    setStatus('checking')
    getServiceHub()
      .codebase()
      .checkAvailable()
      .then((result) => {
        if (cancelled) return
        setAvailability(result)
      })
      .catch((error) => {
        if (cancelled) return
        console.warn('Codebase Memory availability probe failed:', error)
        setAvailability({
          available: false,
          version_output: null,
          version: null,
          path: null,
          exit_code: null,
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error checking Codebase Memory CLI',
        })
      })
      .finally(() => {
        if (cancelled) return
        setStatus((current) => (current === 'checking' ? 'idle' : current))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setFolder = useCallback(
    (folderPath: string) => {
      if (!projectId) return
      const existing = meta
      if (existing && existing.folderPath === folderPath) return
      const next: ProjectCodebaseMeta = {
        id: existing?.id ?? generateCodebaseId(),
        displayName: existing?.displayName ?? deriveDisplayName(folderPath, null),
        folderPath,
        codebaseMemoryProjectName: existing?.codebaseMemoryProjectName ?? '',
        indexedAt: existing?.indexedAt,
        nodes: existing?.nodes ?? null,
        edges: existing?.edges ?? null,
        excludedDirs: existing?.excludedDirs ?? [],
        status: 'not_linked',
        lastError: null,
        enabled: existing?.enabled ?? true,
      }
      upsertCodebase(projectId, next)
    },
    [meta, projectId, upsertCodebase]
  )

  const refresh = useCallback(async () => {
    if (!projectId || !meta) return
    setStatus('refreshing')
    try {
      const projects = await getServiceHub().codebase().listProjects()
      const match = findMatchingProject(projects, meta)
      if (match) {
        upsertCodebase(projectId, metaFromProjectMatch(meta, match))
      } else {
        updateCodebase(projectId, meta.id, {
          status: 'error',
          lastError: `Folder "${meta.folderPath}" is not in the indexer's list_projects output. Re-index to refresh.`,
        })
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error)
      toast.error('Failed to refresh codebase status', {
        description: message,
      })
      updateCodebase(projectId, meta.id, {
        status: 'error',
        lastError: message,
      })
    } finally {
      setStatus('idle')
    }
  }, [meta, projectId, upsertCodebase, updateCodebase])

  useEffect(() => {
    if (!meta || !projectId) return
    if (
      normalizeCodebaseStatus(
        meta.status,
        Boolean(meta.codebaseMemoryProjectName)
      ) !== 'not_linked'
    )
      return
    if (!availability?.available || status !== 'idle') return

    let cancelled = false
    setStatus('refreshing')
    getServiceHub()
      .codebase()
      .listProjects()
      .then((projects) => {
        if (cancelled) return
        const match = findMatchingProject(projects, meta)
        if (match) {
          upsertCodebase(projectId, metaFromProjectMatch(meta, match))
        }
      })
      .catch((error) => {
        console.warn('Failed to auto-sync Codebase Memory project:', error)
      })
      .finally(() => {
        if (cancelled) return
        setStatus('idle')
      })

    return () => {
      cancelled = true
    }
  }, [availability?.available, meta, projectId, upsertCodebase, status])

  const index = useCallback(async (): Promise<ProjectCodebaseMeta | null> => {
    if (!projectId || !meta) {
      toast.error('Pick a folder before indexing the codebase.')
      return null
    }
    updateCodebase(projectId, meta.id, {
      status: 'indexing',
      lastError: null,
    })
    setStatus('indexing')
    try {
      const result = await getServiceHub()
        .codebase()
        .indexRepository(meta.folderPath)
      const next: ProjectCodebaseMeta = {
        ...meta,
        folderPath: result.repo_path,
        codebaseMemoryProjectName: result.project,
        indexedAt: new Date().toISOString(),
        nodes: result.nodes ?? null,
        edges: result.edges ?? null,
        excludedDirs: result.excluded_dirs ?? [],
        status: 'indexed',
        lastError: null,
        enabled: meta.enabled !== false,
      }
      upsertCodebase(projectId, next)
      toast.success('Codebase indexed', {
        description: `Project "${result.project}" is ready for chat.`,
      })
      return next
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error)
      updateCodebase(projectId, meta.id, {
        status: 'error',
        lastError: message,
      })
      toast.error('Failed to index codebase', { description: message })
      return null
    } finally {
      setStatus('idle')
    }
  }, [meta, projectId, upsertCodebase, updateCodebase])

  const clear = useCallback(() => {
    if (!projectId) return
    if (meta) {
      removeCodebase(projectId, meta.id)
      return
    }
    // No specific codebase selected: clear the whole project (legacy path).
    useCodebaseStore.getState().setMetas(projectId, null)
  }, [meta, projectId, removeCodebase])

  const setEnabled = useCallback(
    (enabled: boolean) => {
      if (!projectId || !meta) return
      updateCodebase(projectId, meta.id, { enabled })
    },
    [meta, projectId, updateCodebase]
  )

  const setDisplayName = useCallback(
    (name: string) => {
      if (!projectId || !meta) return
      updateCodebase(projectId, meta.id, {
        displayName: deriveDisplayName(meta.folderPath, name),
      })
    },
    [meta, projectId, updateCodebase]
  )

  return {
    meta,
    status,
    availability,
    isRefreshing: status === 'refreshing',
    isIndexing: status === 'indexing',
    isChecking: status === 'checking',
    setFolder,
    refresh,
    index,
    clear,
    refreshAvailability,
    setEnabled,
    setDisplayName,
  }
}

type UseCodebasesReturn = {
  codebases: ProjectCodebases
  primary: ProjectCodebaseMeta | null
  activeCodebases: ProjectCodebaseMeta[]
  total: number
  activeCount: number
  addCodebase: (folderPath: string, displayName?: string) => ProjectCodebaseMeta
  removeCodebase: (codebaseId: string) => void
  setCodebaseEnabled: (codebaseId: string, enabled: boolean) => void
  renameCodebase: (codebaseId: string, displayName: string) => void
}

/**
 * Per-project hook for the multi-codebase collection.
 *
 * Returns the full list of codebases linked to a project, plus helpers to
 * add, remove, toggle, and rename individual entries. Use `useCodebase`
 * for the per-codebase actions (indexing, refresh, folder picker, etc).
 */
export function useCodebases(
  projectId: string | undefined
): UseCodebasesReturn {
  const metas = useCodebaseStore((s) => s.metas)
  const upsertCodebase = useCodebaseStore((s) => s.upsertCodebase)
  const updateCodebase = useCodebaseStore((s) => s.updateCodebase)
  const removeCodebaseAction = useCodebaseStore((s) => s.removeCodebase)
  const loadAll = useCodebaseStore((s) => s.loadAll)

  useEffect(() => {
    if (Object.keys(useCodebaseStore.getState().metas).length === 0) {
      loadAll()
    }
  }, [loadAll])

  const codebases = useMemo<ProjectCodebases>(() => {
    if (!projectId) return []
    return metas[projectId] ?? []
  }, [metas, projectId])

  const primary = useMemo(
    () => selectPrimaryCodebase(codebases),
    [codebases]
  )
  const activeCodebases = useMemo(
    () => getActiveCodebases(codebases),
    [codebases]
  )

  const addCodebase = useCallback(
    (folderPath: string, displayName?: string): ProjectCodebaseMeta => {
      if (!projectId) {
        throw new Error('Cannot add a codebase without a project id.')
      }
      const next: ProjectCodebaseMeta = {
        id: generateCodebaseId(),
        displayName: deriveDisplayName(folderPath, displayName),
        folderPath,
        codebaseMemoryProjectName: '',
        status: 'not_linked',
        lastError: null,
        enabled: true,
      }
      upsertCodebase(projectId, next)
      return next
    },
    [projectId, upsertCodebase]
  )

  const removeCodebase = useCallback(
    (codebaseId: string) => {
      if (!projectId) return
      removeCodebaseAction(projectId, codebaseId)
    },
    [projectId, removeCodebaseAction]
  )

  const setCodebaseEnabled = useCallback(
    (codebaseId: string, enabled: boolean) => {
      if (!projectId) return
      updateCodebase(projectId, codebaseId, { enabled })
    },
    [projectId, updateCodebase]
  )

  const renameCodebase = useCallback(
    (codebaseId: string, displayName: string) => {
      if (!projectId) return
      const entry = codebases.find((c) => c.id === codebaseId)
      if (!entry) return
      updateCodebase(projectId, codebaseId, {
        displayName: deriveDisplayName(entry.folderPath, displayName),
      })
    },
    [codebases, projectId, updateCodebase]
  )

  return {
    codebases,
    primary,
    activeCodebases,
    total: codebases.length,
    activeCount: activeCodebases.length,
    addCodebase,
    removeCodebase,
    setCodebaseEnabled,
    renameCodebase,
  }
}

/**
 * Build the system-message addendum injected into project threads whose
 * project has at least one linked Codebase Memory project.
 *
 * - 0 injectable codebases → `null` (no addendum).
 * - 1 injectable codebase → single-codebase instructions with the project
 *   name (preserves the legacy behavior).
 * - 2+ injectable codebases → list every active project, tell the model to
 *   pick the most relevant one first, search it, and only fall back to
 *   others if results are not clear.
 *
 * The function never calls `index_repository`; reindexing is reserved for
 * the explicit user request.
 */
export function buildCodebaseSystemMessage(
  metas: ProjectCodebaseMeta | ProjectCodebases | null | undefined
): string | null {
  if (!metas) return null
  const list: ProjectCodebases = Array.isArray(metas) ? metas : [metas]
  const actives = getActiveCodebases(list)
  if (actives.length === 0) return null

  if (actives.length === 1) {
    return buildSingleCodebaseMessage(actives[0])
  }
  return buildMultiCodebaseMessage(actives)
}

function buildSingleCodebaseMessage(meta: ProjectCodebaseMeta): string {
  const project = meta.codebaseMemoryProjectName
  if (!project) return null as unknown as string
  return [
    'This chat is linked to a local codebase indexed by Codebase Memory MCP.',
    '',
    'Codebase Memory project name:',
    project,
    '',
    'Use Codebase Memory MCP when the user asks about:',
    '- files',
    '- classes',
    '- methods',
    '- symbols',
    '- usages',
    '- dependencies',
    '- architecture',
    '- call paths',
    '- code structure',
    '- where something is implemented',
    '- which project/file/class uses something',
    '',
    'The linked project name is already known. Do not call list_projects before answering codebase questions.',
    'For project overview or architecture questions, call get_architecture directly with the project name above.',
    'For casual small-talk or greetings such as "oi", "hello", "hi", "tudo bem", or "bom dia", do not use MCP tools; answer normally.',
    '',
    'Do not reindex unless the user explicitly asks.',
    'Use the exact project name above.',
    '',
    'Prefer targeted tools:',
    '- Class/symbol questions: search_graph, search_code, get_code_snippet',
    '- Dependency/call-flow questions: trace_path, query_graph',
    '- Architecture questions: get_architecture plus targeted search_graph',
    '- General “where is X?” questions: search_graph first, then search_code if needed',
    '',
    'Tool-use limits:',
    '- Make at most 2 consecutive tool calls before synthesizing a response.',
    '- If the first tool call returns clear class/file results, do not call more tools.',
    '- Stop using tools once you have enough direct evidence to answer.',
    '- If no results are found, say that clearly and suggest a narrower search.',
    '',
    'Answer clearly and mention class/file names when available.',
  ].join('\n')
}

function buildMultiCodebaseMessage(actives: ProjectCodebases): string {
  const projectList = actives
    .map((entry) => `- ${entry.codebaseMemoryProjectName} (${getCodebaseDisplayName(entry)} — ${entry.folderPath})`)
    .join('\n')

  return [
    'This chat is linked to multiple local codebases indexed by Codebase Memory MCP.',
    '',
    'Active Codebase Memory projects:',
    projectList,
    '',
    'Use Codebase Memory MCP when the user asks about files, classes, methods, symbols,',
    'usages, dependencies, architecture, call paths, code structure, where something is',
    'implemented, or which project/file/class uses something.',
    '',
    'The project names above are already known. Do not call list_projects before answering.',
    '',
    'Multi-codebase routing:',
    '- For every codebase question, decide which active project is the most relevant',
    '  for the user’s request (use the display name + folder path as a hint).',
    '- Run your first search on the chosen project only — pass its exact project name',
    '  to search_graph / search_code / get_architecture / trace_path / get_code_snippet.',
    '- If the first project returns no results or clearly unrelated matches, try the',
    '  next most likely project from the list above.',
    '- Do not search every active project for every question; that wastes tool calls.',
    '',
    'For casual small-talk or greetings such as "oi", "hello", "hi", "tudo bem", or "bom dia", do not use MCP tools; answer normally.',
    '',
    'Do not reindex unless the user explicitly asks.',
    'Use the exact project names above.',
    '',
    'Prefer targeted tools:',
    '- Class/symbol questions: search_graph, search_code, get_code_snippet',
    '- Dependency/call-flow questions: trace_path, query_graph',
    '- Architecture questions: get_architecture plus targeted search_graph',
    '- General “where is X?” questions: search_graph first, then search_code if needed',
    '',
    'Tool-use limits:',
    '- Make at most 2 consecutive tool calls per project before synthesizing a response.',
    '- If a project returns clear class/file results, do not call more tools.',
    '- Stop using tools once you have enough direct evidence to answer.',
    '- If no results are found across the projects you tried, say that clearly and suggest a narrower search.',
    '',
    'Answer clearly and mention class/file names when available.',
  ].join('\n')
}
