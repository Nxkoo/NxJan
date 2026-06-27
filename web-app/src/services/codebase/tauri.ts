/**
 * Tauri Codebase Service - Desktop implementation
 *
 * Forwards calls to the native `codebase-memory-mcp` bridge commands defined
 * in `src-tauri/src/core/codebase/commands.rs`.
 */

import { invoke } from '@tauri-apps/api/core'
import { DefaultCodebaseService } from './default'
import type {
  CodebaseMemoryAvailability,
  CodebaseMemoryIndexResult,
  CodebaseMemoryProject,
  CodebaseMemorySearchResult,
} from './types'

export class TauriCodebaseService extends DefaultCodebaseService {
  async checkAvailable(): Promise<CodebaseMemoryAvailability> {
    return await invoke<CodebaseMemoryAvailability>(
      'codebase_memory_check_available'
    )
  }

  async listProjects(): Promise<CodebaseMemoryProject[]> {
    const raw = await invoke<unknown[]>('codebase_memory_list_projects')
    if (!Array.isArray(raw)) return []
    const projects: CodebaseMemoryProject[] = []
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const obj = item as Record<string, unknown>
      const project = obj.project ?? obj.name ?? obj.id
      if (typeof project !== 'string' || !project) continue
      projects.push({
        project,
        label:
          typeof obj.label === 'string' ? (obj.label as string) : null,
        path:
          typeof obj.path === 'string'
            ? (obj.path as string)
            : typeof obj.root_path === 'string'
              ? (obj.root_path as string)
              : null,
        nodes: typeof obj.nodes === 'number' ? obj.nodes : null,
        edges: typeof obj.edges === 'number' ? obj.edges : null,
      })
    }
    return projects
  }

  async indexRepository(
    repoPath: string
  ): Promise<CodebaseMemoryIndexResult> {
    const result = await invoke<{
      project: string
      repo_path: string
      status: string
      nodes?: number | null
      edges?: number | null
      excluded_dirs?: string[]
    }>('codebase_memory_index_repository', { repoPath })
    return {
      project: result.project,
      repo_path: result.repo_path,
      status: result.status,
      nodes: result.nodes ?? null,
      edges: result.edges ?? null,
      excluded_dirs: Array.isArray(result.excluded_dirs)
        ? result.excluded_dirs
        : [],
    }
  }

  async searchGraph(
    project: string,
    label?: string,
    namePattern?: string
  ): Promise<CodebaseMemorySearchResult> {
    return await invoke<CodebaseMemorySearchResult>(
      'codebase_memory_search_graph',
      {
        project,
        label: label ?? null,
        namePattern: namePattern ?? null,
      }
    )
  }
}
