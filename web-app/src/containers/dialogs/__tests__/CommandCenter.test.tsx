import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

const navigateMock = vi.hoisted(() => vi.fn())
const indexRepositoryMock = vi.hoisted(() => vi.fn())
const routerLocationMock = vi.hoisted(() => ({
  pathname: '/project/project-1',
  search: {} as Record<string, unknown>,
}))

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    state: {
      location: routerLocationMock,
    },
    navigate: navigateMock,
  }),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, showCloseButton, ...props }: any) => (
    <div role="dialog" aria-modal="true" {...props}>
      {children}
    </div>
  ),
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

vi.mock('@radix-ui/react-visually-hidden', () => ({
  VisuallyHidden: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/hooks/useServiceHub', () => ({
  useServiceHub: () => ({
    codebase: () => ({
      indexRepository: indexRepositoryMock,
    }),
  }),
}))

vi.mock('@/hooks/useThreadManagement', () => ({
  useThreadManagement: () => ({
    folders: [
      { id: 'project-1', name: 'Workspace Alpha' },
      { id: 'project-2', name: 'Renderer Lab' },
    ],
  }),
}))

vi.mock('@/hooks/useAssistant', () => ({
  useAssistant: () => ({
    assistants: [{ id: 'jan', name: 'NxJan' }],
    currentAssistant: { id: 'jan', name: 'NxJan' },
    setCurrentAssistant: vi.fn(),
  }),
}))

vi.mock('@/hooks/useModelProvider', () => ({
  useModelProvider: () => ({
    providers: [
      {
        provider: 'llamacpp',
        active: true,
        models: [
          {
            id: 'jan-code-4b.gguf',
            displayName: 'Jan Code 4B',
            capabilities: ['completion'],
          },
        ],
        settings: [],
      },
    ],
    selectModelProvider: vi.fn(),
  }),
}))

vi.mock('@/hooks/useThreads', () => ({
  useThreads: (selector: any) =>
    selector({
      updateCurrentThreadModel: vi.fn(),
      updateCurrentThreadAssistant: vi.fn(),
    }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { CommandCenter } from '../CommandCenter'
import { useCommandCenter } from '@/hooks/useCommandCenter'
import { useCodebaseStore } from '@/hooks/useCodebase'

describe('CommandCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerLocationMock.pathname = '/project/project-1'
    routerLocationMock.search = {}
    useCommandCenter.setState({ open: true })
    useCodebaseStore.setState({
      metas: {
        'project-1': [
          {
            id: 'codebase-1',
            displayName: 'NxJan',
            folderPath: 'C:/Users/nykoo/OneDrive/Documentos/jan',
            codebaseMemoryProjectName: 'C-Users-nykoo-OneDrive-Documentos-jan',
            status: 'indexed',
            lastError: null,
            enabled: true,
          },
        ],
      },
    })
  })

  it('filters command items locally', () => {
    render(<CommandCenter />)

    expect(screen.getByText('Open chat')).toBeInTheDocument()
    expect(screen.getByText('Open settings')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Type a command'), {
      target: { value: 'settings' },
    })

    expect(screen.getByText('Open settings')).toBeInTheDocument()
    expect(screen.queryByText('Open chat')).not.toBeInTheDocument()
  })

  it('opens the project selector mode and filters projects', () => {
    render(<CommandCenter />)

    fireEvent.click(screen.getByText('Open project'))
    expect(screen.getByPlaceholderText('Filter projects')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Filter projects'), {
      target: { value: 'renderer' },
    })

    expect(screen.getByText('Renderer Lab')).toBeInTheDocument()
    expect(screen.queryByText('Workspace Alpha')).not.toBeInTheDocument()
  })

  it('opens command submodes with keyboard navigation', () => {
    render(<CommandCenter />)

    const input = screen.getByPlaceholderText('Type a command')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByPlaceholderText('Filter projects')).toBeInTheDocument()
  })

  it('opens outside a project without looping on empty codebase metadata', () => {
    routerLocationMock.pathname = '/'
    useCodebaseStore.setState({ metas: {} })

    render(<CommandCenter />)

    expect(screen.getByText('Open chat')).toBeInTheDocument()
    expect(screen.getByText('Search codebase symbol').closest('button')).toBeDisabled()
  })
})
