//! Models returned by the Codebase Memory CLI bridge.
//!
//! These types are intentionally permissive: every field the backend doesn't
//! know about (e.g. tool-specific extras) is preserved in `extra` so the
//! frontend can surface raw CLI output without losing data.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodebaseMemoryAvailability {
    /// Whether `codebase-memory-mcp --version` exited successfully.
    pub available: bool,
    /// `codebase-memory-mcp --version` stdout, trimmed. May include extra lines.
    pub version_output: Option<String>,
    /// First non-empty line of the version output (used as the user-facing version).
    pub version: Option<String>,
    /// Path returned by `where` / `which`, if any.
    pub path: Option<String>,
    /// `codebase-memory-mcp --version` exit code, if the process was launched.
    pub exit_code: Option<i32>,
    /// Human-readable error message, only populated when `available` is false.
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodebaseMemoryProjectSummary {
    /// Best-effort project name returned by the CLI (e.g. `D-My-Projects-NxLib`).
    /// This is the canonical identifier used by `search_graph` / `search_code`.
    pub project: String,
    /// Optional human-readable label, if the CLI exposes one.
    #[serde(default)]
    pub label: Option<String>,
    /// Optional absolute path the project maps to.
    #[serde(default)]
    pub path: Option<String>,
    /// Number of nodes persisted, if the CLI reported it.
    #[serde(default)]
    pub nodes: Option<u64>,
    /// Number of edges persisted, if the CLI reported it.
    #[serde(default)]
    pub edges: Option<u64>,
    /// Anything else the CLI returned. Preserved verbatim so new fields surface
    /// without requiring a frontend change.
    #[serde(default)]
    pub extra: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodebaseMemoryIndexResult {
    /// Generated project name (canonical id used by MCP tools).
    pub project: String,
    /// Echoed repository path the indexer ran against.
    pub repo_path: String,
    /// Final CLI status string (`"ok"`, `"error"`, etc.).
    pub status: String,
    /// Number of nodes persisted, if the CLI reported it.
    #[serde(default)]
    pub nodes: Option<u64>,
    /// Number of edges persisted, if the CLI reported it.
    #[serde(default)]
    pub edges: Option<u64>,
    /// Files the indexer chose to skip, if the CLI reported it.
    #[serde(default)]
    pub excluded_dirs: Vec<String>,
    /// Anything else the CLI returned, preserved verbatim.
    #[serde(default)]
    pub extra: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodebaseMemorySearchResult {
    /// Pretty-printed JSON payload returned by the CLI.
    pub output: Value,
    /// Original raw stdout for debugging.
    pub raw: String,
}
