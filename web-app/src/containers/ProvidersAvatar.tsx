import { useTheme } from '@/hooks/useTheme'
import { getProviderLogo, getProviderTitle } from '@/lib/utils'

const ProvidersAvatar = ({ provider }: { provider: ProviderObject }) => {
  const { isDark } = useTheme()

  const logoPath = getProviderLogo(provider.provider)
  let finalLogo = logoPath

  if (provider.provider === 'opencode-go' && logoPath) {
    finalLogo = isDark
      ? '/images/model-provider/opencode-go-dark.svg'
      : '/images/model-provider/opencode-go-light.svg'
  }

  return (
    <>
      {logoPath === undefined ? (
        <div className="flex size-4.5 rounded-full border items-center justify-center">
          <p className="text-xs leading-0 capitalize">
            {getProviderTitle(provider.provider).charAt(0)}
          </p>
        </div>
      ) : (
        <img
          src={finalLogo}
          alt={`${provider.provider} - Logo`}
          className="size-4.5 object-contain rounded-full"
          style={{
            imageRendering: '-webkit-optimize-contrast',
          }}
          loading="eager"
          decoding="sync"
          draggable={false}
        />
      )}
    </>
  )
}

export default ProvidersAvatar
