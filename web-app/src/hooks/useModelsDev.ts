import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { localStorageKey } from '@/constants/localStorage'
import {
  fetchCatalog,
  type ModelsDevCatalog,
} from '@/lib/modelsDev'

const TTL_MS = 24 * 60 * 60 * 1000 // 24h

interface PersistedShape {
  catalog: ModelsDevCatalog | null
  fetchedAt: number | null
}

interface ModelsDevState extends PersistedShape {
  loading: boolean
  error: string | null
  /**
   * Fetches the catalog if no fresh cached version exists in localStorage.
   * Safe to call repeatedly — concurrent calls share a single in-flight
   * promise via the `loading` flag.
   */
  ensureLoaded: () => Promise<void>
  /** Force a network refresh, ignoring TTL. */
  refresh: () => Promise<void>
}

export const useModelsDev = create<ModelsDevState>()(
  persist(
    (set, get) => ({
      catalog: null,
      fetchedAt: null,
      loading: false,
      error: null,
      ensureLoaded: async () => {
        const { catalog, fetchedAt, loading } = get()
        const fresh =
          catalog !== null &&
          typeof fetchedAt === 'number' &&
          Date.now() - fetchedAt < TTL_MS
        if (fresh || loading) return
        return get().refresh()
      },
      refresh: async () => {
        if (get().loading) return
        set({ loading: true, error: null })
        try {
          const catalog = await fetchCatalog()
          set({ catalog, fetchedAt: Date.now(), loading: false, error: null })
        } catch (e) {
          const message =
            e instanceof Error ? e.message : 'Failed to load models.dev catalog'
          set({ loading: false, error: message })
        }
      },
    }),
    {
      name: localStorageKey.modelsDevCatalog,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedShape => ({
        catalog: state.catalog,
        fetchedAt: state.fetchedAt,
      }),
      version: 1,
    }
  )
)
