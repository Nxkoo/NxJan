/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useSearch } from '@tanstack/react-router'
import ChatInput from '@/containers/ChatInput'
import HeaderPage from '@/containers/HeaderPage'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { useTools } from '@/hooks/useTools'
import { cn } from '@/lib/utils'

import { useModelProvider } from '@/hooks/useModelProvider'
import SetupScreen from '@/containers/SetupScreen'
import { route } from '@/constants/routes'
import { predefinedProviders } from '@/constants/providers'
import { providerHasRemoteApiKeys } from '@/lib/provider-api-keys'

import { useEffect } from 'react'
import { useThreads } from '@/hooks/useThreads'
import DropdownModelProvider from '@/containers/DropdownModelProvider'
import { usePrompt } from '@/hooks/usePrompt'

import { FileText, Lightbulb, Code, Folder } from 'lucide-react'

type ThreadModel = {
  id: string
  provider: string
}

type SearchParams = {
  threadModel?: ThreadModel
}

export const Route = createFileRoute(route.home as any)({
  component: Index,
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const result: SearchParams = {
      threadModel: search.threadModel as ThreadModel | undefined,
    }

    return result
  },
})

const suggestionCards = [
  {
    icon: FileText,
    title: 'Summarize',
    description: 'Summarize texts, files, and conversations quickly.',
    color: 'text-green-700',
    bg: 'bg-green-100',
    border: 'border-green-200',
    prompt: 'Summarize this for me',
  },
  {
    icon: Lightbulb,
    title: 'Ideas',
    description: 'Brainstorm, create plans, and organize thoughts.',
    color: 'text-yellow-700',
    bg: 'bg-yellow-100',
    border: 'border-yellow-200',
    prompt: 'Help me brainstorm ideas',
  },
  {
    icon: Code,
    title: 'Code',
    description: 'Explain, debug, and write code with your assistant.',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    border: 'border-blue-200',
    prompt: 'Help me write some code',
  },
  {
    icon: Folder,
    title: 'Projects',
    description: 'Manage your projects and files with ease.',
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    border: 'border-orange-200',
    prompt: 'Help me organize my project',
  },
]

function Index() {
  const { t } = useTranslation()
  const { providers } = useModelProvider()
  const search = useSearch({ from: route.home as any })
  const threadModel = search.threadModel
  const { setCurrentThreadId } = useThreads()
  const { setPrompt } = usePrompt()
  useTools()

  const hasValidProviders = providers.some((provider) => {
    const isPredefinedProvider = predefinedProviders.some(
      (p) => p.provider === provider.provider
    )

    if (!isPredefinedProvider) {
      return provider.models.length > 0
    }

    return (
      providerHasRemoteApiKeys(provider) ||
      (provider.provider === 'llamacpp' && provider.models.length) ||
      (provider.provider === 'jan' && provider.models.length)
    )
  })

  useEffect(() => {
    setCurrentThreadId(undefined)
  }, [setCurrentThreadId])

  if (!hasValidProviders) {
    return <SetupScreen />
  }

  return (
    <div className="flex h-full flex-col justify-center">
      <HeaderPage>
        <div className="flex items-center gap-2 w-full">
          <DropdownModelProvider model={threadModel} />
        </div>
      </HeaderPage>
      <div
        className={cn(
          'h-full overflow-y-auto inline-flex flex-col gap-2 justify-center px-3'
        )}
      >
        <div
          className={cn(
            'mx-auto w-full md:w-4/5 xl:w-4/6 -mt-16',
          )}
        >
          <div className={cn('text-center mb-8')}>
            <h1
              className={cn(
                'text-4xl md:text-5xl font-display font-semibold text-foreground leading-tight',
              )}
            >
              {t('chat:description')}
            </h1>
            <p className="mt-3 text-muted-foreground text-base md:text-lg max-w-md mx-auto">
              Ask anything, explore ideas, work on your projects.
            </p>
          </div>
          <div className="flex-1 shrink-0">
            <ChatInput
              showSpeedToken={false}
              model={threadModel}
              initialMessage={true}
            />
          </div>

          {/* Suggestion cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            {suggestionCards.map((card) => {
              const Icon = card.icon
              return (
                <button
                  key={card.title}
                  className={cn(
                    'flex flex-col items-start gap-3 p-4 rounded-2xl border-2 bg-card text-left transition-all',
                    'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                    card.border
                  )}
                  onClick={() => {
                    setPrompt(card.prompt)
                  }}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center size-10 rounded-xl border-2',
                      card.bg,
                      card.border
                    )}
                  >
                    <Icon className={cn('size-5', card.color)} />
                  </div>
                  <div>
                    <span className={cn('block font-display font-semibold text-lg', card.color)}>
                      {card.title}
                    </span>
                    <span className="text-sm text-muted-foreground leading-snug">
                      {card.description}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Local-first trust note */}
          <div className="mt-6 flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-[var(--sidebar-border)] bg-card/60 text-sm text-muted-foreground">
              <span>Your data stays on your device. You&apos;re in control.</span>
              <span className="text-green-600">🌿</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
