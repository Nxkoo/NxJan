import { memo, useMemo, useState } from 'react'
import { FileTextIcon, GlobeIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useAttachmentName,
  useEnsureAttachmentNames,
} from '@/hooks/useAttachmentNames'

export type RagCitation = {
  id: string
  text: string
  score: number
  file_id: string
  chunk_file_order?: number
}

export type WebCitation = {
  url: string
  title?: string
  text?: string
  score?: number
  published_date?: string
  author?: string
  favicon?: string
}

export type CitationsPayload =
  | {
      kind: 'rag'
      query?: string
      scope?: 'thread' | 'project'
      threadId?: string
      projectId?: string
      citations: RagCitation[]
    }
  | {
      kind: 'web'
      query?: string
      citations: WebCitation[]
    }

const formatScore = (s: number | undefined) =>
  typeof s === 'number' ? s.toFixed(2) : ''

const cardBase = cn(
  'group/cit relative rounded-2xl border-2 border-[var(--ink)]',
  'bg-[var(--card)] text-foreground',
  'shadow-[2px_2px_0_0_var(--ink)]',
  'transition-all duration-150 ease-out',
  'hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--ink)]'
)

export const RagCitationItem = memo(
  ({
    c,
    index,
    anchorId,
  }: {
    c: RagCitation
    index: number
    anchorId?: string
  }) => {
  const [expanded, setExpanded] = useState(false)
  const name = useAttachmentName(c.file_id) || `${c.file_id.slice(0, 8)}…`
  return (
    <li
      id={anchorId}
      className={cn(
        cardBase,
        'scroll-mt-16 px-3 py-2 text-xs target:ring-2 target:ring-[var(--blue)]/60'
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg border-2 border-[var(--ink)] bg-[var(--blue)] text-[var(--paper)] font-extrabold tabular-nums shadow-[1px_1px_0_0_var(--ink)]">
          {index + 1}
        </span>
        <FileTextIcon
          className="size-3.5 shrink-0 text-muted-foreground"
          strokeWidth={2.5}
        />
        <span className="truncate font-semibold">{name}</span>
        {typeof c.chunk_file_order === 'number' && (
          <span className="text-muted-foreground">#{c.chunk_file_order}</span>
        )}
        <span className="ml-auto rounded-md border border-[var(--border)] bg-[var(--paper-muted)] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-foreground/80 font-bold">
          {formatScore(c.score)}
        </span>
        <ChevronRightIcon
          className={cn(
            'size-3.5 shrink-0 text-foreground/70 transition-transform duration-200',
            expanded && 'rotate-90'
          )}
          strokeWidth={2.5}
        />
      </button>
      {expanded && c.text && (
        <p
          className="mt-2.5 ml-8 rounded-xl border-2 border-[var(--border)] bg-[var(--paper-muted)]/60 px-3 py-2 text-[11.5px] leading-relaxed text-foreground/85 whitespace-pre-wrap"
          style={{ fontFamily: 'Fraunces, Georgia, serif' }}
        >
          {c.text}
        </p>
      )}
    </li>
  )
  }
)
RagCitationItem.displayName = 'RagCitationItem'

export const WebCitationItem = memo(({ c }: { c: WebCitation }) => {
  const [expanded, setExpanded] = useState(false)
  let host = ''
  try {
    host = new URL(c.url).hostname.replace(/^www\./, '')
  } catch {
    host = c.url
  }
  return (
    <li className={cn(cardBase, 'px-3 py-2 text-xs')}>
      <div className="flex items-center gap-2">
        {c.favicon ? (
          <img
            src={c.favicon}
            alt=""
            className="size-5 rounded-md border border-[var(--border)] bg-[var(--paper)] p-0.5"
          />
        ) : (
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg border-2 border-[var(--ink)] bg-[var(--green)] text-[var(--paper)] shadow-[1px_1px_0_0_var(--ink)]">
            <GlobeIcon size={12} strokeWidth={2.75} />
          </span>
        )}
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer noopener"
          className="truncate font-semibold text-foreground hover:underline"
          title={c.url}
        >
          {c.title || host}
        </a>
        <span className="ml-auto truncate text-[10px] text-muted-foreground/80 font-mono">
          {host}
        </span>
        {typeof c.score === 'number' && (
          <span className="rounded-md border border-[var(--border)] bg-[var(--paper-muted)] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-foreground/80 font-bold">
            {formatScore(c.score)}
          </span>
        )}
        {c.text && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex size-5 items-center justify-center rounded-md text-foreground/70 hover:bg-[var(--paper-muted)]"
            aria-label="toggle snippet"
          >
            <ChevronRightIcon
              className={cn(
                'size-3.5 transition-transform duration-200',
                expanded && 'rotate-90'
              )}
              strokeWidth={2.5}
            />
          </button>
        )}
      </div>
      {expanded && c.text && (
        <p
          className="mt-2.5 ml-8 rounded-xl border-2 border-[var(--border)] bg-[var(--paper-muted)]/60 px-3 py-2 text-[11.5px] leading-relaxed text-foreground/85 whitespace-pre-wrap"
          style={{ fontFamily: 'Fraunces, Georgia, serif' }}
        >
          {c.text}
        </p>
      )}
    </li>
  )
})
WebCitationItem.displayName = 'WebCitationItem'

export const Citations = memo(
  ({
    payload,
    anchorPrefix,
    indexOffset = 0,
  }: {
    payload: CitationsPayload
    anchorPrefix?: string
    // Number/anchor cards from this base so a turn's multiple retrieve cards
    // share one continuous numbering that matches the inline superscripts.
    indexOffset?: number
  }) => {
  useEnsureAttachmentNames(
    payload.kind === 'rag' ? payload.scope : undefined,
    payload.kind === 'rag'
      ? payload.scope === 'project'
        ? payload.projectId
        : payload.threadId
      : undefined
  )

  const items = useMemo(() => {
    if (payload.kind === 'rag') {
      return payload.citations.map((c, i) => {
        const n = i + indexOffset
        return (
          <RagCitationItem
            key={c.id}
            c={c}
            index={n}
            anchorId={anchorPrefix ? `${anchorPrefix}-${n + 1}` : undefined}
          />
        )
      })
    }
    return payload.citations.map((c, i) => (
      <WebCitationItem key={`${c.url}-${i}`} c={c} />
    ))
  }, [payload, anchorPrefix, indexOffset])

  if (!items.length) return null

  const heading =
    payload.kind === 'rag'
      ? `${payload.citations.length} document ${
          payload.citations.length === 1 ? 'citation' : 'citations'
        }`
      : `${payload.citations.length} web ${
          payload.citations.length === 1 ? 'source' : 'sources'
        }`

  return (
    <div className="mt-4 space-y-2">
      <h4
        className="font-extrabold text-muted-foreground text-xs uppercase tracking-wider"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {heading}
        {payload.query && (
          <span
            className="ml-2 normal-case font-normal text-muted-foreground/70 italic"
            style={{ fontFamily: 'Fraunces, Georgia, serif' }}
          >
            for &ldquo;{payload.query}&rdquo;
          </span>
        )}
      </h4>
      <ul className="space-y-1.5">{items}</ul>
    </div>
  )
})
Citations.displayName = 'Citations'
