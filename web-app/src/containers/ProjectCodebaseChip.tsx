import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  CheckCircle2,
  DatabaseZap,
  ExternalLink,
  Loader2,
  Settings,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { route } from '@/constants/routes'
import { useAppState } from '@/hooks/useAppState'
import {
  CODEBASE_MEMORY_SERVER_NAME,
  getCodebaseDisplayName,
  resolveCodebasesChatState,
  useCodebases,
} from '@/hooks/useCodebase'
import { useMCPServers } from '@/hooks/useMCPServers'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { useKeyboardListNavigation } from '@/hooks/useKeyboardListNavigation'

type ProjectCodebaseChipProps = {
  projectId?: string
  compact?: boolean
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString()
}

function formatDate(value: string | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/90">
        {label}
      </div>
      <div
        className={cn(
          'break-words text-xs leading-snug text-foreground',
          mono && 'font-mono text-[11px]'
        )}
      >
        {value || '-'}
      </div>
    </div>
  )
}

function statusLabel(
  state: ReturnType<typeof resolveCodebasesChatState>['state'],
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (state === 'indexed') return t('common:codebase.status.linked')
  if (state === 'disabled') return t('common:codebase.status.disabled')
  if (state === 'mcp_disabled') return t('common:codebase.status.mcpDisabled')
  if (state === 'indexing') return t('common:codebase.status.indexing')
  if (state === 'not_linked') return t('common:codebase.status.notLinked')
  return t('common:codebase.status.error')
}

function statusTone(
  state: ReturnType<typeof resolveCodebasesChatState>['state']
): 'success' | 'muted' | 'warning' | 'loading' | 'error' {
  if (state === 'indexed') return 'success'
  if (state === 'disabled' || state === 'not_linked') return 'muted'
  if (state === 'mcp_disabled') return 'warning'
  if (state === 'indexing') return 'loading'
  return 'error'
}

export default function ProjectCodebaseChip({
  projectId,
  compact,
}: ProjectCodebaseChipProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const { codebases, activeCount, setCodebaseEnabled } =
    useCodebases(projectId)
  const mcpServers = useMCPServers((state) => state.mcpServers)
  const tools = useAppState((state) => state.tools)
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const codebaseListRef = useRef<HTMLUListElement>(null)

  const resolution = useMemo(
    () =>
      resolveCodebasesChatState({
        metas: codebases,
        mcpServer: mcpServers[CODEBASE_MEMORY_SERVER_NAME],
        tools,
      }),
    [codebases, mcpServers, tools]
  )

  const selectableCodebases = useMemo(
    () => (activeCount > 1 ? codebases : []),
    [activeCount, codebases]
  )

  const handleCodebaseSelect = useCallback(
    (index: number) => {
      const entry = selectableCodebases[index]
      if (!entry) return
      setCodebaseEnabled(entry.id, entry.enabled === false)
    },
    [selectableCodebases, setCodebaseEnabled]
  )

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen)
    setHighlightedIndex(isOpen ? 0 : -1)
  }, [])

  const { handleKeyDown } = useKeyboardListNavigation({
    isOpen: open,
    itemCount: selectableCodebases.length,
    highlightedIndex,
    setHighlightedIndex,
    onOpen: () => {
      setOpen(true)
      setHighlightedIndex(0)
    },
    onClose: () => setOpen(false),
    onSelect: handleCodebaseSelect,
    listRef: codebaseListRef,
  })

  if (!projectId || codebases.length === 0) return null

  // Skip the chip entirely when every linked codebase is not ready (still
  // indexing, no project name, etc.) and there's nothing useful to surface.
  // This preserves the legacy behavior where the chip is hidden when no
  // codebase is linked.
  if (
    codebases.length > 0 &&
    resolution.state === 'not_linked' &&
    activeCount === 0
  ) {
    return null
  }

  const displayName = resolution.primary
    ? getCodebaseDisplayName(resolution.primary)
    : 'Codebase'
  const chipLabel =
    activeCount > 1
      ? t('common:codebase.activeCount', { count: activeCount })
      : displayName
  const tone = statusTone(resolution.state)
  const label = statusLabel(resolution.state, t)
  const TonalIcon = (() => {
    if (tone === 'success') return CheckCircle2
    if (tone === 'loading') return Loader2
    if (tone === 'warning' || tone === 'error') return TriangleAlert
    return XCircle
  })()

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            /* Badge, not button. The outer shape is what carries the
               outline (subtle by default, only colored when the status
               is a non-default one). The inner status pill is small
               enough to read like a label, not a sub-component. */
            'group inline-flex min-w-0 items-center gap-2 overflow-hidden rounded-full border px-3 py-1 text-xs font-semibold leading-none transition-all',
            compact ? 'max-w-[min(100%,18rem)]' : 'max-w-[min(100%,22rem)]',
            'shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            'border-border-soft bg-surface-3 text-foreground hover:bg-paper-soft',
            tone === 'success' &&
              'border-[var(--green)]/40 bg-[var(--green-soft)]/70 text-[var(--green)] hover:bg-[var(--green-soft)]',
            tone === 'muted' &&
              'border-border-soft bg-surface-3 text-muted-foreground hover:bg-paper-soft',
            tone === 'warning' &&
              'border-[var(--orange)]/40 bg-[var(--orange-soft)]/70 text-[var(--orange)] hover:bg-[var(--orange-soft)]',
            tone === 'loading' &&
              'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15',
            tone === 'error' &&
              'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15'
          )}
          data-testid="codebase-chat-chip"
          onKeyDown={handleKeyDown}
        >
          <TonalIcon
            className={cn(
              'size-3.5 shrink-0',
              tone === 'loading' && 'animate-spin',
              tone === 'success' && 'text-[var(--green)]',
              tone === 'muted' && 'text-muted-foreground',
              tone === 'warning' && 'text-[var(--orange)]',
              tone === 'error' && 'text-destructive'
            )}
          />
          <span className="min-w-0 flex-1 truncate text-foreground/90">
            {chipLabel}
          </span>
          <span
            className={cn(
              'hidden shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide min-[620px]:inline-flex',
              tone === 'success' &&
                'border-[var(--green)]/40 bg-[var(--green-soft)] text-[var(--green)]',
              tone === 'muted' &&
                'border-border-soft bg-secondary/70 text-muted-foreground',
              tone === 'warning' &&
                'border-[var(--orange)]/40 bg-[var(--orange-soft)] text-[var(--orange)]',
              tone === 'loading' &&
                'border-primary/40 bg-primary/15 text-primary',
              tone === 'error' &&
                'border-destructive/40 bg-destructive/15 text-destructive'
            )}
          >
            {label}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 rounded-2xl border border-border-soft bg-popover p-0 text-card-foreground shadow-xl shadow-black/10"
        onKeyDown={handleKeyDown}
      >
        <div className="border-b border-dashed border-border-soft p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-display font-semibold">
                <DatabaseZap className="size-4 shrink-0 text-primary" />
                <span className="truncate">
                  {activeCount > 1
                    ? t('common:codebase.activeCount', { count: activeCount })
                    : displayName}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {resolution.message}
              </p>
            </div>
            {resolution.primary && activeCount <= 1 && (
              <Switch
                checked={resolution.primary.enabled !== false}
                onCheckedChange={(value) =>
                  setCodebaseEnabled(resolution.primary!.id, value)
                }
                aria-label={t('common:codebase.toggleEnabled')}
              />
            )}
          </div>
        </div>

        {activeCount <= 1 && resolution.primary && (
          <div className="space-y-3 p-3">
            <Field
              label={t('common:codebase.fields.folder')}
              value={resolution.primary.folderPath}
              mono
            />
            <Field
              label={t('common:codebase.fields.project')}
              value={resolution.primary.codebaseMemoryProjectName}
              mono
            />
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border/70 bg-background/60 p-2">
                <Field
                  label={t('common:codebase.fields.nodes')}
                  value={formatNumber(resolution.primary.nodes)}
                />
              </div>
              <div className="rounded-xl border border-border/70 bg-background/60 p-2">
                <Field
                  label={t('common:codebase.fields.edges')}
                  value={formatNumber(resolution.primary.edges)}
                />
              </div>
              <div className="rounded-xl border border-border/70 bg-background/60 p-2">
                <Field
                  label={t('common:codebase.fields.indexedAt')}
                  value={formatDate(resolution.primary.indexedAt)}
                />
              </div>
            </div>
            {resolution.primary.lastError && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {resolution.primary.lastError}
              </div>
            )}
          </div>
        )}

        {activeCount > 1 && (
          <div className="space-y-1.5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/90">
              {t('common:codebase.linkedCodebases')}
            </p>
            <ul
              ref={codebaseListRef}
              className="space-y-1.5"
              data-testid="codebase-popover-list"
            >
              {codebases.map((entry, index) => {
                const display = getCodebaseDisplayName(entry)
                const isActive =
                  entry.enabled !== false &&
                  Boolean(entry.codebaseMemoryProjectName)
                return (
                  <li
                    key={entry.id}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5',
                      'border-border-soft bg-background/60',
                      highlightedIndex === index &&
                        'bg-secondary/70 ring-1 ring-ring/40'
                    )}
                    data-testid="codebase-popover-row"
                    data-keyboard-option
                    data-keyboard-index={index}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'size-1.5 shrink-0 rounded-full',
                            isActive
                              ? 'bg-[var(--green)]'
                              : 'bg-muted-foreground/50'
                          )}
                        />
                        <span className="truncate text-xs font-semibold text-foreground">
                          {display}
                        </span>
                      </div>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">
                        {entry.codebaseMemoryProjectName || entry.folderPath}
                      </p>
                    </div>
                    <Switch
                      checked={entry.enabled !== false}
                      onCheckedChange={(value) =>
                        setCodebaseEnabled(entry.id, value)
                      }
                      aria-label={t('common:codebase.toggleEnabled')}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-dashed border-border-soft p-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void router.navigate({
                to: route.projectDetail,
                params: { projectId },
              })
            }}
          >
            <Settings className="size-3" />
            <span>{t('common:codebase.openSettings')}</span>
            <ExternalLink className="size-3 opacity-60" />
          </Button>
          {activeCount <= 1 && resolution.primary && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
              {t('common:codebase.singular')}
            </span>
          )}
          {activeCount > 1 && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
              {t('common:codebase.plural', { count: activeCount })}
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
