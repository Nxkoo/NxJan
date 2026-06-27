import { useEffect } from 'react'
import { useInterfaceSettings } from '@/hooks/useInterfaceSettings'
import { useTheme } from '@/hooks/useTheme'
import { ACCENT_COLORS } from '@/hooks/useInterfaceSettings'

/**
 * InterfaceProvider ensures interface settings are applied on every page load
 * This component should be mounted at the root level of the application
 */
export function InterfaceProvider() {
  const { fontSize, accentColor, darkStyle } = useInterfaceSettings()
  const { isDark } = useTheme()

  // Apply interface settings on mount and when they change
  useEffect(() => {
    // Apply font size
    document.documentElement.style.setProperty('--font-size-base', fontSize)
  }, [fontSize])

  // Apply dark style attribute (Jan Blue vs Editorial paper) on mount and change
  useEffect(() => {
    document.documentElement.setAttribute('data-dark-style', darkStyle)
  }, [darkStyle])

  // Apply accent color when it changes, theme changes, or dark style changes
  useEffect(() => {
    const color = ACCENT_COLORS.find((c) => c.value === accentColor)
    if (!color) return

    const root = document.documentElement
    /* Jan Blue keeps each accent's deep tint rail; Editorial flattens
       the rail to a neutral dark paper so the page reads as one tone. */
    const sidebarColor = isDark
      ? darkStyle === 'editorial'
        ? color.sidebar.darkEditorial
        : color.sidebar.dark
      : color.sidebar.light
    /* Jan Blue dark uses the brighter primaryDark so dark accents
       (Ink, Blue) don't disappear on the navy night-desk. Editorial
       has its own gray via CSS !important so we only apply primaryDark
       in Jan Blue. */
    let primaryColor: string = color.primary
    if (isDark && darkStyle === 'jan' && 'primaryDark' in color) {
      primaryColor = (color as { primaryDark: string }).primaryDark
    }

    root.style.setProperty('--sidebar', sidebarColor)
    root.style.setProperty('--primary', primaryColor)
  }, [accentColor, isDark, darkStyle])

  return null
}
