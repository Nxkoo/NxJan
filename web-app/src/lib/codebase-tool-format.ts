export type ToolParamRow = {
  key: string
  value: string
}

export type ToolCallDisplay = {
  toolName: string
  title: string
  project?: string
  query?: string
  resultCount?: number
  params: ToolParamRow[]
  rawInput: string
  rawOutput: string
  snippets: string[]
}

const TITLE_BY_TOOL: Record<string, string> = {
  search_graph: 'Searched code graph',
  search_code: 'Searched code',
  trace_path: 'Traced code path',
  query_graph: 'Queried code graph',
  get_code_snippet: 'Fetched code snippet',
  get_architecture: 'Read architecture',
}

function safeParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return value
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  const parsed = safeParseJson(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  return parsed as Record<string, unknown>
}

function stringify(value: unknown): string {
  const parsed = safeParseJson(value)
  if (typeof parsed === 'string') return parsed
  try {
    return JSON.stringify(parsed, null, 2)
  } catch {
    return String(value ?? '')
  }
}

function displayValue(value: unknown): string {
  const parsed = safeParseJson(value)
  if (typeof parsed === 'string') return parsed
  if (typeof parsed === 'number' || typeof parsed === 'boolean') {
    return String(parsed)
  }
  if (parsed === null || parsed === undefined) return ''
  try {
    return JSON.stringify(parsed)
  } catch {
    return String(parsed)
  }
}

function extractResultCount(value: unknown): number | undefined {
  const parsed = safeParseJson(value)
  if (Array.isArray(parsed)) return parsed.length
  if (!parsed || typeof parsed !== 'object') return undefined
  const record = parsed as Record<string, unknown>
  for (const key of ['results', 'matches', 'nodes', 'edges', 'items', 'classes']) {
    const candidate = record[key]
    if (Array.isArray(candidate)) return candidate.length
    if (typeof candidate === 'number') return candidate
  }
  if (Array.isArray(record.content)) {
    for (const item of record.content) {
      const contentRecord = toRecord(item)
      const text = contentRecord?.text
      const count = extractResultCount(text)
      if (typeof count === 'number') return count
    }
    return record.content.length
  }
  return undefined
}

function extractSnippets(value: unknown): string[] {
  const parsed = safeParseJson(value)
  const snippets: string[] = []
  const visit = (item: unknown) => {
    const normalized = safeParseJson(item)
    if (typeof normalized === 'string') {
      const trimmed = normalized.trim()
      if (trimmed) snippets.push(trimmed.slice(0, 1200))
      return
    }
    if (Array.isArray(normalized)) {
      normalized.slice(0, 4).forEach(visit)
      return
    }
    if (!normalized || typeof normalized !== 'object') return
    const record = normalized as Record<string, unknown>
    const citationParts = ['name', 'class', 'method', 'file', 'path']
      .map((key) => record[key])
      .filter((value): value is string => typeof value === 'string' && Boolean(value))
    if (citationParts.length > 0) {
      snippets.push(citationParts.join(' - '))
    }
    for (const key of ['snippet', 'code', 'text', 'content']) {
      if (typeof record[key] === 'string') visit(record[key])
    }
    for (const key of ['content', 'results', 'matches', 'items', 'nodes']) {
      if (Array.isArray(record[key])) record[key].slice(0, 4).forEach(visit)
    }
  }
  visit(parsed)
  return Array.from(new Set(snippets)).slice(0, 4)
}

export function formatToolCallDisplay(
  toolName: string,
  input: unknown,
  output: unknown
): ToolCallDisplay {
  const paramsRecord = toRecord(input) ?? {}
  const params = Object.entries(paramsRecord).map(([key, value]) => ({
    key,
    value: displayValue(value),
  }))
  const queryParts = [
    paramsRecord.label,
    paramsRecord.name_pattern,
    paramsRecord.query,
    paramsRecord.symbol,
    paramsRecord.path,
  ]
    .map(displayValue)
    .filter(Boolean)

  return {
    toolName,
    title: TITLE_BY_TOOL[toolName] ?? `Used ${toolName.replaceAll('_', ' ')}`,
    project: typeof paramsRecord.project === 'string' ? paramsRecord.project : undefined,
    query: queryParts.length > 0 ? queryParts.join(' / ') : undefined,
    resultCount: extractResultCount(output),
    params,
    rawInput: stringify(input),
    rawOutput: stringify(output),
    snippets: extractSnippets(output),
  }
}
