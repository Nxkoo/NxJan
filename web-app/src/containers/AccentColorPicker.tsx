import { cn } from '@/lib/utils'
import {
  useInterfaceSettings,
  ACCENT_COLORS,
} from '@/hooks/useInterfaceSettings'

export function AccentColorPicker() {
  const { accentColor, setAccentColor } = useInterfaceSettings()

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {ACCENT_COLORS.map((color) => {
        const isSelected = color.value === accentColor
        return (
          <button
            key={color.value}
            title={color.name}
            onClick={() => setAccentColor(color.value)}
            className={cn(
              'size-6 rounded-lg border-2 border-border/40 transition-all duration-200 cursor-pointer hover:scale-110',
              isSelected &&
                'ring-2 ring-offset-2 ring-primary border-none'
            )}
            style={{
              backgroundColor: color.thumb === "#17234d" ? 'var(--background)' : color.thumb,
            }}
          />
        )
      })}
    </div>
  )
}
