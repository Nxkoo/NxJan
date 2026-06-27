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
  metas: Record<string, ProjectCodebaseMeta>
  loadAll: () => void
  setMeta: (projectId: string, meta: ProjectCodebaseMeta | null) => void
  clearMeta: (projectId: string) => void
}

type StoredShape = {
  state?: { metas?: Record<string, ProjectCodebaseMeta> }
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

const storageKey = localStorageKey.projectCodebases

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

export function normalizeCodebaseMeta(
  meta: ProjectCodebaseMeta | null | undefined
): ProjectCodebaseMeta | null {
  if (!meta) return null
  const codebaseMemoryProjectName = meta.codebaseMemoryProjectName ?? ''
  return {
    ...meta,
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

function readStorage(): Record<string, ProjectCodebaseMeta> {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredShape
    const metas = parsed.state?.metas ?? {}
    return Object.entries(metas).reduce<Record<string, ProjectCodebaseMeta>>(
      (acc, [projectId, meta]) => {
        const normalized = normalizeCodebaseMeta(meta)
        if (normalized) acc[projectId] = normalized
        return acc
      },
      {}
    )
  } catch (error) {
    console.error('Failed to read project codebases from storage:', error)
    return {}
  }
}

function writeStorage(metas: Record<string, ProjectCodebaseMeta>): void {
  try {
    const payload: StoredShape = { state: { metas }, version: 1 }
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
  const normalizedPath = meta.folderPath.replace(/\\/g, '/')
  return normalizedPath.split('/').filter(Boolean).pop() || meta.codebaseMemoryProjectName || 'Codebase'
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

export const useCodebaseStore = create<CodebaseState>((set, get) => ({
  metas: {},
  loadAll: () => {
    set({ metas: readStorage() })
  },
  setMeta: (projectId, meta) => {
    const next = { ...get().metas }
    if (meta) {
      next[projectId] = meta
    } else {
      delete next[projectId]
    }
    set({ metas: next })
    writeStorage(next)
  },
  clearMeta: (projectId) => {
    const next = { ...get().metas }
    delete next[projectId]
    set({ metas: next })
    writeStorage(next)
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
}

/**
 * Per-project hook for the Codebase feature.
 *
 * - `meta` is the persisted metadata for `projectId` (or `null`).
 * - `availability` reflects the latest `check_available` probe.
 * - `setFolder` saves the folder path without re-indexing; `index()` runs
 *   the CLI and stores the generated project name on success.
 *
 * The hook is intentionally storage-only — no source code is copied into
 * Jan; the indexed data lives inside the Codebase Memory MCP store.
 */
export function useCodebase(
  projectId: string | undefined
): UseCodebaseReturn {
  const metas = useCodebaseStore((s) => s.metas)
  const setMeta = useCodebaseStore((s) => s.setMeta)
  const clearMeta = useCodebaseStore((s) => s.clearMeta)
  const loadAll = useCodebaseStore((s) => s.loadAll)

  const [status, setStatus] = useState<CodebaseStatus>('idle')
  const [availability, setAvailability] =
    useState<CodebaseMemoryAvailability | null>(null)

  useEffect(() => {
    if (Object.keys(useCodebaseStore.getState().metas).length === 0) {
      loadAll()
    }
  }, [loadAll])

  const meta = useMemo(() => {
    if (!projectId) return null
    return metas[projectId] ?? null
  }, [metas, projectId])

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
      const existing = metas[projectId]
      if (existing && existing.folderPath === folderPath) return
      setMeta(projectId, {
        folderPath,
        codebaseMemoryProjectName: existing?.codebaseMemoryProjectName ?? '',
        indexedAt: existing?.indexedAt,
        nodes: existing?.nodes ?? null,
        edges: existing?.edges ?? null,
        excludedDirs: existing?.excludedDirs ?? [],
        status: 'not_linked',
        lastError: null,
        enabled: existing?.enabled ?? true,
      })
    },
    [metas, projectId, setMeta]
  )

  const refresh = useCallback(async () => {
    if (!projectId) return
    const current = metas[projectId]
    if (!current) return
    setStatus('refreshing')
    try {
      const projects =
        await getServiceHub().codebase().listProjects()
      const match = findMatchingProject(projects, current)
      if (match) {
        setMeta(projectId, metaFromProjectMatch(current, match))
      } else {
        setMeta(projectId, {
          ...current,
          status: 'error',
          lastError: `Folder "${current.folderPath}" is not in the indexer's list_projects output. Re-index to refresh.`,
        })
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error)
      toast.error('Failed to refresh codebase status', {
        description: message,
      })
      setMeta(projectId, {
        ...current,
        status: 'error',
        lastError: message,
      })
    } finally {
      setStatus('idle')
    }
  }, [metas, projectId, setMeta])

  useEffect(() => {
    if (!meta || !projectId || normalizeCodebaseStatus(meta.status, Boolean(meta.codebaseMemoryProjectName)) !== 'not_linked') return
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
          setMeta(projectId, metaFromProjectMatch(meta, match))
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
  }, [availability?.available, meta, projectId, setMeta, status])

  const index = useCallback(async (): Promise<ProjectCodebaseMeta | null> => {
    if (!projectId) return null
    const current = metas[projectId]
    if (!current) {
      toast.error('Pick a folder before indexing the codebase.')
      return null
    }
    setMeta(projectId, {
      ...current,
      status: 'indexing',
      lastError: null,
      enabled: current.enabled !== false,
    })
    setStatus('indexing')
    try {
      const result = await getServiceHub()
        .codebase()
        .indexRepository(current.folderPath)
      const next: ProjectCodebaseMeta = {
        folderPath: result.repo_path,
        codebaseMemoryProjectName: result.project,
        indexedAt: new Date().toISOString(),
        nodes: result.nodes ?? null,
        edges: result.edges ?? null,
        excludedDirs: result.excluded_dirs ?? [],
        status: 'indexed',
        lastError: null,
        enabled: current.enabled !== false,
      }
      setMeta(projectId, next)
      toast.success('Codebase indexed', {
        description: `Project "${result.project}" is ready for chat.`,
      })
      return next
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error)
      setMeta(projectId, {
        ...current,
        status: 'error',
        lastError: message,
      })
      toast.error('Failed to index codebase', { description: message })
      return null
    } finally {
      setStatus('idle')
    }
  }, [metas, projectId, setMeta])

  const clear = useCallback(() => {
    if (!projectId) return
    clearMeta(projectId)
  }, [clearMeta, projectId])

  const setEnabled = useCallback(
    (enabled: boolean) => {
      if (!projectId) return
      const current = useCodebaseStore.getState().metas[projectId]
      if (!current) return
      setMeta(projectId, {
        ...current,
        enabled,
      })
    },
    [projectId, setMeta]
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
  }
}

/**
 * Build the system-message addendum injected into project threads whose
 * project has a linked Codebase Memory project. The model is told to prefer
 * targeted MCP tools instead of re-indexing.
 */
export function buildCodebaseSystemMessage(
  meta: ProjectCodebaseMeta | null
): string | null {
  const normalized = normalizeCodebaseMeta(meta)
  if (!normalized) return null
  if (normalized.enabled === false) return null
  if (normalizeCodebaseStatus(normalized.status, Boolean(normalized.codebaseMemoryProjectName)) !== 'indexed') return null
  const project = normalized.codebaseMemoryProjectName
  if (!project) return null
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
