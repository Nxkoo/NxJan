import { memo, useMemo, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { MessageCircle, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
import { Loader2 } from '@tabler/icons-react'

import { useThreads } from '@/hooks/useThreads'
import { useThreadManagement } from '@/hooks/useThreadManagement'
import { useIsThreadActive } from '@/hooks/useAppState'
import { useChatSessions } from '@/stores/chat-session-store'
import { useTranslation } from '@/i18n/react-i18next-compat'
import {
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuAction,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RenameThreadDialog, DeleteThreadDialog } from '@/containers/dialogs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type ProjectThreadItemProps = {
  thread: Thread
  projectId: string
  projectName: string
  isMobile: boolean
}

const ProjectThreadItem = memo(
  ({ thread, projectId, projectName, isMobile }: ProjectThreadItemProps) => {
    const { t } = useTranslation()
    const deleteThread = useThreads((state) => state.deleteThread)
    const renameThread = useThreads((state) => state.renameThread)
    const updateThread = useThreads((state) => state.updateThread)

    const [renameOpen, setRenameOpen] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

    const isAppStateActive = useIsThreadActive(thread.id)
    const isSessionStreaming = useChatSessions(
      (state) => state.sessions[thread.id]?.isStreaming ?? false
    )
    const isActive = isAppStateActive || isSessionStreaming

    const currentThreadId = useParams({
      strict: false,
      select: (params) => params.threadId,
    })
    const isSelected = currentThreadId === thread.id

    const plainTitleForRename = useMemo(() => {
      return (thread.title || '').replace(/<span[^>]*>|<\/span>/g, '')
    }, [thread.title])

    const handleRemoveFromProject = () => {
      updateThread(thread.id, {
        metadata: {
          ...thread.metadata,
          project: undefined,
        },
      })
      toast.success(`Thread removed from "${projectName}" successfully`)
    }

    return (
      <SidebarMenuSubItem className="group/menu-item relative">
        <SidebarMenuSubButton
          asChild
          size="sm"
          isActive={isSelected}
          className={cn(
            'pr-7',
            isActive && 'text-sidebar-accent-foreground'
          )}
        >
          <Link
            to="/threads/$threadId"
            params={{ threadId: thread.id }}
            className="flex items-center gap-2"
          >
            {isActive ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <MessageCircle className="size-3.5 shrink-0 text-muted-foreground/70" />
            )}
            <span
              className="truncate"
              title={thread.title || t('common:newThread')}
            >
              {thread.title || t('common:newThread')}
            </span>
          </Link>
        </SidebarMenuSubButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              showOnHover
              className="hover:bg-sidebar-foreground/8 right-1 [&>svg]:size-3.5"
            >
              <MoreHorizontal />
              <span className="sr-only">More</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-44"
            side={isMobile ? 'bottom' : 'right'}
            align={isMobile ? 'end' : 'start'}
          >
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
              <Pencil className="size-4" />
              <span>{t('common:rename')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleRemoveFromProject}>
              <X className="size-4" />
              <span>{t('common:projects.removeFromProject')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={
                thread.title === 'What is Jan?' &&
                !localStorage.getItem('setup-completed')
              }
              onSelect={() => {
                if (
                  thread.title !== 'What is Jan?' ||
                  localStorage.getItem('setup-completed')
                ) {
                  setDeleteConfirmOpen(true)
                }
              }}
            >
              <Trash2 className="size-4" />
              <span>{t('common:delete')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <RenameThreadDialog
          thread={thread}
          plainTitleForRename={plainTitleForRename}
          onRename={renameThread}
          open={renameOpen}
          onOpenChange={setRenameOpen}
          withoutTrigger
        />

        <DeleteThreadDialog
          thread={thread}
          onDelete={deleteThread}
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          withoutTrigger
        />
      </SidebarMenuSubItem>
    )
  }
)
ProjectThreadItem.displayName = 'ProjectThreadItem'

type ProjectThreadListProps = {
  threads: Thread[]
  projectId: string
  projectName: string
  isMobile: boolean
}

export const ProjectThreadList = memo(
  ({ threads, projectId, projectName, isMobile }: ProjectThreadListProps) => {
    const sortedThreads = useMemo(() => {
      return [...threads].sort((a, b) => (b.updated || 0) - (a.updated || 0))
    }, [threads])

    return (
      <>
        {sortedThreads.map((thread) => (
          <ProjectThreadItem
            key={thread.id}
            thread={thread}
            projectId={projectId}
            projectName={projectName}
            isMobile={isMobile}
          />
        ))}
      </>
    )
  }
)
ProjectThreadList.displayName = 'ProjectThreadList'
