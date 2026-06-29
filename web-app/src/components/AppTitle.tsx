import { cn } from '@/lib/utils'
import { APP_PREFIX, APP_SUFFIX } from '@/constants/branding'

type AppTitleProps = {
  className?: string
}

export function AppTitle({ className }: AppTitleProps) {
  return (
    <span className={cn('font-semibold font-display text-xl', className)}>
      <span className="text-foreground/75">{APP_PREFIX}</span>
      <span className="text-foreground">{APP_SUFFIX}</span>
    </span>
  )
}