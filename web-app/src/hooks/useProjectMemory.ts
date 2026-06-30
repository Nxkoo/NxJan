import { useCallback, useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { localStorageKey } from '@/constants/localStorage'
import type {
  ProjectMemoryEntry,
  ProjectMemoryRecord,
  ProjectMemorySelection,
} from '@/services/project-memory/types'

export type ProjectMemoryChatState =
  | 'disabled'
  | 'empty'
  | 'no_relevant'
  | 'ready'

export type ProjectMemoryChatResolution = {
  state: ProjectMemoryChatState
  canInject: boolean
  hasEntries: boolean
  enabled: boolean
  selection: ProjectMemorySelection
  message: string
}

type ProjectMemoryState = {
  records: Record<string, ProjectMemoryRecord>
  loadAll: () => void
  ensureRecord: (projectId: string) => ProjectMemoryRecord
  setSettings: (
    projectId: string,
    settings: Partial<ProjectMemorySettings>
  ) => void
  upsertEntry: (
    projectId: string,
    entry: ProjectMemoryEntry
  ) => ProjectMemoryEntry
  removeEntry: (projectId: string, entryId: string) => void
  togglePinned: (projectId: string, entryId: string) => void
  toggleDisabled: (projectId: string, entryId: string) => void
  getRecord: (projectId: string) => ProjectMemoryRecord
}

type ProjectMemorySettings = ProjectMemoryRecord['settings']

type StoredShape = {
  state?: {
    /**
     * v1 shape: `{ [projectId]: { entries, settings } }`.
     * A legacy v0 shape of `{ [projectId]: ProjectMemoryEntry[] }` is
     * accepted and migrated on read.
     */
    records?: Record<string, unknown>
  }
  version?: number
}

const storageKey = localStorageKey.projectMemory
const STORAGE_VERSION = 1

const DEFAULT_SETTINGS: ProjectMemorySettings = { enabled: true }

const MAX_TITLE_LENGTH = 120
const MAX_CONTENT_LENGTH = 4000
const MAX_TAGS = 16
const MAX_TAG_LENGTH = 40

function generateMemoryId(): string {
  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto?.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID()
  }
  return `mem_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function trimTo(value: string, max: number): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max)
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().slice(0, MAX_TAG_LENGTH)
}

export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    const normalized = normalizeTag(tag)
    if (!normalized) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
    if (out.length >= MAX_TAGS) break
  }
  return out
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'string' && value) {
    const time = new Date(value).getTime()
    if (!Number.isNaN(time)) return new Date(time).toISOString()
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Date(value).toISOString()
  }
  return new Date().toISOString()
}

export function normalizeMemoryEntry(
  entry: Partial<ProjectMemoryEntry> | null | undefined,
  projectId: string
): ProjectMemoryEntry | null {
  if (!entry || typeof entry !== 'object') return null
  const id =
    typeof entry.id === 'string' && entry.id
      ? entry.id
      : generateMemoryId()
  const title = trimTo(entry.title ?? '', MAX_TITLE_LENGTH)
  const content = trimTo(entry.content ?? '', MAX_CONTENT_LENGTH)
  if (!title && !content) return null
  return {
    id,
    projectId,
    title: title || content.slice(0, MAX_TITLE_LENGTH),
    content,
    sourceChatId:
      typeof entry.sourceChatId === 'string' && entry.sourceChatId
        ? entry.sourceChatId
        : null,
    tags: normalizeTags(entry.tags),
    createdAt: normalizeTimestamp(entry.createdAt),
    updatedAt: normalizeTimestamp(entry.updatedAt ?? entry.createdAt),
    pinned: entry.pinned === true,
    disabled: entry.disabled === true,
  }
}

function normalizeRecord(
  value: unknown,
  projectId: string
): ProjectMemoryRecord | null {
  if (!value) return null
  if (Array.isArray(value)) {
    // v0 shape: bare entry array.
    const entries = value
      .map((entry) =>
        normalizeMemoryEntry(
          entry as Partial<ProjectMemoryEntry>,
          projectId
        )
      )
      .filter((entry): entry is ProjectMemoryEntry => entry !== null)
    return { entries, settings: { ...DEFAULT_SETTINGS } }
  }
  if (typeof value === 'object') {
    const raw = value as {
      entries?: unknown
      settings?: Partial<ProjectMemorySettings>
    }
    const entries = Array.isArray(raw.entries)
      ? raw.entries
          .map((entry) =>
            normalizeMemoryEntry(
              entry as Partial<ProjectMemoryEntry>,
              projectId
            )
          )
          .filter((entry): entry is ProjectMemoryEntry => entry !== null)
      : []
    const settings: ProjectMemorySettings = {
      enabled: raw.settings?.enabled !== false,
    }
    return { entries, settings }
  }
  return null
}

function readStorage(): Record<string, ProjectMemoryRecord> {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredShape
    const records = parsed.state?.records ?? {}
    const result: Record<string, ProjectMemoryRecord> = {}
    for (const [projectId, value] of Object.entries(records)) {
      const normalized = normalizeRecord(value, projectId)
      if (normalized) result[projectId] = normalized
    }
    return result
  } catch (error) {
    console.error('Failed to read project memory from storage:', error)
    return {}
  }
}

function writeStorage(records: Record<string, ProjectMemoryRecord>): void {
  try {
    const payload: StoredShape = {
      state: { records },
      version: STORAGE_VERSION,
    }
    localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch (error) {
    console.error('Failed to persist project memory:', error)
  }
}

const emptyRecord = (): ProjectMemoryRecord => ({
  entries: [],
  settings: { ...DEFAULT_SETTINGS },
})

export const useProjectMemoryStore = create<ProjectMemoryState>(
  (set, get) => ({
    records: {},
    loadAll: () => {
      set({ records: readStorage() })
    },
    ensureRecord: (projectId) => {
      const current = get().records[projectId]
      if (current) return current
      const next: ProjectMemoryRecord = {
        entries: [],
        settings: { ...DEFAULT_SETTINGS },
      }
      const nextAll = { ...get().records, [projectId]: next }
      set({ records: nextAll })
      writeStorage(nextAll)
      return next
    },
    setSettings: (projectId, patch) => {
      const current = get().records[projectId] ?? emptyRecord()
      const next: ProjectMemoryRecord = {
        entries: current.entries,
        settings: { ...current.settings, ...patch },
      }
      const nextAll = { ...get().records, [projectId]: next }
      set({ records: nextAll })
      writeStorage(nextAll)
    },
    upsertEntry: (projectId, entry) => {
      const normalized = normalizeMemoryEntry(entry, projectId)
      if (!normalized) {
        return entry
      }
      const current = get().records[projectId] ?? emptyRecord()
      const existingIndex = current.entries.findIndex(
        (existing) => existing.id === normalized.id
      )
      const nextEntries =
        existingIndex >= 0
          ? current.entries.map((existing, idx) =>
              idx === existingIndex
                ? { ...existing, ...normalized, updatedAt: new Date().toISOString() }
                : existing
            )
          : [...current.entries, normalized]
      const next: ProjectMemoryRecord = {
        entries: nextEntries,
        settings: { ...current.settings },
      }
      const nextAll = { ...get().records, [projectId]: next }
      set({ records: nextAll })
      writeStorage(nextAll)
      return normalized
    },
    removeEntry: (projectId, entryId) => {
      const current = get().records[projectId]
      if (!current) return
      const nextEntries = current.entries.filter(
        (entry) => entry.id !== entryId
      )
      const next: ProjectMemoryRecord = {
        entries: nextEntries,
        settings: { ...current.settings },
      }
      const nextAll = { ...get().records, [projectId]: next }
      set({ records: nextAll })
      writeStorage(nextAll)
    },
    togglePinned: (projectId, entryId) => {
      const current = get().records[projectId]
      if (!current) return
      const nextEntries = current.entries.map((entry) =>
        entry.id === entryId
          ? { ...entry, pinned: !entry.pinned, updatedAt: new Date().toISOString() }
          : entry
      )
      const next: ProjectMemoryRecord = {
        entries: nextEntries,
        settings: { ...current.settings },
      }
      const nextAll = { ...get().records, [projectId]: next }
      set({ records: nextAll })
      writeStorage(nextAll)
    },
    toggleDisabled: (projectId, entryId) => {
      const current = get().records[projectId]
      if (!current) return
      const nextEntries = current.entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              disabled: !entry.disabled,
              updatedAt: new Date().toISOString(),
            }
          : entry
      )
      const next: ProjectMemoryRecord = {
        entries: nextEntries,
        settings: { ...current.settings },
      }
      const nextAll = { ...get().records, [projectId]: next }
      set({ records: nextAll })
      writeStorage(nextAll)
    },
    getRecord: (projectId) => get().records[projectId] ?? emptyRecord(),
  })
)

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'do',
  'for',
  'from',
  'has',
  'have',
  'how',
  'i',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'or',
  'our',
  'so',
  'that',
  'the',
  'their',
  'there',
  'this',
  'to',
  'us',
  'was',
  'we',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'you',
  'your',
])

function tokenize(input: string): string[] {
  if (!input) return []
  const tokens = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9\u00c0-\u017f]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
  return Array.from(new Set(tokens))
}

export type ProjectMemoryScoreBreakdown = {
  pinned: number
  title: number
  tags: number
  content: number
  recency: number
  total: number
}

const PINNED_BOOST = 1000
const TITLE_EXACT_BOOST = 100
const TITLE_CONTAINS_BOOST = 50
const TAG_EXACT_BOOST = 30
const TAG_CONTAINS_BOOST = 10
const CONTENT_TOKEN_BOOST = 5
const MAX_CONTENT_TOKEN_BONUS = 50
const RECENCY_MAX_BOOST = 20
const RECENCY_HALF_LIFE_DAYS = 14

export function scoreMemoryEntry(
  entry: ProjectMemoryEntry,
  queryTokens: string[],
  query: string,
  now: number
): ProjectMemoryScoreBreakdown {
  const pinned = entry.pinned ? PINNED_BOOST : 0
  const titleLower = (entry.title || '').toLowerCase()
  const queryLower = query.trim().toLowerCase()
  let title = 0
  if (queryLower) {
    if (titleLower && titleLower === queryLower) {
      title = TITLE_EXACT_BOOST
    } else if (titleLower && titleLower.includes(queryLower)) {
      title = TITLE_CONTAINS_BOOST
    } else if (titleLower && queryTokens.length > 0) {
      for (const token of queryTokens) {
        if (titleLower.includes(token)) {
          title = Math.max(title, TITLE_CONTAINS_BOOST)
        }
      }
    }
  }

  let tags = 0
  if (queryTokens.length > 0 && entry.tags.length > 0) {
    for (const tag of entry.tags) {
      for (const token of queryTokens) {
        if (tag === token) {
          tags = Math.max(tags, TAG_EXACT_BOOST)
        } else if (tag.includes(token) || token.includes(tag)) {
          tags = Math.max(tags, TAG_CONTAINS_BOOST)
        }
      }
    }
  }

  let content = 0
  if (queryTokens.length > 0 && entry.content) {
    const contentLower = entry.content.toLowerCase()
    let matchedTokens = 0
    for (const token of queryTokens) {
      if (contentLower.includes(token)) {
        content += CONTENT_TOKEN_BOOST
        matchedTokens += 1
        if (matchedTokens >= 10) break
      }
    }
    if (content > MAX_CONTENT_TOKEN_BONUS) {
      content = MAX_CONTENT_TOKEN_BONUS
    }
  }

  const updatedAt = new Date(entry.updatedAt).getTime()
  const recencyDecay = Number.isFinite(updatedAt)
    ? Math.max(0, (now - updatedAt) / (1000 * 60 * 60 * 24))
    : 0
  const recency = Math.max(
    0,
    RECENCY_MAX_BOOST * Math.exp(-recencyDecay / RECENCY_HALF_LIFE_DAYS)
  )

  return {
    pinned,
    title,
    tags,
    content,
    recency: Math.round(recency * 100) / 100,
    total: pinned + title + tags + content + recency,
  }
}

export function rankMemoryEntries(
  entries: ProjectMemoryEntry[],
  query: string,
  now: number = Date.now()
): ProjectMemoryEntry[] {
  const queryTokens = tokenize(query)
  const scored = entries.map((entry) => {
    const score = scoreMemoryEntry(entry, queryTokens, query, now)
    return { entry, score }
  })
  scored.sort((a, b) => {
    if (b.score.total !== a.score.total) return b.score.total - a.score.total
    const aTime = new Date(a.entry.updatedAt).getTime()
    const bTime = new Date(b.entry.updatedAt).getTime()
    return bTime - aTime
  })
  return scored.map((row) => row.entry)
}

export function selectMemoryEntries(
  entries: ProjectMemoryEntry[],
  query: string,
  budgetTokens: number = 800,
  now: number = Date.now()
): ProjectMemorySelection {
  const topK = Math.max(3, Math.min(15, Math.floor(budgetTokens / 60)))
  const ranked = rankMemoryEntries(entries, query, now)
  const selected: ProjectMemoryEntry[] = []
  const scores: Record<string, number> = {}

  const pinned = ranked.filter((entry) => entry.pinned)
  const rest = ranked.filter((entry) => !entry.pinned)

  for (const entry of pinned) {
    if (selected.length >= topK) break
    selected.push(entry)
    scores[entry.id] = PINNED_BOOST
  }
  for (const entry of rest) {
    if (selected.length >= topK) break
    selected.push(entry)
    scores[entry.id] = 1
  }

  // For ranked entries the actual score is what we computed, so re-export it.
  const queryTokens = tokenize(query)
  for (const row of ranked.map((entry) => ({
    entry,
    score: scoreMemoryEntry(entry, queryTokens, query, now),
  }))) {
    if (selected.some((entry) => entry.id === row.entry.id)) {
      scores[row.entry.id] = row.score.total
    }
  }

  return { selected, scores, skippedByKillSwitch: 0, skippedByDisabled: 0 }
}

export function buildMemoryContextMessage(
  selection: ProjectMemorySelection
): string | null {
  if (!selection.selected.length) return null
  const lines: string[] = []
  for (const entry of selection.selected) {
    const pinnedMarker = entry.pinned ? '📌 ' : ''
    const title = entry.title?.trim()
    if (title) {
      lines.push(`- ${pinnedMarker}**${title}** — ${entry.content}`)
    } else {
      lines.push(`- ${pinnedMarker}${entry.content}`)
    }
  }
  if (lines.length === 0) return null
  return [
    '## Project memory',
    '',
    'The user has stored these facts / decisions / summaries for this project.',
    'Use them when relevant. If a user question matches one of the entries',
    'above, answer from memory. If nothing above matches, say explicitly that',
    'the decision or fact is not stored yet — do not invent one.',
    '',
    ...lines,
  ].join('\n')
}

export function resolveProjectMemoryChatState({
  record,
  query,
  budgetTokens,
}: {
  record: ProjectMemoryRecord | null | undefined
  query: string
  budgetTokens?: number
}): ProjectMemoryChatResolution {
  const safeRecord: ProjectMemoryRecord = record ?? emptyRecord()
  if (safeRecord.settings.enabled === false) {
    return {
      state: 'disabled',
      canInject: false,
      hasEntries: safeRecord.entries.length > 0,
      enabled: false,
      selection: {
        selected: [],
        scores: {},
        skippedByKillSwitch: safeRecord.entries.length,
        skippedByDisabled: 0,
      },
      message: 'Project memory is disabled for this project.',
    }
  }

  const enabledEntries = safeRecord.entries.filter(
    (entry) => entry.disabled !== true
  )
  const selection = selectMemoryEntries(
    enabledEntries,
    query,
    budgetTokens ?? 800
  )
  if (selection.selected.length === 0) {
    return {
      state: safeRecord.entries.length === 0 ? 'empty' : 'no_relevant',
      canInject: false,
      hasEntries: safeRecord.entries.length > 0,
      enabled: true,
      selection: {
        ...selection,
        skippedByDisabled: safeRecord.entries.length - enabledEntries.length,
      },
      message:
        safeRecord.entries.length === 0
          ? 'No project memory stored.'
          : 'No relevant project memory for this turn.',
    }
  }

  return {
    state: 'ready',
    canInject: true,
    hasEntries: safeRecord.entries.length > 0,
    enabled: true,
    selection: {
      ...selection,
      skippedByDisabled: safeRecord.entries.length - enabledEntries.length,
    },
    message: 'Project memory ready.',
  }
}

export function buildProjectMemorySystemMessage({
  record,
  query,
  budgetTokens,
}: {
  record: ProjectMemoryRecord | null | undefined
  query: string
  budgetTokens?: number
}): string | null {
  const resolution = resolveProjectMemoryChatState({
    record,
    query,
    budgetTokens,
  })
  if (!resolution.canInject) return null
  return buildMemoryContextMessage(resolution.selection)
}

type UseProjectMemoryReturn = {
  record: ProjectMemoryRecord
  entries: ProjectMemoryEntry[]
  enabled: boolean
  hasEntries: boolean
  addEntry: (input: {
    title: string
    content: string
    tags?: string[]
    pinned?: boolean
    sourceChatId?: string | null
  }) => ProjectMemoryEntry
  updateEntry: (
    entryId: string,
    patch: Partial<Omit<ProjectMemoryEntry, 'id' | 'projectId' | 'createdAt'>>
  ) => void
  removeEntry: (entryId: string) => void
  togglePinned: (entryId: string) => void
  toggleDisabled: (entryId: string) => void
  setEnabled: (enabled: boolean) => void
}

export function useProjectMemory(
  projectId: string | undefined
): UseProjectMemoryReturn {
  const records = useProjectMemoryStore((s) => s.records)
  const loadAll = useProjectMemoryStore((s) => s.loadAll)
  const upsertEntry = useProjectMemoryStore((s) => s.upsertEntry)
  const removeEntry = useProjectMemoryStore((s) => s.removeEntry)
  const togglePinned = useProjectMemoryStore((s) => s.togglePinned)
  const toggleDisabled = useProjectMemoryStore((s) => s.toggleDisabled)
  const setSettings = useProjectMemoryStore((s) => s.setSettings)

  useEffect(() => {
    if (Object.keys(useProjectMemoryStore.getState().records).length === 0) {
      loadAll()
    }
  }, [loadAll])

  const record = useMemo<ProjectMemoryRecord>(() => {
    if (!projectId) return emptyRecord()
    return records[projectId] ?? emptyRecord()
  }, [records, projectId])

  const addEntry = useCallback<UseProjectMemoryReturn['addEntry']>(
    (input) => {
      if (!projectId) {
        throw new Error('Cannot add a memory entry without a project id.')
      }
      const now = new Date().toISOString()
      const entry = normalizeMemoryEntry(
        {
          projectId,
          title: input.title,
          content: input.content,
          tags: input.tags,
          pinned: input.pinned ?? false,
          sourceChatId: input.sourceChatId ?? null,
          createdAt: now,
          updatedAt: now,
        },
        projectId
      )
      if (!entry) {
        throw new Error('Memory entry must have a title or content.')
      }
      return upsertEntry(projectId, entry)
    },
    [projectId, upsertEntry]
  )

  const updateEntry = useCallback<
    UseProjectMemoryReturn['updateEntry']
  >(
    (entryId, patch) => {
      if (!projectId) return
      const existing = record.entries.find((entry) => entry.id === entryId)
      if (!existing) return
      const next: ProjectMemoryEntry = {
        ...existing,
        ...patch,
        tags: patch.tags ? normalizeTags(patch.tags) : existing.tags,
        title:
          patch.title !== undefined
            ? trimTo(patch.title, MAX_TITLE_LENGTH) || existing.title
            : existing.title,
        content:
          patch.content !== undefined
            ? trimTo(patch.content, MAX_CONTENT_LENGTH)
            : existing.content,
        updatedAt: new Date().toISOString(),
      }
      upsertEntry(projectId, next)
    },
    [projectId, record.entries, upsertEntry]
  )

  const setEnabled = useCallback(
    (enabled: boolean) => {
      if (!projectId) return
      setSettings(projectId, { enabled })
    },
    [projectId, setSettings]
  )

  return {
    record,
    entries: record.entries,
    enabled: record.settings.enabled !== false,
    hasEntries: record.entries.length > 0,
    addEntry,
    updateEntry,
    removeEntry,
    togglePinned,
    toggleDisabled,
    setEnabled,
  }
}
