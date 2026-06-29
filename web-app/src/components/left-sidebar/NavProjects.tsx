import {
  ChevronDown,
  FolderEditIcon,
  FolderIcon,
  FolderOpenIcon,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useThreadManagement } from "@/hooks/useThreadManagement"
import { useThreads } from "@/hooks/useThreads"
import { useAssistant } from "@/hooks/useAssistant"
import { Link, useNavigate } from "@tanstack/react-router"

import { useCallback, useMemo, useState } from "react"
import { useTranslation } from '@/i18n/react-i18next-compat'
import type { ThreadFolder } from "@/services/projects/types"
import AddProjectDialog from "@/containers/dialogs/AddProjectDialog"
import { DeleteProjectDialog } from "@/containers/dialogs/DeleteProjectDialog"
import { ProjectThreadList } from "./ProjectThreadList"
import { route } from "@/constants/routes"

const EXPANDED_PROJECTS_KEY = 'jan:expanded-projects'

function readExpandedProjects(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_PROJECTS_KEY)
    if (raw) {
      return new Set(JSON.parse(raw) as string[])
    }
  } catch {
    // ignore
  }
  return new Set()
}

function writeExpandedProjects(expanded: Set<string>) {
  try {
    localStorage.setItem(EXPANDED_PROJECTS_KEY, JSON.stringify([...expanded]))
  } catch {
    // ignore
  }
}

function ProjectItem({
  item,
  isMobile,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: {
  item: ThreadFolder
  isMobile: boolean
  isExpanded: boolean
  onToggleExpand: (projectId: string) => void
  onEdit: (project: ThreadFolder) => void
  onDelete: (project: ThreadFolder) => void
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { assistants, setCurrentAssistant } = useAssistant()
  const threads = useThreads((state) => state.threads)

  const projectThreads = useMemo(() => {
    return Object.values(threads)
      .filter((thread) => thread.metadata?.project?.id === item.id)
      .sort((a, b) => (b.updated || 0) - (a.updated || 0))
  }, [threads, item.id])

  const handleNewConversation = useCallback(() => {
    const projectAssistant = item.assistantId
      ? assistants.find((a) => a.id === item.assistantId)
      : undefined

    if (projectAssistant) {
      setCurrentAssistant(projectAssistant)
    }

    navigate({ to: route.home, search: { projectId: item.id } })
  }, [
    assistants,
    item.assistantId,
    item.id,
    navigate,
    setCurrentAssistant,
  ])

  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggleExpand(item.id)}>
      <SidebarMenuItem>
        <div className="flex items-center w-full">
          <SidebarMenuButton asChild>
            <Link
              to="/project/$projectId"
              params={{ projectId: item.id }}
            >
              <FolderIcon className="text-foreground/70" size={18} />
              <span className="font-medium">{item.name}</span>
            </Link>
          </SidebarMenuButton>
          <CollapsibleTrigger asChild>
            <SidebarMenuAction
              className="hover:bg-sidebar-foreground/8 data-[state=open]:rotate-180 transition-transform"
              aria-label={isExpanded ? t('common:projects.collapseProject') : t('common:projects.expandProject')}
            >
              <ChevronDown className="size-4" />
            </SidebarMenuAction>
          </CollapsibleTrigger>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuAction showOnHover className="hover:bg-sidebar-foreground/8 right-7">
                <MoreHorizontal />
                <span className="sr-only">More</span>
              </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-48"
              side={isMobile ? "bottom" : "right"}
              align={isMobile ? "end" : "start"}
            >
              <DropdownMenuItem onSelect={() => {
                navigate({ to: '/project/$projectId', params: { projectId: item.id } })
              }}>
                <FolderOpenIcon className="text-muted-foreground" />
                <span>View Project</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onEdit(item)}>
                <FolderEditIcon className="text-muted-foreground" />
                <span>Edit Project</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(item)}>
                <Trash2 />
                <span>Delete Project</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CollapsibleContent>
          <SidebarMenuSub>
            {projectThreads.length > 0 ? (
              <ProjectThreadList threads={projectThreads} projectId={item.id} projectName={item.name} isMobile={isMobile} />
            ) : null}
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                asChild
                size="sm"
                className="cursor-pointer"
                onClick={handleNewConversation}
              >
                <div className="flex items-center gap-2">
                  <Plus className="size-3.5 shrink-0" />
                  <span className="truncate">{t('common:projects.newConversation')}</span>
                </div>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function NavProjects() {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()
  const { folders, updateFolder } = useThreadManagement()

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ThreadFolder | null>(null)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(readExpandedProjects)

  const handleEdit = (project: ThreadFolder) => {
    setSelectedProject(project)
    setEditDialogOpen(true)
  }

  const handleDelete = (project: ThreadFolder) => {
    setSelectedProject(project)
    setDeleteDialogOpen(true)
  }

  const handleSaveEdit = async (name: string, assistantId?: string) => {
    if (selectedProject) {
      await updateFolder(selectedProject.id, name, assistantId)
      setEditDialogOpen(false)
      setSelectedProject(null)
    }
  }

  const handleToggleExpand = useCallback((projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      writeExpandedProjects(next)
      return next
    })
  }, [])

  if (folders.length === 0) {
    return null
  }

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden py-2">
        <SidebarGroupLabel>{t('common:projects.title')}</SidebarGroupLabel>
        <SidebarMenu>
          {folders.map((item) => (
            <ProjectItem
              key={item.id}
              item={item}
              isMobile={isMobile}
              isExpanded={expandedProjects.has(item.id)}
              onToggleExpand={handleToggleExpand}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </SidebarMenu>
      </SidebarGroup>

      <AddProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editingKey={selectedProject?.id ?? null}
        initialData={selectedProject ?? undefined}
        onSave={handleSaveEdit}
      />

      <DeleteProjectDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        projectId={selectedProject?.id}
        projectName={selectedProject?.name}
      />
    </>
  )
}
