import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/i18n/react-i18next-compat'
import {
  Brain,
  Loader2,
  Pin,
  Plus,
  Save,
  Trash2,
  X,
  Eye,
  EyeOff,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useProjectMemory } from '@/hooks/useProjectMemory'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ProjectMemoryEntry } from '@/services/project-memory/types'

type ProjectMemoryProps = {
  projectId: string
}

type DraftEntry = {
  id?: string
  title: string
  content: string
  tags: string[]
  pinned: boolean
  disabled: boolean
}

const EMPTY_DRAFT: DraftEntry = {
  title: '',
  content: '',
  tags: [],
  pinned: false,
  disabled: false,
}

function tagsToString(tags: string[]): string {
  return tags.join(', ')
}

function stringToTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
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

export default function ProjectMemory({ projectId }: ProjectMemoryProps) {
  const { t } = useTranslation()
  const {
    entries,
    enabled,
    hasEntries,
    addEntry,
    updateEntry,
    removeEntry,
    togglePinned,
    toggleDisabled,
    setEnabled,
  } = useProjectMemory(projectId)
  const [editing, setEditing] = useState<DraftEntry | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Open the "Add" dialog automatically on first-ever mount when there is
  // no project yet. We don't want to auto-open; the user clicks Add.
  useEffect(() => {
    setEditing(null)
  }, [projectId])

  const pinnedCount = entries.filter((entry) => entry.pinned).length
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  const openAddDialog = useCallback(() => {
    setEditing({ ...EMPTY_DRAFT })
  }, [])

  const openEditDialog = useCallback((entry: ProjectMemoryEntry) => {
    setEditing({
      id: entry.id,
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      pinned: entry.pinned,
      disabled: entry.disabled === true,
    })
  }, [])

  const closeDialog = useCallback(() => {
    if (isSubmitting) return
    setEditing(null)
  }, [isSubmitting])

  const handleSubmit = useCallback(() => {
    if (!editing) return
    const title = editing.title.trim()
    const content = editing.content.trim()
    if (!title && !content) {
      toast.error(t('common:projectMemory.validation.required'))
      return
    }
    setIsSubmitting(true)
    try {
      if (editing.id) {
        updateEntry(editing.id, {
          title: title || content.slice(0, 120),
          content,
          tags: stringToTags(tagsToString(editing.tags)),
          pinned: editing.pinned,
          disabled: editing.disabled,
        })
        toast.success(t('common:projectMemory.actions.save'))
      } else {
        addEntry({
          title: title || content.slice(0, 120),
          content,
          tags: stringToTags(tagsToString(editing.tags)),
          pinned: editing.pinned,
          sourceChatId: null,
        })
        toast.success(t('common:projectMemory.actions.add'))
      }
      setEditing(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [editing, addEntry, updateEntry, t])

  const handleRemove = useCallback(
    (entry: ProjectMemoryEntry) => {
      const label = entry.title?.trim() || entry.content.slice(0, 60)
      const confirmed = window.confirm(
        t('common:projectMemory.remove.confirm', { name: label })
      )
      if (!confirmed) return
      removeEntry(entry.id)
      toast.success(t('common:projectMemory.actions.delete'))
    },
    [removeEntry, t]
  )

  const handleToggleEnabled = useCallback(
    (next: boolean) => {
      setEnabled(next)
    },
    [setEnabled]
  )

  return (
    <div className="p-5 border-t border-dashed border-border-soft">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-display font-semibold flex items-center gap-2">
            <Brain className="size-4 text-primary" />
            {t('common:projectMemory.title')}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-prose">
            {t('common:projectMemory.description')}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
            enabled
              ? 'border-[var(--green)]/70 bg-[var(--green-soft)] text-[var(--green)]'
              : 'border-border/60 bg-secondary text-muted-foreground'
          )}
          data-testid="project-memory-status"
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              enabled ? 'bg-[var(--green)]' : 'bg-muted-foreground/60'
            )}
          />
          {enabled
            ? t('common:projectMemory.status.ready')
            : t('common:projectMemory.status.disabled')}
        </span>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-dashed border-border/60 bg-secondary/30 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">
            {t('common:projectMemory.killSwitch.label')}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t('common:projectMemory.killSwitch.description')}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggleEnabled}
          aria-label={t('common:projectMemory.killSwitch.label')}
          data-testid="project-memory-killswitch"
        />
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={openAddDialog}
          data-testid="project-memory-add"
        >
          <Plus className="size-3" />
          <span>{t('common:projectMemory.add')}</span>
        </Button>
        <p className="text-[10px] text-muted-foreground">
          {t('common:projectMemory.footer', {
            count: entries.length,
            pinned: pinnedCount,
            state: enabled
              ? t('common:projectMemory.status.ready')
              : t('common:projectMemory.status.disabled'),
          })}
        </p>
      </div>

      {sortedEntries.length === 0 ? (
        <div
          className="rounded-xl border border-dashed border-border-soft bg-secondary/30 p-4 text-xs text-muted-foreground"
          data-testid="project-memory-empty"
        >
          {hasEntries
            ? t('common:projectMemory.empty')
            : t('common:projectMemory.empty')}
        </div>
      ) : (
        <ul className="space-y-2" data-testid="project-memory-list">
          {sortedEntries.map((entry) => (
            <MemoryRow
              key={entry.id}
              entry={entry}
              onEdit={() => openEditDialog(entry)}
              onRemove={() => handleRemove(entry)}
              onTogglePinned={() => togglePinned(entry.id)}
              onToggleDisabled={() => toggleDisabled(entry.id)}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing?.id
                ? t('common:projectMemory.dialog.editTitle')
                : t('common:projectMemory.dialog.addTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('common:projectMemory.description')}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <MemoryEntryForm
              draft={editing}
              onChange={(patch) =>
                setEditing((prev) => (prev ? { ...prev, ...patch } : prev))
              }
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

type MemoryRowProps = {
  entry: ProjectMemoryEntry
  onEdit: () => void
  onRemove: () => void
  onTogglePinned: () => void
  onToggleDisabled: () => void
}

function MemoryRow({
  entry,
  onEdit,
  onRemove,
  onTogglePinned,
  onToggleDisabled,
}: MemoryRowProps) {
  const { t } = useTranslation()
  return (
    <li
      className="rounded-2xl border border-dashed border-border/50 bg-background/20 p-4 text-xs shadow-inner shadow-black/5"
      data-testid="project-memory-row"
      data-memory-id={entry.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {entry.pinned ? (
              <Pin className="size-3 shrink-0 text-primary" />
            ) : (
              <Brain className="size-3 shrink-0 text-muted-foreground" />
            )}
            <span
              className="truncate font-display text-sm font-semibold text-foreground"
              data-testid="project-memory-row-title"
            >
              {entry.title}
            </span>
            {entry.disabled && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-secondary/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                data-testid="project-memory-row-disabled-pill"
              >
                {t('common:projectMemory.status.disabled')}
              </span>
            )}
          </div>
          <p
            className="mt-1 whitespace-pre-wrap text-xs text-foreground/90"
            data-testid="project-memory-row-content"
          >
            {entry.content}
          </p>
          {entry.tags.length > 0 && (
            <div
              className="mt-2 flex flex-wrap gap-1"
              data-testid="project-memory-row-tags"
            >
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border-soft bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">
            {formatRelativeTime(entry.updatedAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Switch
            checked={entry.pinned}
            onCheckedChange={onTogglePinned}
            aria-label={
              entry.pinned
                ? t('common:projectMemory.actions.unpin')
                : t('common:projectMemory.actions.pin')
            }
            data-testid="project-memory-row-pin"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          data-testid="project-memory-row-edit"
        >
          <Pencil className="size-3" />
          <span>{t('common:projectMemory.actions.edit')}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleDisabled}
          data-testid="project-memory-row-toggle-disabled"
        >
          {entry.disabled ? (
            <Eye className="size-3" />
          ) : (
            <EyeOff className="size-3" />
          )}
          <span>
            {entry.disabled
              ? t('common:projectMemory.actions.show')
              : t('common:projectMemory.actions.hide')}
          </span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={t('common:projectMemory.actions.delete')}
          title={t('common:projectMemory.actions.delete')}
          data-testid="project-memory-row-delete"
        >
          <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </li>
  )
}

type MemoryEntryFormProps = {
  draft: DraftEntry
  onChange: (patch: Partial<DraftEntry>) => void
  onSubmit: () => void
  isSubmitting: boolean
}

function MemoryEntryForm({
  draft,
  onChange,
  onSubmit,
  isSubmitting,
}: MemoryEntryFormProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          {t('common:projectMemory.fields.title')}
        </label>
        <Input
          value={draft.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder={t('common:projectMemory.placeholders.title')}
          maxLength={120}
          data-testid="project-memory-form-title"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          {t('common:projectMemory.fields.content')}
        </label>
        <Textarea
          value={draft.content}
          onChange={(event) => onChange({ content: event.target.value })}
          placeholder={t('common:projectMemory.placeholders.content')}
          rows={5}
          maxLength={4000}
          data-testid="project-memory-form-content"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          {t('common:projectMemory.fields.tags')}
        </label>
        <Input
          value={tagsToString(draft.tags)}
          onChange={(event) =>
            onChange({ tags: stringToTags(event.target.value) })
          }
          placeholder={t('common:projectMemory.placeholders.tags')}
          data-testid="project-memory-form-tags"
        />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-foreground">
          <Switch
            checked={draft.pinned}
            onCheckedChange={(checked) => onChange({ pinned: checked })}
            data-testid="project-memory-form-pinned"
          />
          <span>{t('common:projectMemory.fields.pinned')}</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <Switch
            checked={draft.disabled}
            onCheckedChange={(checked) => onChange({ disabled: checked })}
            data-testid="project-memory-form-disabled"
          />
          <span>{t('common:projectMemory.fields.disabled')}</span>
        </label>
      </div>
      <DialogFooter className="gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...EMPTY_DRAFT })}
          disabled={isSubmitting}
          data-testid="project-memory-form-cancel"
        >
          <X className="size-3" />
          <span>{t('common:projectMemory.actions.cancel')}</span>
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onSubmit}
          disabled={isSubmitting}
          data-testid="project-memory-form-submit"
        >
          {isSubmitting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Save className="size-3" />
          )}
          <span>
            {draft.id
              ? t('common:projectMemory.actions.save')
              : t('common:projectMemory.actions.add')}
          </span>
        </Button>
      </DialogFooter>
    </div>
  )
}
