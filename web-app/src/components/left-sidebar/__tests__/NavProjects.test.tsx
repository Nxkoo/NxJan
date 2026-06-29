import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SidebarProvider } from '@/components/ui/sidebar'
import { NavProjects } from '../NavProjects'

const createThreadMock = vi.fn()
const navigateMock = vi.fn()

let threadsStore: Record<string, any> = {}
let expandedProjectsStore: string[] = []
let foldersStore: any[] = []

vi.mock('@/hooks/useThreadManagement', () => ({
  useThreadManagement: () => ({
    folders: foldersStore,
    updateFolder: vi.fn(),
  }),
}))

vi.mock('@/hooks/useThreads', () => ({
  useThreads: (selector: any) =>
    selector({
      threads: threadsStore,
      createThread: createThreadMock,
    }),
}))

vi.mock('@/hooks/useAssistant', () => ({
  useAssistant: () => ({
    assistants: [],
    setCurrentAssistant: vi.fn(),
  }),
}))

vi.mock('@/hooks/useModelProvider', () => ({
  useModelProvider: () => ({
    selectedModel: { id: 'model-a' },
    selectedProvider: 'llamacpp',
  }),
}))

vi.mock('@/i18n/react-i18next-compat', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  Link: ({ children, to, params }: any) => (
    <a href={to.replace('$projectId', params?.projectId ?? '')}>{children}</a>
  ),
  createFileRoute: () => () => null,
}))

vi.mock('@/containers/ThreadList', () => ({
  default: ({ threads }: any) => (
    <div data-testid="thread-list">
      {threads.map((t: any) => (
        <div key={t.id} data-testid="thread-item">
          {t.title}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@/containers/dialogs/AddProjectDialog', () => ({
  default: () => null,
}))

vi.mock('@/containers/dialogs/DeleteProjectDialog', () => ({
  DeleteProjectDialog: () => null,
}))

function renderWithSidebar(ui: React.ReactNode) {
  return render(<SidebarProvider>{ui}</SidebarProvider>)
}

describe('NavProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    threadsStore = {}
    expandedProjectsStore = []
    foldersStore = []
    localStorage.clear()
  })

  it('renders nothing when there are no projects', () => {
    renderWithSidebar(<NavProjects />)
    expect(screen.queryByText('common:projects.title')).not.toBeInTheDocument()
  })

  it('renders a list of projects', () => {
    foldersStore = [
      { id: 'project-1', name: 'Project Alpha', updated_at: 1 },
      { id: 'project-2', name: 'Project Beta', updated_at: 2 },
    ]

    renderWithSidebar(<NavProjects />)

    expect(screen.getByText('Project Alpha')).toBeInTheDocument()
    expect(screen.getByText('Project Beta')).toBeInTheDocument()
  })

  it('expands a project and shows its threads', () => {
    foldersStore = [{ id: 'project-1', name: 'Project Alpha', updated_at: 1 }]
    threadsStore = {
      'thread-1': {
        id: 'thread-1',
        title: 'Thread One',
        metadata: { project: { id: 'project-1' } },
        updated: 1,
      },
    }

    renderWithSidebar(<NavProjects />)

    const expandButton = screen.getByLabelText('common:projects.expandProject')
    fireEvent.click(expandButton)

    expect(screen.getByTestId('thread-list')).toBeInTheDocument()
    expect(screen.getByText('Thread One')).toBeInTheDocument()
  })

  it('creates a new conversation when the new conversation button is clicked', async () => {
    foldersStore = [
      { id: 'project-1', name: 'Project Alpha', updated_at: 1, assistantId: 'assistant-1' },
    ]
    threadsStore = {}

    createThreadMock.mockResolvedValue({ id: 'thread-new' })

    renderWithSidebar(<NavProjects />)

    const expandButton = screen.getByLabelText('common:projects.expandProject')
    fireEvent.click(expandButton)

    const newConversationButton = await screen.findByText('common:projects.newConversation')

    await act(async () => {
      fireEvent.click(newConversationButton)
    })

    expect(createThreadMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'model-a', provider: 'llamacpp' }),
      undefined,
      undefined,
      expect.objectContaining({ id: 'project-1', name: 'Project Alpha' })
    )
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/threads/$threadId',
      params: { threadId: 'thread-new' },
    })
  })
})
