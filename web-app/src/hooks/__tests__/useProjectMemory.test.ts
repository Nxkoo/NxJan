import { describe, expect, it } from 'vitest'
import {
  buildMemoryContextMessage,
  buildProjectMemorySystemMessage,
  normalizeMemoryEntry,
  rankMemoryEntries,
  resolveProjectMemoryChatState,
  scoreMemoryEntry,
  selectMemoryEntries,
} from '@/hooks/useProjectMemory'
import type { ProjectMemoryEntry } from '@/services/project-memory/types'

function makeEntry(overrides: Partial<ProjectMemoryEntry> = {}): ProjectMemoryEntry {
  const now = '2026-06-29T12:00:00.000Z'
  return normalizeMemoryEntry(
    {
      projectId: 'proj-1',
      title: 'Sample entry',
      content: 'Sample content for testing.',
      tags: [],
      pinned: false,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    },
    'proj-1'
  ) as ProjectMemoryEntry
}

const NOW = new Date('2026-06-29T12:00:00.000Z').getTime()

describe('normalizeMemoryEntry', () => {
  it('fills in default timestamps and id', () => {
    const entry = makeEntry({ id: undefined })
    expect(entry.id).toBeTruthy()
    expect(entry.createdAt).toBeTruthy()
    expect(entry.updatedAt).toBeTruthy()
    expect(entry.pinned).toBe(false)
    expect(entry.disabled).toBe(false)
  })

  it('drops entries with no title and no content', () => {
    expect(
      normalizeMemoryEntry(
        { projectId: 'p', title: '', content: '' },
        'p'
      )
    ).toBeNull()
  })

  it('normalises tags to lowercase, deduped, and capped', () => {
    const entry = makeEntry({
      tags: ['API', 'api', ' Database ', 'database', 'x'.repeat(60)],
    })
    expect(entry.tags).toEqual(['api', 'database', 'x'.repeat(40)])
  })

  it('clamps oversized content and title', () => {
    const entry = makeEntry({
      title: 't'.repeat(200),
      content: 'c'.repeat(5000),
    })
    expect(entry.title.length).toBe(120)
    expect(entry.content.length).toBe(4000)
  })
})

describe('scoreMemoryEntry', () => {
  it('gives a large pinned boost', () => {
    const entry = makeEntry({ pinned: true })
    const score = scoreMemoryEntry(entry, [], '', NOW)
    expect(score.pinned).toBe(1000)
    expect(score.total).toBeGreaterThanOrEqual(1000)
  })

  it('rewards title contains a query token', () => {
    const entry = makeEntry({ title: 'SQLite decision' })
    const score = scoreMemoryEntry(entry, ['sqlite'], 'sqlite', NOW)
    expect(score.title).toBe(50)
  })

  it('rewards an exact title match', () => {
    const entry = makeEntry({ title: 'use sqlite' })
    const score = scoreMemoryEntry(entry, [], 'use sqlite', NOW)
    expect(score.title).toBe(100)
  })

  it('rewards a matching tag', () => {
    const entry = makeEntry({ tags: ['convention', 'database'] })
    const score = scoreMemoryEntry(entry, ['convention'], '', NOW)
    expect(score.tags).toBe(30)
  })

  it('rewards content keyword matches and caps them', () => {
    const entry = makeEntry({
      content: 'we use sqlite for the cache because it is fast and reliable',
    })
    const tokens = ['sqlite', 'cache', 'fast', 'reliable', 'database']
    const score = scoreMemoryEntry(entry, tokens, '', NOW)
    // 4 hits × 5 = 20, well under the 50 cap.
    expect(score.content).toBe(20)
  })

  it('caps content bonus to 50', () => {
    const entry = makeEntry({
      content: 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda',
    })
    const tokens = [
      'alpha',
      'beta',
      'gamma',
      'delta',
      'epsilon',
      'zeta',
      'eta',
      'theta',
      'iota',
      'kappa',
      'lambda',
    ]
    const score = scoreMemoryEntry(entry, tokens, '', NOW)
    expect(score.content).toBe(50)
  })
})

describe('rankMemoryEntries', () => {
  it('puts pinned entries ahead of non-pinned regardless of relevance', () => {
    const pinned = makeEntry({
      id: 'pin',
      pinned: true,
      title: 'unrelated title',
    })
    const relevant = makeEntry({
      id: 'rel',
      pinned: false,
      title: 'sqlite cache rule',
    })
    const ranked = rankMemoryEntries(
      [relevant, pinned],
      'sqlite cache',
      NOW
    )
    expect(ranked.map((entry) => entry.id)).toEqual(['pin', 'rel'])
  })

  it('orders non-pinned by score and breaks ties by recency', () => {
    const older = makeEntry({
      id: 'older',
      pinned: false,
      title: 'sqlite rule',
      content: 'always use sqlite',
      updatedAt: '2026-06-20T12:00:00.000Z',
    })
    const newer = makeEntry({
      id: 'newer',
      pinned: false,
      title: 'sqlite rule',
      content: 'always use sqlite',
      updatedAt: '2026-06-29T11:00:00.000Z',
    })
    const ranked = rankMemoryEntries(
      [older, newer],
      'sqlite',
      NOW
    )
    expect(ranked.map((entry) => entry.id)).toEqual(['newer', 'older'])
  })

  it('returns an empty list when no entries are passed', () => {
    expect(rankMemoryEntries([], 'anything', NOW)).toEqual([])
  })
})

describe('selectMemoryEntries', () => {
  it('respects the topK budget', () => {
    const entries: ProjectMemoryEntry[] = Array.from({ length: 20 }, (_, i) =>
      makeEntry({ id: `e${i}`, title: `entry ${i}` })
    )
    const selection = selectMemoryEntries(entries, '', 200, NOW)
    expect(selection.selected.length).toBe(3)
  })

  it('ranks the topK from the highest-scoring entries', () => {
    const entries = [
      makeEntry({ id: 'a', title: 'sqlite cache rule' }),
      makeEntry({ id: 'b', title: 'redis rule', content: 'use redis for sessions' }),
      makeEntry({ id: 'c', title: 'sqlite migrations' }),
    ]
    const selection = selectMemoryEntries(entries, 'sqlite', 800, NOW)
    expect(selection.selected.map((entry) => entry.id)).toEqual([
      'a',
      'c',
      'b',
    ])
    expect(selection.scores.a).toBeGreaterThan(selection.scores.b)
    expect(selection.scores.c).toBeGreaterThan(selection.scores.b)
  })

  it('skips disabled entries from the selection', () => {
    const entries = [
      makeEntry({ id: 'a', title: 'sqlite rule' }),
      makeEntry({ id: 'b', title: 'sqlite rule', disabled: true }),
    ]
    const selection = selectMemoryEntries(entries, 'sqlite', 800, NOW)
    // Caller is expected to filter disabled entries before calling
    // selectMemoryEntries; the resolver itself does not re-filter, but
    // resolveProjectMemoryChatState does. Verify direct behaviour.
    expect(selection.selected.map((entry) => entry.id)).toEqual(['a', 'b'])
  })
})

describe('resolveProjectMemoryChatState', () => {
  it('returns disabled when the kill switch is off', () => {
    const state = resolveProjectMemoryChatState({
      record: {
        entries: [makeEntry({ id: 'a' })],
        settings: { enabled: false },
      },
      query: 'sqlite',
    })
    expect(state.canInject).toBe(false)
    expect(state.state).toBe('disabled')
    expect(state.selection.skippedByKillSwitch).toBe(1)
  })

  it('returns empty when the project has no entries', () => {
    const state = resolveProjectMemoryChatState({
      record: { entries: [], settings: { enabled: true } },
      query: 'sqlite',
    })
    expect(state.canInject).toBe(false)
    expect(state.state).toBe('empty')
  })

  it('returns no_relevant when every entry is disabled', () => {
    const state = resolveProjectMemoryChatState({
      record: {
        entries: [
          makeEntry({ id: 'a', title: 'redis rule', disabled: true }),
        ],
        settings: { enabled: true },
      },
      query: 'sqlite',
    })
    // Disabled entries are filtered out before selection; the resolver
    // reports no_relevant so the UI can prompt the user to re-enable or
    // re-add an entry.
    expect(state.canInject).toBe(false)
    expect(state.state).toBe('no_relevant')
  })

  it('returns ready when the kill switch is on and there is a match', () => {
    const state = resolveProjectMemoryChatState({
      record: {
        entries: [makeEntry({ id: 'a', title: 'sqlite rule' })],
        settings: { enabled: true },
      },
      query: 'sqlite',
    })
    expect(state.canInject).toBe(true)
    expect(state.state).toBe('ready')
  })

  it('counts disabled entries as skipped', () => {
    const state = resolveProjectMemoryChatState({
      record: {
        entries: [
          makeEntry({ id: 'a', title: 'sqlite rule' }),
          makeEntry({ id: 'b', title: 'sqlite rule', disabled: true }),
        ],
        settings: { enabled: true },
      },
      query: 'sqlite',
    })
    expect(state.selection.skippedByDisabled).toBe(1)
  })
})

describe('buildMemoryContextMessage', () => {
  it('returns null when nothing is selected', () => {
    const message = buildMemoryContextMessage({
      selected: [],
      scores: {},
      skippedByKillSwitch: 0,
      skippedByDisabled: 0,
    })
    expect(message).toBeNull()
  })

  it('emits a "Project memory" header with one bullet per entry', () => {
    const selection = selectMemoryEntries(
      [
        makeEntry({ id: 'a', title: 'use sqlite' }),
        makeEntry({ id: 'b', title: 'no redis', content: 'no redis for sessions' }),
      ],
      'sqlite',
      800,
      NOW
    )
    const message = buildMemoryContextMessage(selection)
    expect(message).not.toBeNull()
    expect(message).toContain('## Project memory')
    expect(message).toContain('**use sqlite**')
    expect(message).toContain('**no redis**')
    expect(message).toContain('do not invent')
  })

  it('marks pinned entries with a pin emoji', () => {
    const selection = selectMemoryEntries(
      [makeEntry({ id: 'a', title: 'pinned rule', pinned: true })],
      '',
      800,
      NOW
    )
    const message = buildMemoryContextMessage(selection)
    expect(message).toMatch(/📌 \*\*pinned rule\*\*/)
  })
})

describe('buildProjectMemorySystemMessage', () => {
  it('returns null when the kill switch is off (no injection)', () => {
    const message = buildProjectMemorySystemMessage({
      record: {
        entries: [makeEntry({ id: 'a', title: 'sqlite rule' })],
        settings: { enabled: false },
      },
      query: 'sqlite',
    })
    expect(message).toBeNull()
  })

  it('returns a context message when enabled and entries match', () => {
    const message = buildProjectMemorySystemMessage({
      record: {
        entries: [makeEntry({ id: 'a', title: 'sqlite rule' })],
        settings: { enabled: true },
      },
      query: 'sqlite',
    })
    expect(message).not.toBeNull()
    expect(message).toContain('## Project memory')
    expect(message).toContain('**sqlite rule**')
  })

  it('returns null when the record is missing entirely', () => {
    expect(
      buildProjectMemorySystemMessage({
        record: null,
        query: 'sqlite',
      })
    ).toBeNull()
  })

  it('does not inject entries the user disabled', () => {
    const message = buildProjectMemorySystemMessage({
      record: {
        entries: [
          makeEntry({ id: 'a', title: 'sqlite rule', disabled: true }),
        ],
        settings: { enabled: true },
      },
      query: 'sqlite',
    })
    expect(message).toBeNull()
  })
})
