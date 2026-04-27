use tauri::AppHandle;
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AgentContext {
    pub work_item_id: Option<String>,
    pub work_item_title: Option<String>,
    pub work_item_description: Option<String>,
    pub work_item_type: Option<String>,
    pub repo_path: Option<String>,
    pub branch: Option<String>,
    pub additional_context: Option<String>,
    pub skills: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentLogEntry {
    pub timestamp: String,
    pub log_type: String, // "stdout" | "stderr" | "system"
    pub content: String,
}

/// Executes a local agent command and streams output via Tauri events.
/// Returns the execution ID for tracking.
#[tauri::command]
pub async fn run_agent(
    app: AppHandle,
    execution_id: String,
    command: String,
    args: Vec<String>,
    context: AgentContext,
    working_dir: Option<String>,
) -> Result<i32, String> {
    use tauri::Emitter;

    let emit_log = |log_type: &str, content: &str| {
        let entry = AgentLogEntry {
            timestamp: chrono::Utc::now().to_rfc3339(),
            log_type: log_type.to_string(),
            content: content.to_string(),
        };
        let _ = app.emit(&format!("agent:log:{}", execution_id), &entry);
    };

    emit_log("system", &format!("Starting agent: {} {}", command, args.join(" ")));

    // Build env vars from context
    let mut cmd = Command::new(&command);
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(dir) = &working_dir {
        cmd.current_dir(dir);
    }

    if let Some(id) = &context.work_item_id {
        cmd.env("COCKPIT_WORK_ITEM_ID", id);
    }
    if let Some(title) = &context.work_item_title {
        cmd.env("COCKPIT_WORK_ITEM_TITLE", title);
    }
    if let Some(desc) = &context.work_item_description {
        cmd.env("COCKPIT_WORK_ITEM_DESCRIPTION", desc);
    }
    if let Some(repo) = &context.repo_path {
        cmd.env("COCKPIT_REPO_PATH", repo);
        cmd.current_dir(repo);
    }
    if let Some(branch) = &context.branch {
        cmd.env("COCKPIT_BRANCH", branch);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn agent: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let app_stdout = app.clone();
    let exec_id_stdout = execution_id.clone();
    let stdout_handle = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let entry = AgentLogEntry {
                timestamp: chrono::Utc::now().to_rfc3339(),
                log_type: "stdout".to_string(),
                content: line,
            };
            let _ = app_stdout.emit(&format!("agent:log:{}", exec_id_stdout), &entry);
        }
    });

    let app_stderr = app.clone();
    let exec_id_stderr = execution_id.clone();
    let stderr_handle = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let entry = AgentLogEntry {
                timestamp: chrono::Utc::now().to_rfc3339(),
                log_type: "stderr".to_string(),
                content: line,
            };
            let _ = app_stderr.emit(&format!("agent:log:{}", exec_id_stderr), &entry);
        }
    });

    let _ = tokio::join!(stdout_handle, stderr_handle);
    let status = child.wait().await.map_err(|e| e.to_string())?;
    let exit_code = status.code().unwrap_or(-1);

    emit_log("system", &format!("Agent finished with exit code {}", exit_code));
    let _ = app.emit(&format!("agent:done:{}", execution_id), exit_code);

    Ok(exit_code)
}

/// Kill a running agent process by execution ID (if tracked).
#[tauri::command]
pub async fn cancel_agent(_execution_id: String) -> Result<(), String> {
    // In a more complete implementation, we'd store PIDs in a global map
    // and kill by execution_id. For now, emit a cancelled event.
    Ok(())
}
