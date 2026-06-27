//! Tauri commands exposing the `codebase-memory-mcp` CLI to the frontend.
//!
//! Every command is a thin wrapper around `core::codebase::helpers` and
//! converts the underlying `Result<T, String>` into a `Result<T, String>` so
//! the JS side receives plain error messages.

use super::{
    helpers::{check_available, index_repository, list_projects, search_graph},
    models::{
        CodebaseMemoryAvailability, CodebaseMemoryIndexResult, CodebaseMemoryProjectSummary,
        CodebaseMemorySearchResult,
    },
};

/// Probe whether the `codebase-memory-mcp` CLI is installed and reachable.
#[tauri::command]
pub async fn codebase_memory_check_available() -> Result<CodebaseMemoryAvailability, String> {
    Ok(check_available().await)
}

/// List every codebase project already indexed by the CLI.
#[tauri::command]
pub async fn codebase_memory_list_projects() -> Result<Vec<CodebaseMemoryProjectSummary>, String> {
    list_projects().await
}

/// Index the given folder with the CLI and return the generated project name.
#[tauri::command]
pub async fn codebase_memory_index_repository(
    repo_path: String,
) -> Result<CodebaseMemoryIndexResult, String> {
    index_repository(&repo_path).await
}

/// Debug helper used by the in-app inspector. Not part of the documented
/// surface — kept for parity with the CLI's `search_graph` invocation.
#[tauri::command]
pub async fn codebase_memory_search_graph(
    project: String,
    label: Option<String>,
    name_pattern: Option<String>,
) -> Result<CodebaseMemorySearchResult, String> {
    search_graph(&project, label.as_deref(), name_pattern.as_deref()).await
}
