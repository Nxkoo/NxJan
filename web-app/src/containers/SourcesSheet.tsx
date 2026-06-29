import { memo, useMemo } from 'react'
import { BookmarkIcon, FileTextIcon, GlobeIcon } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  RagCitationItem,
  WebCitationItem,
  type RagCitation,
  type WebCitation,
} from '@/components/Citations'
import type { MessageCitationEntry } from '@/hooks/useMessageCitations'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { cn } from '@/lib/utils'

type SourcesSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: MessageCitationEntry[]
  total: number
}

const EmptyIllustration = () => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="mx-auto h-32 w-32 text-foreground"
    aria-hidden
  >
    <ellipse cx="60" cy="104" rx="38" ry="4" fill="currentColor" opacity="0.08" />
    <rect
      x="22"
      y="36"
      width="44"
      height="64"
      rx="6"
      className="fill-[var(--yellow)]"
      stroke="currentColor"
      strokeWidth="3"
    />
    <rect
      x="22"
      y="36"
      width="8"
      height="64"
      className="fill-[var(--yellow)]/80"
      stroke="currentColor"
      strokeWidth="3"
    />
    <rect
      x="48"
      y="48"
      width="50"
      height="56"
      rx="6"
      className="fill-[var(--red-soft)]"
      stroke="currentColor"
      strokeWidth="3"
    />
    <rect
      x="48"
      y="48"
      width="8"
      height="56"
      className="fill-[var(--red)]/40"
      stroke="currentColor"
      strokeWidth="3"
    />
    <line
      x1="62"
      y1="62"
      x2="92"
      y2="62"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.4"
    />
    <line
      x1="62"
      y1="70"
      x2="88"
      y2="70"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.4"
    />
    <line
      x1="62"
      y1="78"
      x2="92"
      y2="78"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.4"
    />
    <g transform="translate(96 24)">
      <path
        d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z"
        className="fill-[var(--blue-soft)]"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </g>
    <g transform="translate(14 28)">
      <path
        d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z"
        className="fill-[var(--green-soft)]"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </g>
  </svg>
)

export const SourcesSheet = memo(
  ({ open, onOpenChange, entries, total }: SourcesSheetProps) => {
    const { t } = useTranslation()

    const { ragItems, webItems, queries } = useMemo(() => {
      const rag: { citation: RagCitation; index: number }[] = []
      const web: WebCitation[] = []
      const queries = new Set<string>()
      let ragIndex = 0

      for (const entry of entries) {
        if (entry.payload.query) queries.add(entry.payload.query)
        if (entry.payload.kind === 'rag') {
          for (const citation of entry.payload.citations) {
            rag.push({ citation, index: ragIndex })
            ragIndex++
          }
        } else {
          web.push(...entry.payload.citations)
        }
      }

      return { ragItems: rag, webItems: web, queries: Array.from(queries) }
    }, [entries])

    const hasRag = ragItems.length > 0
    const hasWeb = webItems.length > 0
    const isEmpty = total === 0
    const queryLine = queries.filter(Boolean).join(' · ')

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={cn(
            'w-full sm:max-w-md gap-0 p-0',
            'border-l-4 border-[var(--ink)]',
            'shadow-[-6px_0_0_0_var(--ink)]'
          )}
        >
          <SheetHeader className="border-b-2 border-[var(--border)] p-5 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <SheetTitle
                  className="flex items-center gap-2.5 text-2xl font-extrabold leading-none tracking-tight"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[var(--ink)] bg-[var(--yellow)] text-zinc-900 shadow-[2px_2px_0_0_var(--ink)]">
                    <BookmarkIcon size={17} strokeWidth={2.75} />
                  </span>
                  {t('chat:sources.title')}
                </SheetTitle>
                {queryLine && !isEmpty && (
                  <SheetDescription
                    className="mt-2 text-sm italic text-muted-foreground/90 line-clamp-2"
                    style={{ fontFamily: 'Fraunces, Georgia, serif' }}
                  >
                    &ldquo;{queryLine}&rdquo;
                  </SheetDescription>
                )}
              </div>
              <span
                className="inline-flex h-8 min-w-8 items-center justify-center px-2 rounded-full border-2 border-[var(--ink)] bg-[var(--foreground)] text-[var(--background)] font-extrabold text-sm tabular-nums shadow-[1.5px_1.5px_0_0_var(--ink)]"
                aria-label={`${total} ${t('chat:sources.button')}`}
              >
                {total}
              </span>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center text-center px-4 py-10 text-muted-foreground">
                <EmptyIllustration />
                <p
                  className="mt-4 text-base font-semibold text-foreground/80"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  {t('chat:sources.empty')}
                </p>
                <p
                  className="mt-1.5 text-xs text-muted-foreground/70 italic"
                  style={{ fontFamily: 'Fraunces, Georgia, serif' }}
                >
                  {t('chat:sources.emptyHint')}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {hasRag && (
                  <section
                    className="animate-[sources-section-in_0.35s_ease-out_both]"
                    style={{ animationDelay: '40ms' }}
                  >
                    <SectionLabel
                      icon={<FileTextIcon size={12} strokeWidth={2.75} />}
                      label={t('chat:sources.documents')}
                      count={ragItems.length}
                      tone="blue"
                    />
                    <ul className="mt-3 space-y-2.5">
                      {ragItems.map(({ citation, index }) => (
                        <RagCitationItem
                          key={citation.id}
                          c={citation}
                          index={index}
                        />
                      ))}
                    </ul>
                  </section>
                )}

                {hasWeb && (
                  <section
                    className="animate-[sources-section-in_0.35s_ease-out_both]"
                    style={{ animationDelay: hasRag ? '120ms' : '40ms' }}
                  >
                    <SectionLabel
                      icon={<GlobeIcon size={12} strokeWidth={2.75} />}
                      label={t('chat:sources.web')}
                      count={webItems.length}
                      tone="green"
                    />
                    <ul className="mt-3 space-y-2.5">
                      {webItems.map((c, i) => (
                        <WebCitationItem key={`${c.url}-${i}`} c={c} />
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    )
  }
)
SourcesSheet.displayName = 'SourcesSheet'

const SectionLabel = memo(
  ({
    icon,
    label,
    count,
    tone,
  }: {
    icon: React.ReactNode
    label: string
    count: number
    tone: 'blue' | 'green'
  }) => {
    const palette =
      tone === 'blue'
        ? 'bg-[var(--blue)] text-[var(--paper)]'
        : 'bg-[var(--green)] text-[var(--paper)]'
    return (
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg',
            'border-2 border-[var(--ink)] px-2 py-0.5',
            'text-[10px] font-extrabold uppercase tracking-wider',
            'shadow-[1.5px_1.5px_0_0_var(--ink)]',
            palette
          )}
        >
          {icon}
          {label}
        </span>
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>
    )
  }
)
SectionLabel.displayName = 'SectionLabel'
