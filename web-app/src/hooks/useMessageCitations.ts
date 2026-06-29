import { useMemo } from 'react'
import type { UIMessage } from 'ai'
import { parseCitationsFromToolOutput } from '@/lib/citation-parser'
import type {
  CitationsPayload,
  RagCitation,
  WebCitation,
} from '@/components/Citations'

export type MessageCitationEntry = {
  payload: CitationsPayload
  toolIndex: number
}

export type MessageCitations = {
  /** Aggregated RAG citations across all tool parts, in part order. */
  ragCitations: RagCitation[]
  /** Offset for each tool part index so inline numbering continues globally. */
  citationOffsets: Map<number, number>
  /** All citation payloads (RAG and web) found in the message. */
  entries: MessageCitationEntry[]
  /** Total number of individual citations. */
  total: number
}

const WEB_TOOL_PATTERN = /^(browser|web|search|fetch_url|fetch_url_content|web_search|web_fetch|browse)/i

const URL_REGEX = /https?:\/\/[^\s<>"'`)\]]+/gi

const stripTrailingPunctuation = (url: string) =>
  url.replace(/[.,;:!?)\]}>]+$/g, '')

const hostFromUrl = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const outputToString = (output: unknown): string => {
  if (output == null) return ''
  if (typeof output === 'string') return output
  if (typeof output === 'number' || typeof output === 'boolean') {
    return String(output)
  }
  if (Array.isArray(output)) {
    return output
      .map((item) => {
        if (item && typeof item === 'object' && 'text' in item) {
          return String((item as { text: unknown }).text ?? '')
        }
        if (typeof item === 'string') return item
        try {
          return JSON.stringify(item)
        } catch {
          return ''
        }
      })
      .join('\n')
  }
  if (typeof output === 'object') {
    const o = output as { content?: unknown; text?: unknown }
    if (Array.isArray(o.content)) {
      return o.content
        .map((c) => {
          if (c && typeof c === 'object' && 'text' in c) {
            return String((c as { text: unknown }).text ?? '')
          }
          return ''
        })
        .join('\n')
    }
    if (typeof o.text === 'string') return o.text
    try {
      return JSON.stringify(output)
    } catch {
      return ''
    }
  }
  return ''
}

const buildWebCitationsFromText = (
  text: string,
  query?: string
): WebCitation[] | null => {
  const seen = new Set<string>()
  const citations: WebCitation[] = []
  for (const match of text.matchAll(URL_REGEX)) {
    const url = stripTrailingPunctuation(match[0])
    if (!/^https?:\/\//.test(url)) continue
    if (seen.has(url)) continue
    seen.add(url)
    citations.push({
      url,
      title: hostFromUrl(url),
      text: query,
    })
  }
  return citations.length > 0 ? citations : null
}

const extractFallbackWebPayload = (
  toolName: string,
  output: unknown,
  query?: string
): CitationsPayload | null => {
  if (!WEB_TOOL_PATTERN.test(toolName)) return null
  const text = outputToString(output)
  if (!text.trim()) return null
  const citations = buildWebCitationsFromText(text, query)
  if (!citations) return null
  return { kind: 'web', query, citations }
}

const extractQueryFromInput = (input: unknown): string | undefined => {
  if (!input || typeof input !== 'object') return undefined
  const o = input as Record<string, unknown>
  for (const key of ['query', 'q', 'url', 'prompt', 'search']) {
    const value = o[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

export function useMessageCitations(message: UIMessage): MessageCitations {
  return useMemo(() => {
    const ragCitations: RagCitation[] = []
    const offsets = new Map<number, number>()
    const entries: MessageCitationEntry[] = []
    let total = 0

    if (message.role === 'assistant') {
      const parts = message.parts as Array<{
        type: string
        state?: string
        output?: unknown
        input?: unknown
      }>
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (!part.type?.startsWith('tool-')) continue
        if (part.state !== 'output-available') continue

        let parsed = parseCitationsFromToolOutput(part.output)
        if (!parsed) {
          const toolName = part.type.slice('tool-'.length)
          const query = extractQueryFromInput(part.input)
          parsed = extractFallbackWebPayload(toolName, part.output, query)
        }
        if (!parsed) continue

        if (parsed.kind === 'rag') {
          offsets.set(i, ragCitations.length)
          ragCitations.push(...parsed.citations)
        }

        entries.push({ payload: parsed, toolIndex: i })
        total += parsed.citations.length
      }
    }

    return { ragCitations, citationOffsets: offsets, entries, total }
  }, [message.parts, message.role])
}
