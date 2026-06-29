import { useEffect, useState } from 'react'
import { initializeServiceHub } from '@/services'
import { initializeServiceHubStore } from '@/hooks/useServiceHub'
import { useModelsDev } from '@/hooks/useModelsDev'

interface ServiceHubProviderProps {
  children: React.ReactNode
}

export function ServiceHubProvider({ children }: ServiceHubProviderProps) {
  const [isReady, setIsReady] = useState(false)
  const ensureCatalog = useModelsDev((s) => s.ensureLoaded)

  useEffect(() => {
    initializeServiceHub()
      .then((hub) => {
        console.log('Services initialized, initializing Zustand store')
        initializeServiceHubStore(hub)
        setIsReady(true)
      })
      .catch((error) => {
        console.error('Service initialization failed:', error)
        setIsReady(true) // Still render to show error state
      })
  }, [])

  // Background refresh of the models.dev catalog so the token counter
  // can resolve max-context and per-token pricing for remote providers
  // without blocking first paint. Idempotent — short-circuits when a
  // fresh cached catalog is already present.
  useEffect(() => {
    void ensureCatalog()
  }, [ensureCatalog])

  return <>{isReady && children}</>
}
