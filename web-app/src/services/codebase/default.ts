/**
 * Default Codebase Service - Generic implementation with no-op behavior
 * outside Tauri. Mirrors `DefaultMCPService` / `DefaultProjectsService` so
 * the web/mobile builds keep working without the native bridge.
 */

import type {
  CodebaseMemoryAvailability,
  CodebaseMemoryIndexResult,
  CodebaseMemoryProject,
  CodebaseMemorySearchResult,
  CodebaseService,
} from './types'

export class DefaultCodebaseService implements CodebaseService {
  async checkAvailable(): Promise<CodebaseMemoryAvailability> {
    return {
      available: false,
      version_output: null,
      version: null,
      path: null,
      exit_code: null,
      error:
        'Codebase Memory CLI is only available in the Tauri desktop app.',
    }
  }

  async listProjects(): Promise<CodebaseMemoryProject[]> {
    return []
  }

  async indexRepository(
    repoPath: string
  ): Promise<CodebaseMemoryIndexResult> {
    void repoPath
    throw new Error(
      'Indexing is only available in the Tauri desktop app.'
    )
  }

  async searchGraph(
    project: string,
    label?: string,
    namePattern?: string
  ): Promise<CodebaseMemorySearchResult> {
    void project
    void label
    void namePattern
    throw new Error(
      'search_graph is only available in the Tauri desktop app.'
    )
  }
}
