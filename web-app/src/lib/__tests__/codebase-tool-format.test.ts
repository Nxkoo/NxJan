import { describe, expect, it } from 'vitest'
import { formatToolCallDisplay } from '@/lib/codebase-tool-format'

describe('formatToolCallDisplay', () => {
  it('summarizes Codebase Memory search_graph calls', () => {
    const display = formatToolCallDisplay(
      'search_graph',
      {
        project: 'D-My-Projects-NxLib',
        label: 'Class',
        name_pattern: '.*Render.*',
      },
      {
        results: [
          { name: 'GeoPlayerRenderer', file: 'src/GeoPlayerRenderer.java' },
          { name: 'PlayerRenderPipeline', file: 'src/PlayerRenderPipeline.java' },
        ],
      }
    )

    expect(display.title).toBe('Searched code graph')
    expect(display.project).toBe('D-My-Projects-NxLib')
    expect(display.query).toBe('Class / .*Render.*')
    expect(display.resultCount).toBe(2)
    expect(display.params).toEqual(
      expect.arrayContaining([
        { key: 'project', value: 'D-My-Projects-NxLib' },
        { key: 'label', value: 'Class' },
      ])
    )
    expect(display.rawOutput).toContain('GeoPlayerRenderer')
  })

  it('parses JSON strings returned inside MCP content text', () => {
    const display = formatToolCallDisplay(
      'search_code',
      JSON.stringify({ project: 'P', query: 'player' }),
      {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ matches: [{ file: 'Player.java' }] }),
          },
        ],
      }
    )

    expect(display.project).toBe('P')
    expect(display.query).toBe('player')
    expect(display.resultCount).toBe(1)
    expect(display.snippets.join('\n')).toContain('Player.java')
  })
})
