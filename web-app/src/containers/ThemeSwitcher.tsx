import { useTranslation } from '@/i18n/react-i18next-compat'
import { useInterfaceSettings, THEMES, getActiveTheme } from '@/hooks/useInterfaceSettings'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ModeOption = 'system' | 'light' | 'dark'

const MODE_LABELS: Record<ModeOption, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

const MODE_TO_THEME: Record<ModeOption, 'auto' | 'light' | 'dark'> = {
  system: 'auto',
  light: 'light',
  dark: 'dark',
}

/* The ThemeSwitcher combines two controls into one Appearance section:
   1. Three preview cards (System / Light / Dark) — clicáveis, mudam o mode.
   2. A theme name dropdown — escolhe NxJan, Editorial, ou Pearfy Orchard.

   Each theme is an atomic (accent, darkStyle) preset. No granular
   accent picker or darkStyle picker anymore. */
export function ThemeSwitcher() {
  const { t } = useTranslation()
  const { themeId, applyTheme } = useInterfaceSettings()
  const { activeTheme, setTheme } = useTheme()
  const active = getActiveTheme(themeId)

  const currentMode: ModeOption =
    activeTheme === 'light' ? 'light' : activeTheme === 'dark' ? 'dark' : 'system'

  return (
    <div className="flex flex-col gap-3 w-full sm:max-w-md">
      {/* ── 3 preview cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(MODE_LABELS) as ModeOption[]).map((mode) => {
          const isActive = currentMode === mode
          const swatch = active.swatches[mode === 'dark' ? 1 : 0]
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setTheme(MODE_TO_THEME[mode])}
              aria-pressed={isActive}
              className={cn(
                'group flex flex-col items-center gap-1.5 rounded-xl border bg-card p-2 text-left transition-all duration-200',
                isActive
                  ? 'border-primary ring-2 ring-primary/30 shadow-[0_4px_16px_rgba(111,143,61,0.18)]'
                  : 'border-border-soft hover:border-primary/40 hover:scale-[1.02]'
              )}
            >
              {/* Mini preview: top half bg+ink text bar, bottom half bg+accent circle */}
              <div
                className="relative h-12 w-full overflow-hidden rounded-md border border-border-soft"
                style={{ backgroundColor: swatch.bg }}
              >
                <div
                  className="absolute left-1.5 right-1.5 top-1.5 h-1.5 rounded-full opacity-60"
                  style={{ backgroundColor: swatch.ink }}
                />
                <div
                  className="absolute left-1.5 top-4 h-1 w-6 rounded-full opacity-40"
                  style={{ backgroundColor: swatch.ink }}
                />
                <div
                  className="absolute left-1.5 top-6 h-1 w-9 rounded-full opacity-30"
                  style={{ backgroundColor: swatch.ink }}
                />
                <div
                  className="absolute right-1.5 bottom-1.5 size-3 rounded-full"
                  style={{ backgroundColor: swatch.accent }}
                />
              </div>
              <span
                className={cn(
                  'text-[0.6875rem] font-bold uppercase tracking-[0.12em]',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {MODE_LABELS[mode]}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Theme name dropdown ─────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            title={t('common:editTheme')}
          >
            <span className="font-semibold">{active.label}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          {THEMES.map((theme) => {
            const isSelected = theme.id === themeId
            return (
              <DropdownMenuItem
                key={theme.id}
                onClick={() => applyTheme(theme.id)}
                className={cn(
                  'flex items-start gap-3 p-3 my-0.5 rounded-lg cursor-pointer',
                  isSelected && 'bg-accent/60'
                )}
              >
                {/* Mini swatches — 2 rows of bg+accent (light + dark) */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  {theme.swatches.slice(0, 2).map((s, i) => (
                    <div
                      key={i}
                      className="flex h-3 w-12 overflow-hidden rounded-sm border border-border-soft"
                    >
                      <div
                        className="h-full flex-1"
                        style={{ backgroundColor: s.bg }}
                      />
                      <div
                        className="h-full w-3"
                        style={{ backgroundColor: s.accent }}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    {theme.label}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                    {theme.description}
                  </div>
                </div>

                {isSelected && (
                  <Check className="size-4 text-primary shrink-0 mt-0.5" />
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
