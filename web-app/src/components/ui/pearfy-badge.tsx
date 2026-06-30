import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/* Pearfy Orchard badge — small editorial chip used for tags, categories,
   and Pomar map status. Mirrors Pearfy src/components/ui/badge.tsx
   variants (leaf / paper / pollen / lavender / gold / secondary).
   Only renders correctly when data-dark-style="pearfy" is active —
   elsewhere it falls back gracefully to the surrounding tokens. */
const pearfyBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-bold leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        leaf: 'bg-[var(--orchard-primary-light)] text-[var(--orchard-primary-active)]',
        paper:
          'bg-[var(--orchard-surface-muted)] text-[var(--orchard-seed)] border border-[var(--orchard-border)]',
        pollen: 'bg-[var(--orchard-pollen)] text-[#3D2C07]',
        lavender:
          'bg-[color-mix(in_srgb,var(--orchard-focus)_26%,white_74%)] text-[#4F467A]',
        gold: 'bg-[hsl(42_77%_60%)] text-[hsl(42_80%_13%)]',
        secondary:
          'bg-secondary text-secondary-foreground border border-border-soft',
      },
      size: {
        sm: 'text-[0.6875rem] px-2 py-1',
        md: 'text-xs px-2.5 py-1.5',
      },
    },
    defaultVariants: {
      variant: 'leaf',
      size: 'md',
    },
  }
)

export interface PearfyBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pearfyBadgeVariants> {}

export function PearfyBadge({
  className,
  variant,
  size,
  ...props
}: PearfyBadgeProps) {
  return (
    <span
      className={cn(pearfyBadgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}
