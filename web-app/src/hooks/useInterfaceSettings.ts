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

export const ACCENT_COLORS = [
  {
    name: 'Ink',
    value: 'ink',
    thumb: '#17234d',
    primary: '#17234d',
    sidebar: { light: '#faeac5', dark: '#0f1630' },
  },
  {
    name: 'Blue',
    value: 'blue',
    thumb: '#214099',
    primary: '#214099',
    sidebar: { light: '#e8f0f8', dark: '#0f2157' },
  },
  {
    name: 'Green',
    value: 'green',
    thumb: '#6fa642',
    primary: '#6fa642',
    sidebar: { light: '#dff3c4', dark: '#374b1b' },
  },
  {
    name: 'Yellow',
    value: 'yellow',
    thumb: '#fbd026',
    primary: '#fbd026',
    sidebar: { light: '#f3dfc4', dark: '#5c3a0a' },
  },
  {
    name: 'Orange',
    value: 'orange',
    thumb: '#f97d38',
    primary: '#f97d38',
    sidebar: { light: '#f3cbc4', dark: '#5e1308' },
  },
  {
    name: 'Red',
    value: 'red',
    thumb: '#fb5c34',
    primary: '#fb5c34',
    sidebar: { light: '#f3c4c4', dark: '#61053e' },
  },
] as const

export type AccentColorValue = (typeof ACCENT_COLORS)[number]['value']
const DEFAULT_ACCENT_COLOR: AccentColorValue = 'ink'

const applyAccentColorToDOM = (colorValue: string, isDark: boolean) => {
  const color = ACCENT_COLORS.find((c) => c.value === colorValue)
  if (!color) return

  const root = document.documentElement
  const sidebarColor = isDark ? color.sidebar.dark : color.sidebar.light

  root.style.setProperty('--sidebar', sidebarColor)
  root.style.setProperty('--primary', color.primary)
}

interface InterfaceSettingsState {
  fontSize: FontSize
  accentColor: AccentColorValue
  notificationPosition: NotificationPosition
  showTokenSpeed: boolean
  coloredUserBubble: boolean
  renderHtmlArtifacts: boolean
  setFontSize: (size: FontSize) => void
  setAccentColor: (color: AccentColorValue) => void
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

          // Reset accent color preset
          applyAccentColorToDOM(DEFAULT_ACCENT_COLOR, isDark)

          // Update state
          set({
            fontSize: defaultFontSize,
            accentColor: DEFAULT_ACCENT_COLOR,
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
          applyAccentColorToDOM(color, isDark)
          set({ accentColor: color })
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

          // Apply accent color preset
          const accentColorValue = state.accentColor || DEFAULT_ACCENT_COLOR
          applyAccentColorToDOM(accentColorValue, isDark)

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
    const { accentColor } = useInterfaceSettings.getState()
    applyAccentColorToDOM(accentColor, state.isDark)
  }
})

// Detach the module-level subscription on HMR so reloads don't stack listeners.
if (import.meta.hot) {
  import.meta.hot.dispose(() => unsubscribeTheme())
}
