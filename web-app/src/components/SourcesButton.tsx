import { memo } from 'react'
import { BookmarkIcon } from 'lucide-react'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { cn } from '@/lib/utils'

type SourcesButtonProps = {
  total: number
  onClick: () => void
}

export const SourcesButton = memo(({ total, onClick }: SourcesButtonProps) => {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={onClick}
      title={t('chat:sources.button')}
      data-slot="sources-button"
      className={cn(
        'group/sources relative inline-flex items-center gap-1.5',
        'h-7 px-2.5 rounded-xl text-xs font-extrabold',
        'border-2 border-[var(--ink)]',
        'bg-[var(--yellow)] text-zinc-900',
        'shadow-[2px_2px_0_0_var(--ink)]',
        'transition-all duration-150 ease-out',
        'hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--ink)]',
        'hover:brightness-95',
        'active:translate-y-0 active:shadow-[1px_1px_0_0_var(--ink)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'cursor-pointer select-none'
      )}
    >
      <BookmarkIcon
        size={13}
        strokeWidth={2.75}
        className="transition-transform duration-200 group-hover/sources:rotate-[-8deg]"
        aria-hidden
      />
      <span className="leading-none tracking-tight">
        {t('chat:sources.buttonWithCount', { count: total })}
      </span>
    </button>
  )
})
SourcesButton.displayName = 'SourcesButton'
