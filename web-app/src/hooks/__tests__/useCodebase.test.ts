import { describe, expect, it } from 'vitest'
import {
  CODEBASE_MEMORY_SERVER_NAME,
  buildCodebaseSystemMessage,
  resolveCodebaseChatState,
} from '@/hooks/useCodebase'
import type { ProjectCodebaseMeta } from '@/services/codebase/types'

describe('buildCodebaseSystemMessage', () => {
  it('returns null when no meta is supplied', () => {
    expect(buildCodebaseSystemMessage(null)).toBeNull()
  })

  it('returns null when the project has no codebase project name', () => {
    const meta: ProjectCodebaseMeta = {
      folderPath: '/tmp/x',
      codebaseMemoryProjectName: '',
      status: 'not_linked',
      enabled: true,
    }
    expect(buildCodebaseSystemMessage(meta)).toBeNull()
  })

  it('returns null when the codebase kill switch is off', () => {
    const meta: ProjectCodebaseMeta = {
      folderPath: '/tmp/x',
      codebaseMemoryProjectName: 'tmp-x',
      indexedAt: new Date().toISOString(),
      status: 'indexed',
      enabled: false,
    }
    expect(buildCodebaseSystemMessage(meta)).toBeNull()
  })

  it('includes the project name and tool list when linked', () => {
    const meta: ProjectCodebaseMeta = {
      folderPath: 'D:/My Projects/NxLib',
      codebaseMemoryProjectName: 'D-My-Projects-NxLib',
      indexedAt: new Date().toISOString(),
      status: 'indexed',
      enabled: true,
    }
    const message = buildCodebaseSystemMessage(meta)
    expect(message).not.toBeNull()
    expect(message).toContain('D-My-Projects-NxLib')
    expect(message).toContain('search_graph')
    expect(message).toContain('Do not reindex')
    expect(message).toContain('Make at most 2 consecutive tool calls')
  })
})

describe('resolveCodebaseChatState', () => {
  const linkedMeta: ProjectCodebaseMeta = {
    folderPath: 'D:/My Projects/NxLib',
    codebaseMemoryProjectName: 'D-My-Projects-NxLib',
    indexedAt: new Date().toISOString(),
    status: 'indexed',
    enabled: true,
  }

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
