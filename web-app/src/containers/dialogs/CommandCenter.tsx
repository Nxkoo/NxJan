import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  Bot,
  Code2,
  FolderOpen,
  MessageSquare,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { route } from '@/constants/routes'
import { useAssistant } from '@/hooks/useAssistant'
import { useCodebaseStore, selectPrimaryCodebase } from '@/hooks/useCodebase'
import { useCommandCenter } from '@/hooks/useCommandCenter'
import { useKeyboardListNavigation } from '@/hooks/useKeyboardListNavigation'
import { useModelProvider } from '@/hooks/useModelProvider'
import { usePrompt } from '@/hooks/usePrompt'
import { useServiceHub } from '@/hooks/useServiceHub'
import { useThreadManagement } from '@/hooks/useThreadManagement'
import { useThreads } from '@/hooks/useThreads'
import { getModelDisplayName, getProviderTitle } from '@/lib/utils'
import { predefinedProviders } from '@/constants/providers'
import { providerHasRemoteApiKeys } from '@/lib/provider-api-keys'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

type CommandMode = 'commands' | 'projects' | 'models' | 'assistants'

type CommandItem = {
  id: string
  title: string
  subtitle?: string
  keywords?: string
  icon: ReactNode
  disabled?: boolean
  run: () => void | Promise<void>
}

const EMPTY_CODEBASE_METAS: ReturnType<typeof useCodebaseStore.getState>['metas'][string] = []

function getCurrentProjectId(location: {
  pathname: string
  search?: Record<string, unknown>
}) {
  const searchProjectId = location.search?.projectId
  if (typeof searchProjectId === 'string' && searchProjectId) {
    return searchProjectId
  }
  const match = location.pathname.match(/^\/project\/([^/?#]+)/)
  return match ? decodeURIComponent(match[1]) : undefined
}

function itemMatches(item: CommandItem, query: string) {
  if (!query.trim()) return true
  const haystack = `${item.title} ${item.subtitle ?? ''} ${
    item.keywords ?? ''
  }`.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((token) => haystack.includes(token))
}

export function CommandCenter() {
  const open = useCommandCenter((state) => state.open)
  const setOpen = useCommandCenter((state) => state.setOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {open && <CommandCenterBody />}
    </Dialog>
  )
}

function CommandCenterBody() {
  const setOpen = useCommandCenter((state) => state.setOpen)
  const router = useRouter()
  const location = router.state.location as {
    pathname: string
    search?: Record<string, unknown>
  }
  const currentProjectId = getCurrentProjectId(location)
  const { folders } = useThreadManagement()
  const { assistants, currentAssistant, setCurrentAssistant } = useAssistant()
  const { providers, selectModelProvider } = useModelProvider()
  const updateCurrentThreadModel = useThreads((s) => s.updateCurrentThreadModel)
  const updateCurrentThreadAssistant = useThreads(
    (s) => s.updateCurrentThreadAssistant
  )
  const setPrompt = usePrompt((s) => s.setPrompt)
  const serviceHub = useServiceHub()
  const codebaseMetas = useCodebaseStore((s) =>
    currentProjectId
      ? s.metas[currentProjectId] ?? EMPTY_CODEBASE_METAS
      : EMPTY_CODEBASE_METAS
  )
  const upsertCodebase = useCodebaseStore((s) => s.upsertCodebase)
  const updateCodebase = useCodebaseStore((s) => s.updateCodebase)
  const primaryCodebase = useMemo(
    () => selectPrimaryCodebase(codebaseMetas),
    [codebaseMetas]
  )

  const [mode, setMode] = useState<CommandMode>('commands')
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isReindexing, setIsReindexing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setOpen(false)
  }, [setOpen])

  const navigateHome = useCallback(() => {
    close()
    void router.navigate({ to: route.home })
  }, [close, router])

  const navigateProjectHome = useCallback(() => {
    close()
    if (currentProjectId) {
      void router.navigate({
        to: route.home,
        search: { projectId: currentProjectId },
      })
      return
    }
    void router.navigate({ to: route.home })
  }, [close, currentProjectId, router])

  const reindexCurrentCodebase = useCallback(async () => {
    if (!currentProjectId || !primaryCodebase?.folderPath || isReindexing) {
      return
    }

    close()
    setIsReindexing(true)
    updateCodebase(currentProjectId, primaryCodebase.id, {
      status: 'indexing',
      lastError: null,
    })

    try {
      const result = await serviceHub
        .codebase()
        .indexRepository(primaryCodebase.folderPath)
      upsertCodebase(currentProjectId, {
        ...primaryCodebase,
        folderPath: result.repo_path,
        codebaseMemoryProjectName: result.project,
        indexedAt: new Date().toISOString(),
        nodes: result.nodes ?? null,
        edges: result.edges ?? null,
        excludedDirs: result.excluded_dirs ?? [],
        status: 'indexed',
        lastError: null,
        enabled: primaryCodebase.enabled !== false,
      })
      toast.success('Codebase reindexed', {
        description: result.project,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      updateCodebase(currentProjectId, primaryCodebase.id, {
        status: 'error',
        lastError: message,
      })
      toast.error('Failed to reindex codebase', { description: message })
    } finally {
      setIsReindexing(false)
    }
  }, [
    close,
    currentProjectId,
    isReindexing,
    primaryCodebase,
    serviceHub,
    updateCodebase,
    upsertCodebase,
  ])

  const models = useMemo(() => {
    const items: Array<{ provider: ModelProvider; model: Model }> = []
    for (const provider of providers) {
      if (!provider.active) continue
      for (const model of provider.models) {
        if (model.embedding) continue
        const isPredefined = predefinedProviders.some((entry) =>
          entry.provider.includes(provider.provider)
        )
        if (
          provider.provider !== 'llamacpp' &&
          !providerHasRemoteApiKeys(provider) &&
          (isPredefined || provider.models.length === 0)
        ) {
          continue
        }
        items.push({ provider, model })
      }
    }
    return items
  }, [providers])

  const commands = useMemo<CommandItem[]>(
    () => [
      {
        id: 'open-chat',
        title: 'Open chat',
        subtitle: 'Go to the chat composer',
        keywords: 'new chat conversation thread',
        icon: <MessageSquare className="size-4" />,
        run: navigateHome,
      },
      {
        id: 'open-project',
        title: 'Open project',
        subtitle:
          folders.length > 0
            ? 'Choose a project from your workspace'
            : 'No projects available',
        keywords: 'project folder workspace',
        icon: <FolderOpen className="size-4" />,
        disabled: folders.length === 0,
        run: () => {
          setMode('projects')
          setQuery('')
        },
      },
      {
        id: 'switch-model',
        title: 'Switch model',
        subtitle:
          models.length > 0 ? 'Pick an available model' : 'No models available',
        keywords: 'model provider llm',
        icon: <SlidersHorizontal className="size-4" />,
        disabled: models.length === 0,
        run: () => {
          setMode('models')
          setQuery('')
        },
      },
      {
        id: 'switch-assistant',
        title: 'Switch assistant',
        subtitle: 'Pick the active assistant',
        keywords: 'assistant agent persona',
        icon: <Bot className="size-4" />,
        run: () => {
          setMode('assistants')
          setQuery('')
        },
      },
      {
        id: 'open-settings',
        title: 'Open settings',
        subtitle: 'Go to app settings',
        keywords: 'preferences config',
        icon: <Settings className="size-4" />,
        run: () => {
          close()
          void router.navigate({ to: route.settings.general })
        },
      },
      {
        id: 'reindex-codebase',
        title: isReindexing ? 'Reindexing current codebase' : 'Reindex current codebase',
        subtitle: primaryCodebase
          ? primaryCodebase.displayName || primaryCodebase.folderPath
          : 'Open a project with a linked codebase first',
        keywords: 'codebase index refresh repository',
        icon: <RefreshCw className={cn('size-4', isReindexing && 'animate-spin')} />,
        disabled: !primaryCodebase?.folderPath || isReindexing,
        run: reindexCurrentCodebase,
      },
      {
        id: 'search-codebase-symbol',
        title: 'Search codebase symbol',
        subtitle: primaryCodebase
          ? 'Prefill the chat with a targeted symbol search'
          : 'Open a project with a linked codebase first',
        keywords: 'code symbol class function method',
        icon: <Code2 className="size-4" />,
        disabled: !primaryCodebase,
        run: () => {
          setPrompt('Search the current codebase for symbol: ')
          navigateProjectHome()
        },
      },
    ],
    [
      close,
      folders.length,
      isReindexing,
      models.length,
      navigateHome,
      navigateProjectHome,
      primaryCodebase,
      reindexCurrentCodebase,
      router,
      setPrompt,
    ]
  )

  const items = useMemo<CommandItem[]>(() => {
    if (mode === 'projects') {
      return folders.map((project) => ({
        id: `project:${project.id}`,
        title: project.name,
        subtitle: 'Open project',
        keywords: `project folder ${project.name}`,
        icon: <FolderOpen className="size-4" />,
        run: () => {
          close()
          void router.navigate({
            to: route.projectDetail,
            params: { projectId: project.id },
          })
        },
      }))
    }

    if (mode === 'models') {
      return models.map(({ provider, model }) => ({
        id: `model:${provider.provider}:${model.id}`,
        title: getModelDisplayName(model),
        subtitle: getProviderTitle(provider.provider),
        keywords: `${model.id} ${model.displayName ?? ''} ${provider.provider}`,
        icon: <SlidersHorizontal className="size-4" />,
        run: () => {
          selectModelProvider(provider.provider, model.id)
          updateCurrentThreadModel({
            id: model.id,
            provider: provider.provider,
          })
          close()
        },
      }))
    }

    if (mode === 'assistants') {
      return [
        {
          id: 'assistant:none',
          title: 'No assistant',
          subtitle: 'Use the selected model directly',
          keywords: 'none model only',
          icon: <Bot className="size-4" />,
          run: () => {
            setCurrentAssistant(undefined)
            updateCurrentThreadAssistant(undefined as unknown as Assistant)
            close()
          },
        },
        ...assistants.map((assistant) => ({
          id: `assistant:${assistant.id}`,
          title: assistant.name || 'Unnamed Assistant',
          subtitle:
            assistant.id === currentAssistant?.id
              ? 'Current assistant'
              : 'Switch assistant',
          keywords: `${assistant.id} ${assistant.name ?? ''}`,
          icon: <Bot className="size-4" />,
          run: () => {
            setCurrentAssistant(assistant)
            updateCurrentThreadAssistant(assistant)
            close()
          },
        })),
      ]
    }

    return commands
  }, [
    assistants,
    close,
    commands,
    currentAssistant?.id,
    folders,
    mode,
    models,
    router,
    selectModelProvider,
    setCurrentAssistant,
    updateCurrentThreadAssistant,
    updateCurrentThreadModel,
  ])

  const filteredItems = useMemo(
    () => items.filter((item) => itemMatches(item, query)).slice(0, 60),
    [items, query]
  )

  useEffect(() => {
    setHighlightedIndex(filteredItems.length > 0 ? 0 : -1)
  }, [filteredItems.length, mode, query])

  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [])

  const selectItem = useCallback(
    (index: number) => {
      const item = filteredItems[index]
      if (!item || item.disabled) return
      void item.run()
    },
    [filteredItems]
  )

  const { handleKeyDown } = useKeyboardListNavigation({
    isOpen: true,
    itemCount: filteredItems.length,
    highlightedIndex,
    setHighlightedIndex,
    onClose: close,
    onSelect: selectItem,
    listRef,
  })

  const modeTitle = (() => {
    if (mode === 'projects') return 'Open project'
    if (mode === 'models') return 'Switch model'
    if (mode === 'assistants') return 'Switch assistant'
    return 'Command center'
  })()

  return (
    <DialogContent
      className="sm:max-w-xl gap-0 overflow-hidden p-0"
      onKeyDown={handleKeyDown}
      showCloseButton={false}
    >
      <VisuallyHidden>
        <DialogTitle>{modeTitle}</DialogTitle>
      </VisuallyHidden>

      <div className="flex items-center gap-2 border-b border-border-soft px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={mode === 'commands' ? 'Type a command' : `Filter ${mode}`}
          className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {mode !== 'commands' && (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            onClick={() => {
              setMode('commands')
              setQuery('')
            }}
          >
            All commands
          </button>
        )}
      </div>

      <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
        {filteredItems.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">
            No matching commands
          </div>
        ) : (
          filteredItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              data-keyboard-option
              data-keyboard-index={index}
              disabled={item.disabled}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => selectItem(index)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
                highlightedIndex === index && 'bg-secondary/70',
                item.disabled
                  ? 'cursor-not-allowed opacity-45'
                  : 'cursor-pointer hover:bg-secondary/60'
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-soft bg-surface-2 text-muted-foreground">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.title}
                </span>
                {item.subtitle && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </span>
                )}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border-soft px-3 py-2 text-xs text-muted-foreground">
        <span>Arrow keys to move</span>
        <span>Enter to select - Esc to close</span>
      </div>
    </DialogContent>
  )
}
