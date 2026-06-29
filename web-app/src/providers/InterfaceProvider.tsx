import { useEffect } from 'react'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useInterfaceSettings, getActiveTheme } from '@/hooks/useInterfaceSettings'
import { useTheme } from '@/hooks/useTheme'
import { APP_NAME } from '@/constants/branding'

/**
 * InterfaceProvider ensures interface settings are applied on every page load
 * This component should be mounted at the root level of the application
 */
export function InterfaceProvider() {
  const { themeId } = useInterfaceSettings()
  const { isDark } = useTheme()

  useEffect(() => {
    document.title = APP_NAME
    if (IS_TAURI) {
      void getCurrentWebviewWindow().setTitle(APP_NAME)
    }
  }, [])

  /* Apply the active theme to the DOM. Both data-dark-style and
     --primary/--sidebar are owned by applyThemeToDOM (in the hook);
     this effect just re-runs when themeId or isDark change so the
     CSS stays in sync with the resolved accent variant. */
  useEffect(() => {
    const theme = getActiveTheme(themeId)
    document.documentElement.setAttribute('data-dark-style', theme.darkStyle)
  }, [themeId, isDark])

  return null
}
