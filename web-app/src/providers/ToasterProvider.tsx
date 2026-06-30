import { Toaster } from '@/components/ui/sonner'
import { useInterfaceSettings } from '@/hooks/useInterfaceSettings'
import { getToastOffset } from '@/utils/toastPlacement'

export function ToasterProvider() {
  const notificationPosition = useInterfaceSettings(
    (s) => s.notificationPosition
  )

  return (
    <Toaster
      richColors
      position={notificationPosition}
      offset={getToastOffset(notificationPosition)}
      visibleToasts={5}
      toastOptions={{
        style: {
          alignItems: 'start',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        },
        classNames: {
          toast: 'select-none',
          title: 'select-none',
          description: 'select-none',
        },
      }}
    />
  )
}
