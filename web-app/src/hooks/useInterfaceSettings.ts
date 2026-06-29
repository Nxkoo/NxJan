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

export type DarkStyle = 'jan' | 'editorial'

export const DARK_STYLE_OPTIONS: { value: DarkStyle; label: string; description: string }[] = [
  {
    value: 'jan',
    label: 'Jan Blue',
    description: 'Deep navy editorial night desk — the original Jan dark.',
  },
  {
    value: 'editorial',
    label: 'Editorial',
    description: 'Neutral warm-paper dark, adapted from the Jan source palette.',
  },
]

export const ACCENT_COLORS = [
  {
    name: 'Ink',
    value: 'ink',
    thumb: '#17234d',
    primary: '#17234d',
    /* Default accent — Jan Blue dark uses a brighter "paper ink" so
       user bubbles, send buttons and other primary surfaces stay
       legible on the navy night-desk. Editorial overrides with gray. */
    primaryDark: '#4a5a8a',
    /* Sidebar gets a different shade per dark style so the Jan Blue
       mode keeps the deep-navy rail (#070b1c) and the Editorial
       mode uses the neutral dark paper (#131313). */
    sidebar: {
      light: '#f5e7c2',
      dark: '#070b1c',
      darkEditorial: '#131313',
    },
  },
  {
    name: 'Blue',
    value: 'blue',
    thumb: '#214099',
    primary: '#214099',
    /* Brighter blue for Jan Blue dark mode so the primary is visible
       on the navy night-desk background. Editorial overrides this. */
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

export type AccentColorValue = (typeof ACCENT_COLORS)[number]['value']
const DEFAULT_ACCENT_COLOR: AccentColorValue = 'ink'

const isLegacyDefaultAccent = (value: unknown): boolean =>
  value === 'orange' || value === 'gray'
const DEFAULT_DARK_STYLE: DarkStyle = 'jan'

const isDarkStyle = (value: unknown): value is DarkStyle =>
  value === 'jan' || value === 'editorial'

const applyAccentColorToDOM = (
  colorValue: string,
  isDark: boolean,
  darkStyle: DarkStyle = 'jan'
) => {
  const color = ACCENT_COLORS.find((c) => c.value === colorValue)
  if (!color) return

  const root = document.documentElement
  /* Jan Blue keeps each accent's deep tint rail; Editorial flattens
     the rail to a neutral dark paper so the page reads as one tone. */
  const sidebarColor = isDark
    ? darkStyle === 'editorial'
      ? color.sidebar.darkEditorial
      : color.sidebar.dark
    : color.sidebar.light
  /* Accents like Ink/Blue are dark by design — they vanish on the
     navy night-desk. In Jan Blue dark, use the brighter primaryDark
     variant so the user bubble, send button and other primary surfaces
     stay legible. Editorial has its own gray via CSS !important so
     we just pass the dark variant through here. */
  let primaryColor: string = color.primary
  if (isDark && darkStyle === 'jan' && 'primaryDark' in color) {
    primaryColor = (color as { primaryDark: string }).primaryDark
  }

  root.style.setProperty('--sidebar', sidebarColor)
  root.style.setProperty('--primary', primaryColor)
}

const applyDarkStyleToDOM = (style: DarkStyle) => {
  document.documentElement.setAttribute('data-dark-style', style)
}

interface InterfaceSettingsState {
  fontSize: FontSize
  accentColor: AccentColorValue
  darkStyle: DarkStyle
  notificationPosition: NotificationPosition
  showTokenSpeed: boolean
  coloredUserBubble: boolean
  renderHtmlArtifacts: boolean
  setFontSize: (size: FontSize) => void
  setAccentColor: (color: AccentColorValue) => void
  setDarkStyle: (style: DarkStyle) => void
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
  | 'setAccentColor'
  | 'setDarkStyle'
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

// Default interface settings
const defaultFontSize: FontSize = '16px'

const createDefaultInterfaceValues = (): InterfaceSettingsPersistedSlice => {
  return {
    fontSize: defaultFontSize,
    accentColor: DEFAULT_ACCENT_COLOR,
    darkStyle: DEFAULT_DARK_STYLE,
    notificationPosition: getDefaultNotificationPosition(),
    showTokenSpeed: true,
    coloredUserBubble: true,
    renderHtmlArtifacts: false,
  }
}

const interfaceStorage = createJSONStorage<InterfaceSettingsPersistedSlice>(() =>
  localStorage
)

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
          const { isDark } = useTheme.getState()

          // Reset font size
          document.documentElement.style.setProperty(
            '--font-size-base',
            defaultFontSize
          )

          // Reset dark style attribute first so accent picks the right
          // sidebar variant (Jan Blue vs Editorial).
          applyDarkStyleToDOM(DEFAULT_DARK_STYLE)

          // Reset accent color preset
          applyAccentColorToDOM(
            DEFAULT_ACCENT_COLOR,
            isDark,
            DEFAULT_DARK_STYLE
          )

          // Update state
          set({
            fontSize: defaultFontSize,
            accentColor: DEFAULT_ACCENT_COLOR,
            darkStyle: DEFAULT_DARK_STYLE,
            notificationPosition: getDefaultNotificationPosition(),
            showTokenSpeed: true,
            coloredUserBubble: true,
            renderHtmlArtifacts: false,
          })
        },

        setAccentColor: (color: AccentColorValue) => {
          const colorExists = ACCENT_COLORS.find((c) => c.value === color)
          if (!colorExists) return

          const { isDark } = useTheme.getState()
          const { darkStyle } = useInterfaceSettings.getState()
          applyAccentColorToDOM(color, isDark, darkStyle)
          set({ accentColor: color })
        },

        setDarkStyle: (style: DarkStyle) => {
          if (!isDarkStyle(style)) return
          applyDarkStyleToDOM(style)
          set({ darkStyle: style })
        },

        setFontSize: (size: FontSize) => {
          // Update CSS variable
          document.documentElement.style.setProperty('--font-size-base', size)
          // Update state
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
        fontSize: state.fontSize,
        accentColor: state.accentColor,
        darkStyle: state.darkStyle,
        notificationPosition: state.notificationPosition,
        showTokenSpeed: state.showTokenSpeed,
        coloredUserBubble: state.coloredUserBubble,
        renderHtmlArtifacts: state.renderHtmlArtifacts,
      }),
      // Apply settings when hydrating from storage
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Migrate old font size value '15px' to '16px'
          if ((state.fontSize as FontSize) === '15px') {
            state.fontSize = '16px'
          }

          // Apply font size from storage
          document.documentElement.style.setProperty(
            '--font-size-base',
            state.fontSize
          )

          // Get the current theme state
          const { isDark } = useTheme.getState()

          // Apply dark style — migrate old persisted state that doesn't
          // have the field yet, defaulting to Jan Blue.
          const darkStyleValue = isDarkStyle(state.darkStyle)
            ? state.darkStyle
            : DEFAULT_DARK_STYLE
          state.darkStyle = darkStyleValue
          applyDarkStyleToDOM(darkStyleValue)

          // Migrate legacy Jan defaults (orange / invalid gray) to NxJan ink.
          const storedAccent = state.accentColor as string
          const accentIsKnown = ACCENT_COLORS.some((c) => c.value === storedAccent)
          if (!accentIsKnown || isLegacyDefaultAccent(storedAccent)) {
            state.accentColor = DEFAULT_ACCENT_COLOR
          }

          // Apply accent color preset (uses the resolved dark style)
          const accentColorValue = state.accentColor || DEFAULT_ACCENT_COLOR
          applyAccentColorToDOM(accentColorValue, isDark, darkStyleValue)

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

        // Return the state to be used for hydration
        return state
      },
    }
  )
)

// Subscribe to theme changes to update accent color sidebar variant
let prevIsDark = useTheme.getState().isDark
const unsubscribeTheme = useTheme.subscribe((state) => {
  if (state.isDark !== prevIsDark) {
    prevIsDark = state.isDark
    const { accentColor, darkStyle } = useInterfaceSettings.getState()
    applyAccentColorToDOM(accentColor, state.isDark, darkStyle)
  }
})

// Detach the module-level subscription on HMR so reloads don't stack listeners.
if (import.meta.hot) {
  import.meta.hot.dispose(() => unsubscribeTheme())
}
