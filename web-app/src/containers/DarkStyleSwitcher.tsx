import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DARK_STYLE_OPTIONS,
  useInterfaceSettings,
  type DarkStyle,
} from '@/hooks/useInterfaceSettings'

export function DarkStyleSwitcher() {
  const { darkStyle, setDarkStyle } = useInterfaceSettings()
  const current = DARK_STYLE_OPTIONS.find((o) => o.value === darkStyle)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between"
          title="Choose a dark mode style"
        >
          {current?.label ?? 'Jan Blue'}
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {DARK_STYLE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className={cn(
              'cursor-pointer my-0.5 rounded-lg flex-col items-start gap-0.5',
              darkStyle === option.value && 'bg-accent/60'
            )}
            onClick={() => setDarkStyle(option.value as DarkStyle)}
          >
            <span className="text-sm font-medium">{option.label}</span>
            <span className="text-xs text-muted-foreground font-normal">
              {option.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
