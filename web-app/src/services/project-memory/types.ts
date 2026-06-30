/**
 * Project Memory Types
 *
 * Project memory is a small, project-scoped knowledge store that the chat
 * can pull from. It is intentionally separate from chat history (managed by
 * the thread store) and from codebase metadata (managed by useCodebase).
 *
 * The data lives entirely in localStorage. No source code, embeddings, or
 * remote services are involved.
 */

/**
 * A single fact / decision / summary the user wants the model to remember
 * for a given project.
 *
 * - `id` is a stable per-project UUID; the storage layer never reuses it
 *   after removal so React keys stay deterministic.
 * - `title` is a short label shown in the UI and used by the resolver as
 *   a high-signal match.
 * - `content` is the body the model reads when an entry is selected.
 * - `sourceChatId` is the optional thread the entry came from, kept for
 *   the UI ("Captured from chat X") and not used by the resolver.
 * - `tags` are user-supplied keywords. Lightweight; the resolver scores
 *   exact and partial matches but does not require them.
 * - `pinned` entries always rank first (after the kill switch), regardless
 *   of relevance. Pinned + disabled is treated as "do not inject".
 * - `disabled` is a per-entry soft-disable that hides the row from the
 *   context builder but keeps it in storage for the UI.
 */
export type ProjectMemoryEntry = {
  id: string
  projectId: string
  title: string
  content: string
  sourceChatId?: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
  pinned: boolean
  disabled?: boolean
}

/**
 * Per-project settings. The `enabled` flag is the kill switch the user
 * asked for: when false, no memory context is injected into chats for the
 * project, regardless of the entries stored.
 */
export type ProjectMemorySettings = {
  enabled: boolean
}

/**
 * The full per-project memory record persisted in localStorage.
 */
export type ProjectMemoryRecord = {
  entries: ProjectMemoryEntry[]
  settings: ProjectMemorySettings
}

/**
 * Resolver result: a ranked slice of entries the chat is allowed to
 * inject, plus the signals that produced the ranking. Useful for tests
 * and for the UI to show "why this entry was selected".
 */
export type ProjectMemorySelection = {
  /** Entries that survived the kill switch, disabled filter, and budget. */
  selected: ProjectMemoryEntry[]
  /** Per-entry ranking score. Higher = more relevant. */
  scores: Record<string, number>
  /** Entries skipped because of the kill switch. */
  skippedByKillSwitch: number
  /** Entries skipped because the user disabled them. */
  skippedByDisabled: number
}

export interface ProjectMemoryService {
  /** Resolve which entries to inject for a given query and budget. */
  resolveSelection(input: {
    projectId: string
    query: string
    budgetTokens?: number
  }): ProjectMemorySelection

  /** Build the prompt addendum the system message will carry. */
  buildContextMessage(selection: ProjectMemorySelection): string | null
}
