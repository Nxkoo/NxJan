import { useCallback, useState } from 'react'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { FolderSearch, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useServiceHub } from '@/hooks/useServiceHub'
import {
  CODEBASE_MEMORY_SERVER_NAME,
  normalizeCodebaseStatus,
  useCodebase,
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
    meta,
    isIndexing,
    isRefreshing,
    isChecking,
    availability,
    setFolder,
    index,
    refresh,
    clear,
    refreshAvailability,
  } = useCodebase(projectId)
  const mcpServers = useMCPServers((state) => state.mcpServers)
  const mcpServerConfigured = Boolean(mcpServers[CODEBASE_MEMORY_SERVER_NAME])
  const mcpServerActive = Boolean(
    mcpServers[CODEBASE_MEMORY_SERVER_NAME]?.active
  )
  const [isPicking, setIsPicking] = useState(false)

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
      setFolder(folderPath)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error)
      toast.error('Failed to pick folder', { description: message })
    } finally {
      setIsPicking(false)
    }
  }, [serviceHub, setFolder])

  const handleReveal = useCallback(async () => {
    if (!meta?.folderPath) return
    try {
      await serviceHub.opener().revealItemInDir(meta.folderPath)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error)
      toast.error('Failed to open folder', { description: message })
    }
  }, [meta?.folderPath, serviceHub])

  const handleClear = useCallback(() => {
    clear()
    toast.success('Codebase removed from this project')
  }, [clear])

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
    if (!meta) {
      return {
        label: t('common:codebase.status.notLinked'),
        tone: 'muted',
      }
    }
    const normalizedStatus = normalizeCodebaseStatus(
      meta.status,
      Boolean(meta.codebaseMemoryProjectName)
    )
    if (normalizedStatus === 'indexed') {
      return {
        label: t('common:codebase.status.linked'),
        tone: 'success',
      }
    }
    if (normalizedStatus === 'error') {
      return {
        label: t('common:codebase.status.error'),
        tone: 'destructive',
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

      {meta && mcpServerConfigured && !mcpServerActive && (
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

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePickFolder}
          disabled={isPicking || isIndexing}
        >
          {isPicking ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <FolderSearch className="size-3" />
          )}
          <span>
            {meta
              ? t('common:codebase.changeFolder')
              : t('common:codebase.addFolder')}
          </span>
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            void index()
          }}
          disabled={!meta || isIndexing}
          data-testid="codebase-index-button"
        >
          {isIndexing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Search className="size-3" />
          )}
          <span>{t('common:codebase.index')}</span>
        </Button>
        {meta && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void refresh()
              }}
              disabled={isRefreshing || isIndexing}
            >
              {isRefreshing ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              <span>{t('common:codebase.refresh')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReveal}
              disabled={!meta.folderPath}
            >
              <span>{t('common:codebase.openFolder')}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleClear}
              aria-label={t('common:codebase.remove')}
              title={t('common:codebase.remove')}
            >
              <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          </>
        )}
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

      {meta ? (
        <div
          className="rounded-2xl border border-dashed border-border/50 bg-background/20 p-4 text-xs shadow-inner shadow-black/5"
          data-testid="codebase-meta"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <MetaRow
                label={t('common:codebase.fields.project')}
                value={
                  meta.codebaseMemoryProjectName ||
                  t('common:codebase.fields.notIndexedYet')
                }
                strong={Boolean(meta.codebaseMemoryProjectName)}
                testId="codebase-project-name"
              />
              <MetaRow
                label={t('common:codebase.fields.folder')}
                value={meta.folderPath}
                mono
              />
            </div>
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
            <p className="text-muted-foreground pt-1">
              {t('common:codebase.fields.excluded', {
                dirs: meta.excludedDirs.join(', '),
              })}
            </p>
          )}
          {meta.lastError && (
            <p className="text-[var(--red)] pt-1 break-words">
              {t('common:codebase.fields.lastError', {
                error: meta.lastError,
              })}
            </p>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl border border-dashed border-border-soft bg-secondary/30 p-4 text-xs text-muted-foreground"
          data-testid="codebase-empty"
        >
          {t('common:codebase.empty')}
        </div>
      )}
    </div>
  )
}

function MetaRow({
  label,
  value,
  mono,
  strong,
  testId,
}: {
  label: string
  value: string
  mono?: boolean
  strong?: boolean
  testId?: string
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80 shrink-0">
        {label}
      </span>
      <span
        className={cn(
          'truncate min-w-0 text-foreground',
          mono && 'font-mono text-[11px]',
          strong && 'font-display text-sm font-semibold text-primary'
        )}
        data-testid={testId}
        title={value}
      >
        {value}
      </span>
    </div>
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
