//! Safe wrappers around the `codebase-memory-mcp` CLI binary.
//!
//! Security notes:
//! - We never build shell strings. Every spawn uses `Command::new(...).args(...)`
//!   with literal arguments so paths with spaces, quotes, or shell metachars
//!   are passed verbatim.
//! - The CLI prints log lines before the final JSON object; we use
//!   `extract_last_json_object` to recover the structured payload instead of
//!   trusting a fixed position.
//! - The process is wrapped in a 5-minute wall-clock timeout so a runaway
//!   indexer never wedges the UI thread.

use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;

use serde_json::{json, Value};
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio::time::timeout;

use super::models::{
    CodebaseMemoryAvailability, CodebaseMemoryIndexResult, CodebaseMemoryProjectSummary,
};

/// Default per-invocation timeout for CLI commands. Indexing a large repo can
/// easily take a few minutes; we keep this generous to avoid spurious failures
/// on first run.
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(300);

/// Wall-clock timeout for the cheap `list_projects` / `version` calls.
const SHORT_TIMEOUT: Duration = Duration::from_secs(60);

/// Resolve the absolute path of the `codebase-memory-mcp` binary when the
/// `where` / `which` probe succeeded.
pub(crate) fn find_cli_path() -> Option<PathBuf> {
    let which_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };
    let mut cmd = std::process::Command::new(which_cmd);
    cmd.arg("codebase-memory-mcp");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: keep a console from flashing on Windows.
        cmd.creation_flags(0x0800_0000);
    }

    match cmd.output() {
        Ok(out) if out.status.success() => {
            let raw = String::from_utf8_lossy(&out.stdout);
            raw.lines()
                .map(str::trim)
                .find(|p| !p.is_empty())
                .map(PathBuf::from)
        }
        _ => None,
    }
}

fn push_existing_candidate(candidates: &mut Vec<String>, path: PathBuf) {
    if path.is_file() {
        let value = path.to_string_lossy().to_string();
        if !candidates.iter().any(|p| p == &value) {
            candidates.push(value);
        }
    }
}

fn push_windows_script_candidates(candidates: &mut Vec<String>, dir: PathBuf) {
    push_existing_candidate(candidates, dir.join("codebase-memory-mcp.exe"));
    push_existing_candidate(candidates, dir.join("codebase-memory-mcp.cmd"));
    push_existing_candidate(candidates, dir.join("codebase-memory-mcp.bat"));
}

/// Candidate executable locations. GUI apps on Windows may not inherit the
/// exact PATH a user sees in PowerShell, so we probe the known Python/npm user
/// bin directories in addition to `where`/`which` and the bare command name.
fn cli_candidates() -> Vec<String> {
    let mut candidates = Vec::new();

    if let Ok(path) = std::env::var("CODEBASE_MEMORY_MCP_PATH") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            candidates.push(trimmed.to_string());
        }
    }

    if let Some(path) = find_cli_path() {
        candidates.push(path.to_string_lossy().to_string());
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let appdata = PathBuf::from(appdata);
            push_windows_script_candidates(&mut candidates, appdata.join("npm"));
            let python_root = appdata.join("Python");
            if let Ok(entries) = std::fs::read_dir(python_root) {
                for entry in entries.flatten() {
                    push_windows_script_candidates(&mut candidates, entry.path().join("Scripts"));
                }
            }
        }

        if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
            let programs_root = PathBuf::from(localappdata).join("Programs");
            push_existing_candidate(
                &mut candidates,
                programs_root
                    .join("codebase-memory-mcp")
                    .join("codebase-memory-mcp.exe"),
            );
            let python_root = programs_root.join("Python");
            if let Ok(entries) = std::fs::read_dir(python_root) {
                for entry in entries.flatten() {
                    push_windows_script_candidates(&mut candidates, entry.path().join("Scripts"));
                }
            }
        }

        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            push_windows_script_candidates(
                &mut candidates,
                PathBuf::from(userprofile).join(".local").join("bin"),
            );
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(home) = std::env::var("HOME") {
            push_existing_candidate(
                &mut candidates,
                PathBuf::from(home)
                    .join(".local")
                    .join("bin")
                    .join("codebase-memory-mcp"),
            );
        }
    }

    let bare = "codebase-memory-mcp".to_string();
    if !candidates.iter().any(|p| p == &bare) {
        candidates.push(bare);
    }

    candidates
}

/// Build a `Command` for the given binary path. The caller owns spawning.
fn build_command(binary: &str) -> Command {
    let mut cmd = Command::new(binary);
    // Detach stdio so child logs don't bleed into the app's stdout.
    cmd.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    // `tokio::process::Command` exposes `creation_flags` directly on Windows.
    #[cfg(windows)]
    {
        cmd.creation_flags(0x0800_0000);
    }
    cmd
}

/// Run `codebase-memory-mcp --version` and report availability.
pub async fn check_available() -> CodebaseMemoryAvailability {
    let mut last_error = None;
    for binary in cli_candidates() {
        let mut cmd = build_command(&binary);
        cmd.arg("--version");

        let result = run_with_timeout(cmd, SHORT_TIMEOUT).await;
        match result {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                let version = stdout
                    .lines()
                    .map(str::trim)
                    .find(|l| !l.is_empty())
                    .map(str::to_string);
                return CodebaseMemoryAvailability {
                    available: true,
                    version_output: Some(stdout),
                    version,
                    path: Some(binary),
                    exit_code: out.status.code(),
                    error: None,
                };
            }
            Ok(out) => {
                last_error = Some(format_error("version", &out));
            }
            Err(err) => {
                last_error = Some(err);
            }
        }
    }

    CodebaseMemoryAvailability {
        available: false,
        version_output: None,
        version: None,
        path: find_cli_path().map(|p| p.to_string_lossy().to_string()),
        exit_code: None,
        error: Some(last_error.unwrap_or_else(|| {
            "codebase-memory-mcp CLI was not found. Install it and restart Jan, or launch Jan from a terminal where `codebase-memory-mcp --version` works."
                .to_string()
        })),
    }
}

/// Run `codebase-memory-mcp cli list_projects` and return the parsed list.
///
/// The CLI prints a JSON object on the last line. We accept either a bare
/// array or `{"projects": [...]}` / `{"items": [...]}` envelopes so the same
/// parser works across CLI versions.
pub async fn list_projects() -> Result<Vec<CodebaseMemoryProjectSummary>, String> {
    let binary = resolve_binary().await?;
    let mut cmd = build_command(&binary);
    cmd.arg("cli").arg("list_projects");

    let output = run_with_timeout(cmd, SHORT_TIMEOUT)
        .await
        .map_err(|e| format!("Failed to run list_projects: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    if !output.status.success() {
        return Err(format_error("list_projects", &output));
    }

    let value = extract_last_json_object(&stdout).ok_or_else(|| {
        "codebase-memory-mcp list_projects did not return a JSON payload".to_string()
    })?;
    parse_project_list(value)
}

/// Run `codebase-memory-mcp cli index_repository {repo_path}` and parse the
/// response. The generated project name is returned to the caller so the UI
/// can persist it (path → project mapping isn't guaranteed stable).
pub async fn index_repository(repo_path: &str) -> Result<CodebaseMemoryIndexResult, String> {
    let repo_path = validate_repo_path(repo_path)?;
    let binary = resolve_binary().await?;

    let mut cmd = build_command(&binary);
    cmd.arg("cli")
        .arg("index_repository")
        .arg(json!({ "repo_path": repo_path }).to_string());

    let output = run_with_timeout(cmd, DEFAULT_TIMEOUT)
        .await
        .map_err(|e| format!("Failed to run index_repository: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    if !output.status.success() {
        return Err(format_error("index_repository", &output));
    }

    let value = extract_last_json_object(&stdout).ok_or_else(|| {
        "codebase-memory-mcp index_repository did not return a JSON payload".to_string()
    })?;
    parse_index_result(value, &repo_path)
}

/// Optional debug helper used by the in-app inspector.
pub async fn search_graph(
    project: &str,
    label: Option<&str>,
    name_pattern: Option<&str>,
) -> Result<super::models::CodebaseMemorySearchResult, String> {
    if project.trim().is_empty() {
        return Err("Project name is required".to_string());
    }
    let binary = resolve_binary().await?;
    let mut cmd = build_command(&binary);
    cmd.arg("cli").arg("search_graph");

    let mut payload = serde_json::Map::new();
    payload.insert("project".into(), Value::String(project.to_string()));
    if let Some(label) = label {
        if !label.is_empty() {
            payload.insert("label".into(), Value::String(label.to_string()));
        }
    }
    if let Some(pattern) = name_pattern {
        if !pattern.is_empty() {
            payload.insert("name_pattern".into(), Value::String(pattern.to_string()));
        }
    }
    let json = Value::Object(payload).to_string();
    cmd.arg(json);

    let output = run_with_timeout(cmd, SHORT_TIMEOUT)
        .await
        .map_err(|e| format!("Failed to run search_graph: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    if !output.status.success() {
        return Err(format_error("search_graph", &output));
    }
    let parsed = extract_last_json_object(&stdout)
        .unwrap_or_else(|| Value::String(stdout.trim().to_string()));
    Ok(super::models::CodebaseMemorySearchResult {
        output: parsed,
        raw: stdout,
    })
}

async fn resolve_binary() -> Result<String, String> {
    let mut last_error = None;
    for binary in cli_candidates() {
        let mut cmd = build_command(&binary);
        cmd.arg("--version");
        match run_with_timeout(cmd, SHORT_TIMEOUT).await {
            Ok(out) if out.status.success() => return Ok(binary),
            Ok(out) => last_error = Some(format_error("version", &out)),
            Err(err) => last_error = Some(err),
        }
    }
    Err(last_error.unwrap_or_else(|| {
        "codebase-memory-mcp CLI was not found. Install it and restart Jan, or launch Jan from a terminal where `codebase-memory-mcp --version` works."
            .to_string()
    }))
}

fn validate_repo_path(repo_path: &str) -> Result<String, String> {
    if repo_path.trim().is_empty() {
        return Err("Folder path is empty".to_string());
    }
    let path = PathBuf::from(repo_path);
    if !path.exists() {
        return Err(format!("Folder does not exist: {}", path.to_string_lossy()));
    }
    if !path.is_dir() {
        return Err(format!("Path is not a folder: {}", path.to_string_lossy()));
    }
    Ok(path.to_string_lossy().to_string())
}

#[cfg(test)]
fn escape_json_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '"' => out.push_str(r#"\""#),
            '\\' => out.push_str(r"\\"),
            '\n' => out.push_str(r"\n"),
            '\r' => out.push_str(r"\r"),
            '\t' => out.push_str(r"\t"),
            '\x08' => out.push_str(r"\b"),
            '\x0c' => out.push_str(r"\f"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out
}

fn format_error(stage: &str, output: &std::process::Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let code = output.status.code();
    let mut msg = format!("codebase-memory-mcp {stage} failed");
    if let Some(c) = code {
        msg.push_str(&format!(" (exit code {c})"));
    }
    let stderr_trim = stderr.trim();
    let stdout_trim = stdout.trim();
    if !stderr_trim.is_empty() {
        msg.push_str(": ");
        msg.push_str(stderr_trim);
    } else if !stdout_trim.is_empty() {
        msg.push_str(": ");
        msg.push_str(stdout_trim);
    }
    msg
}

async fn run_with_timeout(
    mut cmd: Command,
    limit: Duration,
) -> Result<std::process::Output, String> {
    let future = async move {
        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn codebase-memory-mcp: {e}"))?;
        let out = child
            .wait_with_output()
            .await
            .map_err(|e| format!("Failed to read codebase-memory-mcp output: {e}"))?;
        Ok::<_, String>(out)
    };
    match timeout(limit, future).await {
        Ok(result) => result,
        Err(_) => Err(format!(
            "codebase-memory-mcp timed out after {}s",
            limit.as_secs()
        )),
    }
}

/// Recover the last balanced JSON object from arbitrary log output.
///
/// `codebase-memory-mcp cli` prints log lines on stdout before the structured
/// payload. Scanning for the final `{ ... }` lets us stay forward-compatible
/// with extra log lines without parsing each line.
pub(crate) fn extract_last_json_object(text: &str) -> Option<Value> {
    let bytes = text.as_bytes();
    let mut start: Option<usize> = None;
    let mut in_string = false;
    let mut escape = false;
    let mut depth: i32 = 0;
    let mut last_obj: Option<(usize, usize)> = None;
    let mut idx = 0;

    while idx < bytes.len() {
        let b = bytes[idx];
        if escape {
            escape = false;
            idx += 1;
            continue;
        }
        if in_string {
            match b {
                b'\\' => escape = true,
                b'"' => in_string = false,
                _ => {}
            }
            idx += 1;
            continue;
        }
        match b {
            b'"' => in_string = true,
            b'{' => {
                if depth == 0 {
                    start = Some(idx);
                }
                depth += 1;
            }
            b'}' => {
                if depth > 0 {
                    depth -= 1;
                    if depth == 0 {
                        if let Some(s) = start.take() {
                            last_obj = Some((s, idx + 1));
                        }
                    }
                }
            }
            _ => {}
        }
        idx += 1;
    }

    let (s, e) = last_obj?;
    let slice = std::str::from_utf8(&bytes[s..e]).ok()?;
    serde_json::from_str::<Value>(slice).ok()
}

fn parse_project_list(value: Value) -> Result<Vec<CodebaseMemoryProjectSummary>, String> {
    // Accept bare array, {"projects":[...]}, or {"items":[...]}.
    let array = match &value {
        Value::Array(_) => value.clone(),
        Value::Object(map) => {
            if let Some(v) = map
                .get("projects")
                .or_else(|| map.get("items"))
                .or_else(|| map.get("data"))
            {
                v.clone()
            } else {
                return Err("list_projects payload had no projects/items array".to_string());
            }
        }
        _ => return Err("list_projects payload is not an object/array".to_string()),
    };

    let items = array
        .as_array()
        .ok_or_else(|| "list_projects payload is not iterable".to_string())?;

    let mut out = Vec::with_capacity(items.len());
    for item in items {
        let obj = item
            .as_object()
            .ok_or_else(|| "list_projects item is not an object".to_string())?;
        let project = obj
            .get("project")
            .or_else(|| obj.get("name"))
            .or_else(|| obj.get("id"))
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .ok_or_else(|| "list_projects item missing 'project' field".to_string())?;
        let label = obj
            .get("label")
            .or_else(|| obj.get("display_name"))
            .and_then(|v| v.as_str())
            .map(str::to_string);
        let path = obj
            .get("path")
            .or_else(|| obj.get("repo_path"))
            .or_else(|| obj.get("root_path"))
            .or_else(|| obj.get("root"))
            .and_then(|v| v.as_str())
            .map(str::to_string);
        let nodes = obj
            .get("nodes")
            .or_else(|| obj.get("node_count"))
            .and_then(|v| v.as_u64());
        let edges = obj
            .get("edges")
            .or_else(|| obj.get("edge_count"))
            .and_then(|v| v.as_u64());
        let extra = obj.clone();
        out.push(CodebaseMemoryProjectSummary {
            project,
            label,
            path,
            nodes,
            edges,
            extra: Value::Object(extra),
        });
    }
    Ok(out)
}

fn parse_index_result(value: Value, repo_path: &str) -> Result<CodebaseMemoryIndexResult, String> {
    let map = value
        .as_object()
        .ok_or_else(|| "index_repository payload is not an object".to_string())?;

    let project = map
        .get("project")
        .or_else(|| map.get("project_name"))
        .or_else(|| map.get("name"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .ok_or_else(|| "index_repository payload missing 'project' field".to_string())?;

    let status = map
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("ok")
        .to_string();

    let nodes = map
        .get("nodes")
        .or_else(|| map.get("node_count"))
        .and_then(|v| v.as_u64());

    let edges = map
        .get("edges")
        .or_else(|| map.get("edge_count"))
        .and_then(|v| v.as_u64());

    let excluded_dirs = map
        .get("excluded_dirs")
        .or_else(|| map.get("excluded"))
        .or_else(|| map.get("skipped_dirs"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();

    Ok(CodebaseMemoryIndexResult {
        project,
        repo_path: repo_path.to_string(),
        status,
        nodes,
        edges,
        excluded_dirs,
        extra: value,
    })
}

/// Async wrapper around the synchronous child output, used only in unit tests
/// to keep the API uniform with the rest of the module.
#[allow(dead_code)]
async fn read_to_string(mut reader: tokio::process::ChildStdout) -> String {
    let mut s = String::new();
    let _ = reader.read_to_string(&mut s).await;
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_last_json_object_finds_final_payload() {
        let text =
            "INFO start\nINFO building graph\n{\"project\":\"abc\",\"status\":\"ok\"}\nINFO done\n";
        let value = extract_last_json_object(text).expect("object");
        assert_eq!(value.get("project").and_then(|v| v.as_str()), Some("abc"));
    }

    #[test]
    fn extract_last_json_object_handles_nested_objects() {
        let text = "noise {\"project\":\"abc\",\"stats\":{\"nodes\":12,\"edges\":3}} trailing\n";
        let value = extract_last_json_object(text).expect("object");
        let nodes = value
            .get("stats")
            .and_then(|s| s.get("nodes"))
            .and_then(|n| n.as_u64());
        assert_eq!(nodes, Some(12));
    }

    #[test]
    fn extract_last_json_object_returns_none_when_absent() {
        let text = "no payload here\n";
        assert!(extract_last_json_object(text).is_none());
    }

    #[test]
    fn parse_project_list_supports_bare_array() {
        let v = serde_json::json!([
            {"project":"P1","path":"/x"},
            {"name":"P2","repo_path":"/y"}
        ]);
        let parsed = parse_project_list(v).expect("list");
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].project, "P1");
        assert_eq!(parsed[1].project, "P2");
        assert_eq!(parsed[1].path.as_deref(), Some("/y"));
    }

    #[test]
    fn parse_project_list_supports_projects_envelope() {
        let v = serde_json::json!({"projects":[{"project":"P1"}]});
        let parsed = parse_project_list(v).expect("list");
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].project, "P1");
    }

    #[test]
    fn parse_index_result_reads_core_fields() {
        let v = serde_json::json!({
            "project": "D-My-Projects-NxLib",
            "status": "ok",
            "nodes": 1234,
            "edges": 567,
            "excluded_dirs": ["node_modules", ".git"]
        });
        let parsed = parse_index_result(v, "D:/My Projects/NxLib").expect("result");
        assert_eq!(parsed.project, "D-My-Projects-NxLib");
        assert_eq!(parsed.repo_path, "D:/My Projects/NxLib");
        assert_eq!(parsed.nodes, Some(1234));
        assert_eq!(parsed.edges, Some(567));
        assert_eq!(
            parsed.excluded_dirs,
            vec!["node_modules".to_string(), ".git".to_string()]
        );
    }

    #[test]
    fn parse_index_result_rejects_missing_project() {
        let v = serde_json::json!({"status": "ok"});
        assert!(parse_index_result(v, "/x").is_err());
    }

    #[test]
    fn escape_json_string_keeps_unicode_and_escapes_quotes() {
        let s = "D:\\My Projects\\Nx\"lib";
        let escaped = escape_json_string(s);
        assert!(escaped.contains(r#"\""#));
        assert!(escaped.contains(r"\\"));
    }
}
