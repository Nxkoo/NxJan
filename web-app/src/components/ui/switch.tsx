import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'
import { IconLoader2 } from '@tabler/icons-react'

type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  loading?: boolean
}
function Switch({ loading, className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'relative peer cursor-pointer inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 shadow-xs outline-hidden transition-all',
        /* OFF: strong visible border + paper fill so it pops on #faeac5/#fdf3d7 */
        'data-[state=unchecked]:bg-[var(--paper-card)] data-[state=unchecked]:border-[var(--ink)]/70',
        /* ON: branded primary */
        'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
        'hover:data-[state=unchecked]:bg-[var(--paper-soft)] hover:data-[state=unchecked]:border-[var(--ink)]',
        'focus-visible:ring-2 focus-visible:ring-ring/90 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        loading && 'w-4.5 pointer-events-none',
        className
      )}
      {...props}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 size-3.5 top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2">
          <IconLoader2 className="animate-spin text-muted-foreground" />
        </div>
      )}
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          /* thumb always contrasts: paper card with subtle border on light paper */
          'bg-[var(--paper-card)] pointer-events-none block size-3.5 rounded-full shadow-sm transition-transform border border-[var(--ink)]/40',
          'data-[state=checked]:translate-x-[15px] data-[state=unchecked]:translate-x-[2px]',
          /* on thumb brighter for pop */
          'data-[state=checked]:bg-white data-[state=checked]:border-white/70'
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
