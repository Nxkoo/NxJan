import { describe, expect, it } from 'vitest'
import {
  CODEBASE_MEMORY_SERVER_NAME,
  buildCodebaseSystemMessage,
  getActiveCodebases,
  resolveCodebaseChatState,
  resolveCodebasesChatState,
  selectPrimaryCodebase,
} from '@/hooks/useCodebase'
import type { ProjectCodebaseMeta } from '@/services/codebase/types'

function makeMeta(overrides: Partial<ProjectCodebaseMeta> = {}): ProjectCodebaseMeta {
  return {
    id: 'cb_test',
    displayName: 'NxLib',
    folderPath: 'D:/My Projects/NxLib',
    codebaseMemoryProjectName: 'D-My-Projects-NxLib',
    indexedAt: new Date().toISOString(),
    status: 'indexed',
    enabled: true,
    nodes: 100,
    edges: 200,
    ...overrides,
  }
}

describe('buildCodebaseSystemMessage', () => {
  it('returns null when no meta is supplied', () => {
    expect(buildCodebaseSystemMessage(null)).toBeNull()
  })

  it('returns null when the project has no codebase project name', () => {
    const meta = makeMeta({ codebaseMemoryProjectName: '' })
    expect(buildCodebaseSystemMessage(meta)).toBeNull()
  })

  it('returns null when the codebase kill switch is off', () => {
    const meta = makeMeta({ enabled: false })
    expect(buildCodebaseSystemMessage(meta)).toBeNull()
  })

  it('includes the project name and tool list when linked', () => {
    const meta = makeMeta()
    const message = buildCodebaseSystemMessage(meta)
    expect(message).not.toBeNull()
    expect(message).toContain('D-My-Projects-NxLib')
    expect(message).toContain('search_graph')
    expect(message).toContain('Do not reindex')
    expect(message).toContain('Make at most 2 consecutive tool calls')
  })
})

describe('buildCodebaseSystemMessage (multi-codebase)', () => {
  it('returns null for an empty array', () => {
    expect(buildCodebaseSystemMessage([])).toBeNull()
  })

  it('returns null when no entry is enabled and indexed', () => {
    const list: ProjectCodebaseMeta[] = [
      makeMeta({ id: 'a', codebaseMemoryProjectName: 'proj-a', enabled: false }),
      makeMeta({ id: 'b', codebaseMemoryProjectName: '', status: 'not_linked' }),
    ]
    expect(buildCodebaseSystemMessage(list)).toBeNull()
  })

  it('emits a single-codebase message when only one entry is active', () => {
    const list: ProjectCodebaseMeta[] = [
      makeMeta({ id: 'a', codebaseMemoryProjectName: 'proj-a' }),
      makeMeta({
        id: 'b',
        codebaseMemoryProjectName: 'proj-b',
        enabled: false,
      }),
    ]
    const message = buildCodebaseSystemMessage(list)
    expect(message).not.toBeNull()
    expect(message).toContain('proj-a')
    expect(message).not.toContain('proj-b')
  })

  it('emits a multi-codebase message with all active projects', () => {
    const list: ProjectCodebaseMeta[] = [
      makeMeta({
        id: 'a',
        displayName: 'Frontend',
        folderPath: 'D:/code/frontend',
        codebaseMemoryProjectName: 'proj-frontend',
      }),
      makeMeta({
        id: 'b',
        displayName: 'Backend',
        folderPath: 'D:/code/backend',
        codebaseMemoryProjectName: 'proj-backend',
      }),
    ]
    const message = buildCodebaseSystemMessage(list)
    expect(message).not.toBeNull()
    expect(message).toContain('multiple local codebases')
    expect(message).toContain('proj-frontend')
    expect(message).toContain('proj-backend')
    expect(message).toContain('Frontend')
    expect(message).toContain('Backend')
    expect(message).toContain('Multi-codebase routing')
    expect(message).toContain('Do not reindex')
  })
})

describe('resolveCodebaseChatState', () => {
  const linkedMeta = makeMeta()

  it('does not inject when no codebase is linked', () => {
    expect(resolveCodebaseChatState({ meta: null }).canInject).toBe(false)
    expect(resolveCodebaseChatState({ meta: null }).state).toBe('not_linked')
  })

  it('does not inject when disabled per project', () => {
    const state = resolveCodebaseChatState({
      meta: { ...linkedMeta, enabled: false },
      mcpServer: { command: 'x', args: [], env: {}, active: true },
    })
    expect(state.state).toBe('disabled')
    expect(state.canInject).toBe(false)
  })

  it('requires the Codebase Memory MCP server to be active', () => {
    const state = resolveCodebaseChatState({
      meta: linkedMeta,
      mcpServer: { command: 'x', args: [], env: {}, active: false },
    })
    expect(state.state).toBe('mcp_disabled')
    expect(state.canInject).toBe(false)
  })

  it('injects when linked, enabled, and MCP server is active', () => {
    const state = resolveCodebaseChatState({
      meta: linkedMeta,
      mcpServer: { command: 'x', args: [], env: {}, active: true },
      tools: [
        {
          name: 'search_graph',
          description: 'Search graph',
          inputSchema: {},
          server: CODEBASE_MEMORY_SERVER_NAME,
        },
      ],
    })
    expect(state.state).toBe('indexed')
    expect(state.canInject).toBe(true)
    expect(state.hasCodebaseTools).toBe(true)
  })
})

describe('resolveCodebasesChatState', () => {
  it('reports empty state for an empty list', () => {
    const state = resolveCodebasesChatState({
      metas: [],
      mcpServer: { command: 'x', args: [], env: {}, active: true },
    })
    expect(state.state).toBe('not_linked')
    expect(state.canInject).toBe(false)
    expect(state.total).toBe(0)
    expect(state.activeCount).toBe(0)
    expect(state.primary).toBeNull()
  })

  it('picks the first active codebase as the primary', () => {
    const list: ProjectCodebaseMeta[] = [
      makeMeta({ id: 'a', codebaseMemoryProjectName: 'proj-a' }),
      makeMeta({ id: 'b', codebaseMemoryProjectName: 'proj-b' }),
    ]
    const state = resolveCodebasesChatState({
      metas: list,
      mcpServer: { command: 'x', args: [], env: {}, active: true },
    })
    expect(state.total).toBe(2)
    expect(state.activeCount).toBe(2)
    expect(state.canInject).toBe(true)
    expect(state.primary?.id).toBe('a')
    expect(state.actives.map((entry) => entry.id)).toEqual(['a', 'b'])
  })

  it('skips disabled codebases when counting actives', () => {
    const list: ProjectCodebaseMeta[] = [
      makeMeta({ id: 'a', codebaseMemoryProjectName: 'proj-a' }),
      makeMeta({
        id: 'b',
        codebaseMemoryProjectName: 'proj-b',
        enabled: false,
      }),
    ]
    const state = resolveCodebasesChatState({
      metas: list,
      mcpServer: { command: 'x', args: [], env: {}, active: true },
    })
    expect(state.activeCount).toBe(1)
    expect(state.canInject).toBe(true)
  })

  it('does not inject when the MCP server is disabled', () => {
    const list: ProjectCodebaseMeta[] = [
      makeMeta({ id: 'a', codebaseMemoryProjectName: 'proj-a' }),
      makeMeta({ id: 'b', codebaseMemoryProjectName: 'proj-b' }),
    ]
    const state = resolveCodebasesChatState({
      metas: list,
      mcpServer: { command: 'x', args: [], env: {}, active: false },
    })
    expect(state.state).toBe('mcp_disabled')
    expect(state.canInject).toBe(false)
    expect(state.activeCount).toBe(2)
  })
})

describe('selectPrimaryCodebase / getActiveCodebases', () => {
  it('returns null when the project has no codebases', () => {
    expect(selectPrimaryCodebase(null)).toBeNull()
    expect(selectPrimaryCodebase([])).toBeNull()
    expect(getActiveCodebases([])).toEqual([])
  })

  it('prefers the first enabled + indexed codebase as primary', () => {
    const list: ProjectCodebaseMeta[] = [
      makeMeta({ id: 'a', enabled: false }),
      makeMeta({ id: 'b', codebaseMemoryProjectName: 'proj-b' }),
    ]
    expect(selectPrimaryCodebase(list)?.id).toBe('b')
    expect(getActiveCodebases(list).map((entry) => entry.id)).toEqual(['b'])
  })

  it('falls back to the first indexed codebase when nothing is enabled', () => {
    const list: ProjectCodebaseMeta[] = [
      makeMeta({ id: 'a', enabled: false }),
      makeMeta({
        id: 'b',
        codebaseMemoryProjectName: 'proj-b',
        enabled: false,
      }),
    ]
    expect(selectPrimaryCodebase(list)?.id).toBe('a')
    expect(getActiveCodebases(list)).toEqual([])
  })
})
