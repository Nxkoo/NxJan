import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { localStorageKey } from '@/constants/localStorage'
import { useTheme } from './useTheme'
import {
  getDefaultNotificationPosition,
  isNotificationPosition,
  type NotificationPosition,
} from '@/utils/toastPlacement'

export type FontSize = '14px' | '15px' | '16px' | '18px' | '20px'

export type DarkStyle = 'jan' | 'editorial' | 'pearfy'

export type ThemeId = 'nxjan' | 'editorial' | 'pearfy'

export type AccentColorValue =
  | 'ink'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'pearfy'

/* ── Theme presets ────────────────────────────────────────────────
   A "Theme" is an atomic (accent, darkStyle) pair. Choosing a theme
   from the ThemeSwitcher applies both at once — no granular accent
   picker or darkStyle picker in the UI anymore.

   Order is the order they appear in the ThemeSwitcher dropdown. */
export interface ThemePreset {
  id: ThemeId
  label: string
  description: string
  accentColor: AccentColorValue
  darkStyle: DarkStyle
  /** Mini preview rows for the dropdown item. Index 0 = light, 1 = dark. */
  swatches: { bg: string; surface: string; accent: string; ink: string }[]
}

export const THEMES: readonly ThemePreset[] = [
  {
    id: 'nxjan',
    label: 'NxJan',
    description: 'Default warm-paper desk with deep navy ink.',
    accentColor: 'ink',
    darkStyle: 'jan',
    swatches: [
      { bg: '#FDF3D7', surface: '#F5E7C2', accent: '#17234D', ink: '#17234D' },
      { bg: '#0F1630', surface: '#182552', accent: '#5A7AD0', ink: '#F7F1DC' },
    ],
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Neutral warm-paper dark, adapted from Jan source palette.',
    accentColor: 'ink',
    darkStyle: 'editorial',
    swatches: [
      { bg: '#FDF3D7', surface: '#F5E7C2', accent: '#17234D', ink: '#17234D' },
      { bg: '#181715', surface: '#262626', accent: '#827D72', ink: '#F5ECD6' },
    ],
  },
  {
    id: 'pearfy',
    label: 'Pearfy Orchard',
    description: 'Olive pear + cream paper, serif editorial.',
    accentColor: 'pearfy',
    darkStyle: 'pearfy',
    swatches: [
      { bg: '#F8F4EA', surface: '#FFFDF7', accent: '#6F8F3D', ink: '#243126' },
      { bg: '#101110', surface: '#1A1C16', accent: '#859160', ink: '#F2EFE8' },
    ],
  },
] as const

const DEFAULT_THEME_ID: ThemeId = 'nxjan'

export function getActiveTheme(themeId: ThemeId): ThemePreset {
  return THEMES.find((t) => t.id === themeId) ?? THEMES[0]
}

const isThemeId = (value: unknown): value is ThemeId =>
  value === 'nxjan' || value === 'editorial' || value === 'pearfy'

/* ── Accent color registry (internal) ──────────────────────────────
   Maps accent value → CSS hex for JS injection of --primary / --sidebar.
   Pearfy is special-cased: its CSS owns the sidebar, so JS skips it. */
export const ACCENT_COLORS = [
  {
    name: 'Ink',
    value: 'ink',
    thumb: '#17234d',
    primary: '#17234d',
    primaryDark: '#4a5a8a',
    sidebar: {
      light: '#f5e7c2',
      dark: '#070b1c',
      darkEditorial: '#131313',
    },
  },
  {
    name: 'Pearfy',
    value: 'pearfy',
    thumb: '#6F8F3D',
    primary: '#6F8F3D',
    primaryDark: '#6F8F3D',
    sidebar: {
      light: '#FCF8EF',
      dark: '#11130D',
      darkEditorial: '#FCF8EF',
    },
  },
  {
    name: 'Blue',
    value: 'blue',
    thumb: '#214099',
    primary: '#214099',
    primaryDark: '#5a7ad0',
    sidebar: {
      light: '#e0e8f5',
      dark: '#070d24',
      darkEditorial: '#131313',
    },
  },
  {
    name: 'Green',
    value: 'green',
    thumb: '#6fa642',
    primary: '#6fa642',
    sidebar: {
      light: '#dff3c4',
      dark: '#0d1f08',
      darkEditorial: '#131313',
    },
  },
  {
    name: 'Yellow',
    value: 'yellow',
    thumb: '#fbd026',
    primary: '#fbd026',
    sidebar: {
      light: '#f3dfc4',
      dark: '#231808',
      darkEditorial: '#131313',
    },
  },
  {
    name: 'Orange',
    value: 'orange',
    thumb: '#f97d38',
    primary: '#f97d38',
    sidebar: {
      light: '#f3cbc4',
      dark: '#1f1208',
      darkEditorial: '#131313',
    },
  },
  {
    name: 'Red',
    value: 'red',
    thumb: '#fb5c34',
    primary: '#fb5c34',
    sidebar: {
      light: '#f3c4c4',
      dark: '#1f0810',
      darkEditorial: '#131313',
    },
  },
] as const

const applyAccentColorToDOM = (
  colorValue: string,
  isDark: boolean,
  darkStyle: DarkStyle
) => {
  const color = ACCENT_COLORS.find((c) => c.value === colorValue)
  if (!color) return

  const root = document.documentElement
  /* Pearfy owns its own --sidebar via CSS (data-dark-style="pearfy").
     Skip JS injection so the CSS can paint the cream paper / dark
     orchard bg-soft without conflict. */
  const skipSidebarInjection = darkStyle === 'pearfy'
  const sidebarColor = isDark
    ? darkStyle === 'editorial'
      ? color.sidebar.darkEditorial
      : color.sidebar.dark
    : color.sidebar.light
  let primaryColor: string = color.primary
  if (
    isDark &&
    (darkStyle === 'jan' || darkStyle === 'pearfy') &&
    'primaryDark' in color
  ) {
    primaryColor = (color as { primaryDark: string }).primaryDark
  }

  if (skipSidebarInjection) {
    root.style.removeProperty('--sidebar')
  } else {
    root.style.setProperty('--sidebar', sidebarColor)
  }
  root.style.setProperty('--primary', primaryColor)
}

const applyThemeToDOM = (themeId: ThemeId) => {
  const theme = getActiveTheme(themeId)
  document.documentElement.setAttribute('data-dark-style', theme.darkStyle)
  const { isDark } = useTheme.getState()
  applyAccentColorToDOM(theme.accentColor, isDark, theme.darkStyle)
}

interface InterfaceSettingsState {
  themeId: ThemeId
  fontSize: FontSize
  notificationPosition: NotificationPosition
  showTokenSpeed: boolean
  coloredUserBubble: boolean
  renderHtmlArtifacts: boolean
  setFontSize: (size: FontSize) => void
  applyTheme: (id: ThemeId) => void
  setNotificationPosition: (position: NotificationPosition) => void
  setShowTokenSpeed: (show: boolean) => void
  setColoredUserBubble: (colored: boolean) => void
  setRenderHtmlArtifacts: (render: boolean) => void
  resetInterface: () => void
}

type InterfaceSettingsPersistedSlice = Omit<
  InterfaceSettingsState,
  | 'resetInterface'
  | 'setFontSize'
  | 'applyTheme'
  | 'setNotificationPosition'
  | 'setShowTokenSpeed'
  | 'setColoredUserBubble'
  | 'setRenderHtmlArtifacts'
>

export const fontSizeOptions = [
  { label: 'Small', value: '14px' as FontSize },
  { label: 'Medium', value: '16px' as FontSize },
  { label: 'Large', value: '18px' as FontSize },
  { label: 'Extra Large', value: '20px' as FontSize },
]

const defaultFontSize: FontSize = '16px'

const createDefaultInterfaceValues = (): InterfaceSettingsPersistedSlice => {
  return {
    themeId: DEFAULT_THEME_ID,
    fontSize: defaultFontSize,
    notificationPosition: getDefaultNotificationPosition(),
    showTokenSpeed: true,
    coloredUserBubble: true,
    renderHtmlArtifacts: false,
  }
}

const interfaceStorage = createJSONStorage<InterfaceSettingsPersistedSlice>(() =>
  localStorage
)

/* Backwards-compat: pre-refactor storage had `accentColor` + `darkStyle`
   slices. Map them to a themeId on rehydrate. */
const migrateLegacyToThemeId = (
  raw: Record<string, unknown>
): ThemeId => {
  if (isThemeId(raw.themeId)) return raw.themeId
  const legacyAccent = raw.accentColor as string | undefined
  const legacyDarkStyle = raw.darkStyle as DarkStyle | undefined
  if (!legacyAccent && !legacyDarkStyle) return DEFAULT_THEME_ID
  const matched = THEMES.find(
    (t) => t.accentColor === legacyAccent && t.darkStyle === legacyDarkStyle
  )
  return matched?.id ?? DEFAULT_THEME_ID
}

export const useInterfaceSettings = create<InterfaceSettingsState>()(
  persist<
    InterfaceSettingsState,
    [],
    [],
    InterfaceSettingsPersistedSlice
  >(
    (set) => {
      const defaultState = createDefaultInterfaceValues()
      return {
        ...defaultState,
        resetInterface: () => {
          // Reset font size
          document.documentElement.style.setProperty(
            '--font-size-base',
            defaultFontSize
          )
          // Reset theme (clears data-dark-style and re-applies accent)
          applyThemeToDOM(DEFAULT_THEME_ID)
          set({
            ...defaultState,
          })
        },

        applyTheme: (id: ThemeId) => {
          if (!isThemeId(id)) return
          applyThemeToDOM(id)
          set({ themeId: id })
        },

        setDarkStyle: (style: DarkStyle) => {
          if (!isDarkStyle(style)) return
          applyDarkStyleToDOM(style)
          set({ darkStyle: style })
        },

        setFontSize: (size: FontSize) => {
          document.documentElement.style.setProperty('--font-size-base', size)
          set({ fontSize: size })
        },

        setNotificationPosition: (position) => {
          if (!isNotificationPosition(position)) return
          set({ notificationPosition: position })
        },

        setShowTokenSpeed: (show) => {
          set({ showTokenSpeed: show })
        },

        setColoredUserBubble: (colored) => {
          set({ coloredUserBubble: colored })
        },

        setRenderHtmlArtifacts: (render) => {
          set({ renderHtmlArtifacts: render })
        },
      }
    },
    {
      name: localStorageKey.settingInterface,
      storage: interfaceStorage,
      partialize: (state) => ({
        themeId: state.themeId,
        fontSize: state.fontSize,
        notificationPosition: state.notificationPosition,
        showTokenSpeed: state.showTokenSpeed,
        coloredUserBubble: state.coloredUserBubble,
        renderHtmlArtifacts: state.renderHtmlArtifacts,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          if ((state.fontSize as FontSize) === '15px') {
            state.fontSize = '16px'
          }
          document.documentElement.style.setProperty(
            '--font-size-base',
            state.fontSize
          )

          /* Backwards-compat: read themeId; if missing, fall back to
             legacy (accent, darkStyle) pair, then default. */
          const rawState = state as unknown as Record<string, unknown>
          const resolvedThemeId = isThemeId(rawState.themeId)
            ? rawState.themeId
            : migrateLegacyToThemeId(rawState)
          state.themeId = resolvedThemeId
          applyThemeToDOM(resolvedThemeId)

          if (
            !state.notificationPosition ||
            !isNotificationPosition(state.notificationPosition)
          ) {
            state.notificationPosition = getDefaultNotificationPosition()
          }
          if (typeof state.showTokenSpeed !== 'boolean') {
            state.showTokenSpeed = true
          }
          if (typeof state.coloredUserBubble !== 'boolean') {
            state.coloredUserBubble = true
          }
          if (typeof state.renderHtmlArtifacts !== 'boolean') {
            state.renderHtmlArtifacts = false
          }
        }
        return state
      },
    }
  )
)

/* Re-apply accent/darkStyle on light↔dark mode change so the sidebar
   variant and primaryDark branches stay in sync. */
let prevIsDark = useTheme.getState().isDark
const unsubscribeTheme = useTheme.subscribe((state) => {
  if (state.isDark !== prevIsDark) {
    prevIsDark = state.isDark
    const { themeId } = useInterfaceSettings.getState()
    applyThemeToDOM(themeId)
  }
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => unsubscribeTheme())
}
