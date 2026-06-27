import { useMemo } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  CheckCircle2,
  DatabaseZap,
  ExternalLink,
  Loader2,
  RefreshCw,
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
import { useCodebase } from '@/hooks/useCodebase'
import {
  CODEBASE_MEMORY_SERVER_NAME,
  getCodebaseDisplayName,
  resolveCodebaseChatState,
} from '@/hooks/useCodebase'
import { useMCPServers } from '@/hooks/useMCPServers'
import { useTranslation } from '@/i18n/react-i18next-compat'

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

export default function ProjectCodebaseChip({
  projectId,
  compact,
}: ProjectCodebaseChipProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const {
    meta,
    isIndexing,
    index,
    refresh,
    setEnabled,
  } = useCodebase(projectId)
  const mcpServers = useMCPServers((state) => state.mcpServers)
  const tools = useAppState((state) => state.tools)

  const resolution = useMemo(
    () =>
      resolveCodebaseChatState({
        meta,
        mcpServer: mcpServers[CODEBASE_MEMORY_SERVER_NAME],
        tools,
      }),
    [meta, mcpServers, tools]
  )

  if (!projectId || !meta || resolution.state === 'not_linked') return null

  const displayName = getCodebaseDisplayName(meta)
  const label = (() => {
    if (resolution.state === 'indexed') return t('common:codebase.status.linked')
    if (resolution.state === 'disabled') return t('common:codebase.status.disabled')
    if (resolution.state === 'mcp_disabled') return t('common:codebase.status.mcpDisabled')
    if (resolution.state === 'indexing' || isIndexing) return t('common:codebase.status.indexing')
    return t('common:codebase.status.error')
  })()
  const tone = (() => {
    if (resolution.state === 'indexed') return 'success'
    if (resolution.state === 'disabled') return 'muted'
    if (resolution.state === 'mcp_disabled') return 'warning'
    if (resolution.state === 'indexing' || isIndexing) return 'loading'
    return 'error'
  })()
  const TonalIcon = (() => {
    if (tone === 'success') return CheckCircle2
    if (tone === 'loading') return Loader2
    if (tone === 'warning' || tone === 'error') return TriangleAlert
    return XCircle
  })()

  const handleReindex = () => {
    const confirmed = window.confirm(
      t('common:codebase.reindex.confirm', { name: displayName })
    )
    if (!confirmed) return
    void index().then(() => refresh())
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'group inline-flex max-w-full items-center gap-2 rounded-full border-2 px-3 py-1 text-xs font-semibold leading-none transition-all',
            'shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            'border-[var(--ink)]/15 bg-card/80 text-foreground hover:bg-card',
            tone === 'success' &&
              'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)] hover:bg-[var(--green-soft)]',
            tone === 'muted' &&
              'border-[var(--ink)]/15 bg-card/80 text-muted-foreground hover:bg-card',
            tone === 'warning' &&
              'border-[var(--orange)] bg-[var(--orange-soft)] text-[var(--orange)] hover:bg-[var(--orange-soft)]',
            tone === 'loading' &&
              'border-primary bg-primary/15 text-primary hover:bg-primary/20',
            tone === 'error' &&
              'border-destructive bg-destructive/15 text-destructive hover:bg-destructive/20'
          )}
          data-testid="codebase-chat-chip"
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
          <span className="truncate text-foreground/90">
            {compact ? displayName : displayName}
          </span>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              tone === 'success' &&
                'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]',
              tone === 'muted' &&
                'border-border/80 bg-secondary/70 text-muted-foreground',
              tone === 'warning' &&
                'border-[var(--orange)] bg-[var(--orange-soft)] text-[var(--orange)]',
              tone === 'loading' &&
                'border-primary bg-primary/20 text-primary',
              tone === 'error' &&
                'border-destructive bg-destructive/20 text-destructive'
            )}
          >
            {label}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 rounded-2xl border border-[var(--ink)]/15 bg-card p-0 text-card-foreground shadow-xl shadow-black/15"
      >
        <div className="border-b-2 border-dashed border-border/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-display font-semibold">
                <DatabaseZap className="size-4 shrink-0 text-primary" />
                <span className="truncate">{displayName}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {resolution.message}
              </p>
            </div>
            <Switch
              checked={meta.enabled !== false}
              onCheckedChange={setEnabled}
              aria-label={t('common:codebase.toggleEnabled')}
            />
          </div>
        </div>

        <div className="space-y-3 p-3">
          <Field label={t('common:codebase.fields.folder')} value={meta.folderPath} mono />
          <Field
            label={t('common:codebase.fields.project')}
            value={meta.codebaseMemoryProjectName}
            mono
          />
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border/70 bg-background/60 p-2">
              <Field label={t('common:codebase.fields.nodes')} value={formatNumber(meta.nodes)} />
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 p-2">
              <Field label={t('common:codebase.fields.edges')} value={formatNumber(meta.edges)} />
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 p-2">
              <Field label={t('common:codebase.fields.indexedAt')} value={formatDate(meta.indexedAt)} />
            </div>
          </div>
          {meta.lastError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {meta.lastError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t-2 border-dashed border-border/60 p-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReindex}
            disabled={isIndexing || !meta.folderPath}
          >
            {isIndexing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            <span>{t('common:codebase.reindex.button')}</span>
          </Button>
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
        </div>
      </PopoverContent>
    </Popover>
  )
}
