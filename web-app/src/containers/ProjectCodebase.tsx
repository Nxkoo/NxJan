import { useCallback, useState } from 'react'
import { useTranslation } from '@/i18n/react-i18next-compat'
import {
  DatabaseZap,
  FolderSearch,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useServiceHub } from '@/hooks/useServiceHub'
import {
  CODEBASE_MEMORY_SERVER_NAME,
  getCodebaseDisplayName,
  normalizeCodebaseStatus,
  useCodebase,
  useCodebases,
} from '@/hooks/useCodebase'
import { useMCPServers } from '@/hooks/useMCPServers'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type ProjectCodebaseProps = {
  projectId: string
}

function formatRelativeTime(ts: string | undefined): string {
  if (!ts) return '—'
  const time = new Date(ts).getTime()
  if (Number.isNaN(time)) return ts
  const diff = Date.now() - time
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`
  return new Date(ts).toLocaleString()
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString()
}

export default function ProjectCodebase({
  projectId,
}: ProjectCodebaseProps) {
  const { t } = useTranslation()
  const serviceHub = useServiceHub()
  const {
    codebases,
    activeCount,
    addCodebase,
    removeCodebase,
    setCodebaseEnabled,
  } = useCodebases(projectId)
  const mcpServers = useMCPServers((state) => state.mcpServers)
  const mcpServerConfigured = Boolean(mcpServers[CODEBASE_MEMORY_SERVER_NAME])
  const mcpServerActive = Boolean(
    mcpServers[CODEBASE_MEMORY_SERVER_NAME]?.active
  )
  const [isPicking, setIsPicking] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  // Subscribe to availability once for the section-level probe so the CLI
  // warning / status badge react to a single shared probe.
  const { availability, refreshAvailability, isChecking } = useCodebase(
    projectId,
    codebases[0]?.id
  )

  const handlePickFolder = useCallback(async () => {
    setIsPicking(true)
    try {
      const selection = await serviceHub.dialog().open({
        directory: true,
        multiple: false,
      })
      if (!selection) return
      const folderPath = Array.isArray(selection) ? selection[0] : selection
      if (!folderPath) return
      addCodebase(folderPath)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error)
      toast.error('Failed to pick folder', { description: message })
    } finally {
      setIsPicking(false)
    }
  }, [serviceHub, addCodebase])

  const handleRemove = useCallback(
    (codebaseId: string) => {
      const entry = codebases.find((c) => c.id === codebaseId)
      const label = entry ? getCodebaseDisplayName(entry) : 'codebase'
      const confirmed = window.confirm(
        t('common:codebase.remove.confirm', { name: label })
      )
      if (!confirmed) return
      removeCodebase(codebaseId)
      toast.success('Codebase removed from this project', {
        description: label,
      })
    },
    [codebases, removeCodebase, t]
  )

  const statusBadge = (() => {
    if (!availability) {
      return {
        label: t('common:codebase.status.probing'),
        tone: 'muted',
      }
    }
    if (!availability.available) {
      return {
        label: t('common:codebase.status.cliMissing'),
        tone: 'destructive',
      }
    }
    if (codebases.length === 0) {
      return {
        label: t('common:codebase.status.notLinked'),
        tone: 'muted',
      }
    }
    if (activeCount > 0) {
      return {
        label:
          activeCount > 1
            ? t('common:codebase.activeCount', { count: activeCount })
            : t('common:codebase.status.linked'),
        tone: 'success',
      }
    }
    return {
      label: t('common:codebase.status.pending'),
      tone: 'muted',
    }
  })()

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-display font-semibold flex items-center gap-2">
            <FolderSearch className="size-4 text-primary" />
            {t('common:codebase.title')}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-prose">
            {t('common:codebase.description')}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
            statusBadge.tone === 'success' &&
              'border-[var(--green)]/70 bg-[var(--green-soft)] text-[var(--green)] dark:border-[var(--green)] dark:text-[var(--green)]',
            statusBadge.tone === 'destructive' &&
              'border-[var(--red)]/70 bg-[var(--red-soft)] text-[var(--red)]',
            statusBadge.tone === 'muted' &&
              'border-border/60 bg-secondary text-muted-foreground'
          )}
          data-testid="codebase-status-badge"
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              statusBadge.tone === 'success' && 'bg-[var(--green)]',
              statusBadge.tone === 'destructive' && 'bg-[var(--red)]',
              statusBadge.tone === 'muted' && 'bg-muted-foreground/60'
            )}
          />
          {statusBadge.label}
        </span>
      </div>

      {availability && !availability.available && (
        <div
          className="rounded-xl border border-dashed border-[var(--orange)]/30 bg-[var(--orange-soft)]/40 px-3 py-2.5 text-xs text-foreground mb-3"
          data-testid="codebase-cli-warning"
        >
          <p className="font-medium text-[var(--orange)] mb-0.5">
            {t('common:codebase.cliMissing.title')}
          </p>
          <p className="text-muted-foreground">
            {availability?.error ??
              t('common:codebase.cliMissing.description')}
          </p>
        </div>
      )}

      {codebases.length > 0 && mcpServerConfigured && !mcpServerActive && (
        <div
          className="rounded-xl border border-dashed border-[var(--yellow)]/40 bg-[var(--yellow-soft)]/60 px-3 py-2.5 text-xs text-foreground mb-3"
          data-testid="codebase-mcp-warning"
        >
          <p className="font-medium text-[var(--ink)] mb-0.5">
            {t('common:codebase.mcpDisabled.title')}
          </p>
          <p className="text-muted-foreground">
            {t('common:codebase.mcpDisabled.description')}
          </p>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePickFolder}
          disabled={isPicking}
          data-testid="codebase-add-folder"
        >
          {isPicking ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Plus className="size-3" />
          )}
          <span>{t('common:codebase.addFolder')}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            void refreshAvailability()
          }}
          disabled={isChecking}
          aria-label={t('common:codebase.probeCli')}
          title={t('common:codebase.probeCli')}
        >
          {isChecking ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
        </Button>
      </div>

      {codebases.length === 0 ? (
        <div
          className="rounded-xl border border-dashed border-border-soft bg-secondary/30 p-4 text-xs text-muted-foreground"
          data-testid="codebase-empty"
        >
          {t('common:codebase.empty')}
        </div>
      ) : (
        <ul className="space-y-2" data-testid="codebase-list">
          {codebases.map((entry) => (
            <CodebaseRow
              key={entry.id}
              codebaseId={entry.id}
              projectId={projectId}
              isPending={pendingId === entry.id}
              onSetPending={setPendingId}
              onToggle={(enabled) => setCodebaseEnabled(entry.id, enabled)}
              onRemove={() => handleRemove(entry.id)}
              onReveal={async (folderPath) => {
                try {
                  await serviceHub.opener().revealItemInDir(folderPath)
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : String(error)
                  toast.error('Failed to open folder', { description: message })
                }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

type CodebaseRowProps = {
  projectId: string
  codebaseId: string
  isPending: boolean
  onSetPending: (id: string | null) => void
  onToggle: (enabled: boolean) => void
  onRemove: () => void
  onReveal: (folderPath: string) => Promise<void> | void
}

function CodebaseRow({
  projectId,
  codebaseId,
  isPending,
  onSetPending,
  onToggle,
  onRemove,
  onReveal,
}: CodebaseRowProps) {
  const { t } = useTranslation()
  const {
    meta,
    isIndexing,
    isRefreshing,
    index,
    refresh,
  } = useCodebase(projectId, codebaseId)

  const displayName = meta ? getCodebaseDisplayName(meta) : ''
  const status = meta
    ? normalizeCodebaseStatus(
        meta.status,
        Boolean(meta.codebaseMemoryProjectName)
      )
    : 'not_linked'

  const handleRefresh = useCallback(() => {
    onSetPending(codebaseId)
    void refresh().then(() => onSetPending(null))
  }, [codebaseId, refresh, onSetPending])

  if (!meta) return null
  return (
    <li
      className="rounded-2xl border border-dashed border-border/50 bg-background/20 p-4 text-xs shadow-inner shadow-black/5"
      data-testid="codebase-row"
      data-codebase-id={meta.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <DatabaseZap className="size-3.5 shrink-0 text-primary" />
            <span
              className="truncate font-display text-sm font-semibold text-foreground"
              data-testid="codebase-row-name"
            >
              {displayName}
            </span>
            <CodebaseStatusPill status={status} />
          </div>
          <p
            className="mt-1 truncate font-mono text-[11px] text-muted-foreground"
            title={meta.folderPath}
          >
            {meta.folderPath}
          </p>
          <p
            className="truncate font-mono text-[11px] text-muted-foreground"
            data-testid="codebase-row-project"
          >
            {meta.codebaseMemoryProjectName ||
              t('common:codebase.fields.notIndexedYet')}
          </p>
        </div>
        <Switch
          checked={meta.enabled !== false}
          onCheckedChange={onToggle}
          aria-label={t('common:codebase.toggleEnabled')}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatCell
          label={t('common:codebase.fields.nodes')}
          value={formatNumber(meta.nodes ?? null)}
        />
        <StatCell
          label={t('common:codebase.fields.edges')}
          value={formatNumber(meta.edges ?? null)}
        />
        <StatCell
          label={t('common:codebase.fields.indexedAt')}
          value={formatRelativeTime(meta.indexedAt)}
        />
      </div>

      {meta.excludedDirs && meta.excludedDirs.length > 0 && (
        <p className="mt-2 text-muted-foreground">
          {t('common:codebase.fields.excluded', {
            dirs: meta.excludedDirs.join(', '),
          })}
        </p>
      )}
      {meta.lastError && (
        <p className="mt-2 break-words text-[var(--red)]">
          {t('common:codebase.fields.lastError', { error: meta.lastError })}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            void index()
          }}
          disabled={!meta.folderPath || isIndexing}
          data-testid="codebase-row-index"
        >
          {isIndexing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Search className="size-3" />
          )}
          <span>
            {status === 'indexed'
              ? t('common:codebase.reindex.button')
              : t('common:codebase.index')}
          </span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isIndexing}
        >
          {isRefreshing || isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          <span>{t('common:codebase.refresh')}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void onReveal(meta.folderPath)
          }}
          disabled={!meta.folderPath}
        >
          <span>{t('common:codebase.openFolder')}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={t('common:codebase.remove')}
          title={t('common:codebase.remove')}
        >
          <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </li>
  )
}

function CodebaseStatusPill({ status }: { status: string }) {
  const { t } = useTranslation()
  const label = (() => {
    if (status === 'indexed') return t('common:codebase.status.linked')
    if (status === 'indexing') return t('common:codebase.status.indexing')
    if (status === 'error') return t('common:codebase.status.error')
    return t('common:codebase.status.pending')
  })()
  const tone = (() => {
    if (status === 'indexed') return 'success'
    if (status === 'indexing') return 'loading'
    if (status === 'error') return 'destructive'
    return 'muted'
  })()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        tone === 'success' &&
          'border-[var(--green)]/40 bg-[var(--green-soft)] text-[var(--green)]',
        tone === 'loading' &&
          'border-primary/40 bg-primary/15 text-primary',
        tone === 'destructive' &&
          'border-[var(--red)]/40 bg-[var(--red-soft)] text-[var(--red)]',
        tone === 'muted' &&
          'border-border-soft bg-secondary/70 text-muted-foreground'
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          tone === 'success' && 'bg-[var(--green)]',
          tone === 'loading' && 'bg-primary',
          tone === 'destructive' && 'bg-[var(--red)]',
          tone === 'muted' && 'bg-muted-foreground/60'
        )}
      />
      {label}
    </span>
  )
}

function StatCell({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/25 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground/80">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-display font-semibold text-foreground tabular-nums">
        {value}
      </p>
    </div>
  )
}
