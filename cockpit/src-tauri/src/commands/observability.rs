use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Arc;
use tauri::AppHandle;
use tauri::Manager;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};

// ── Payload types (mirroring frontend types) ──────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoredAppPayload {
    pub id: String,
    pub name: String,
    #[serde(rename = "dynatraceEntityId", skip_serializing_if = "Option::is_none")]
    pub dynatrace_entity_id: Option<String>,
    #[serde(rename = "grafanaServiceName", skip_serializing_if = "Option::is_none")]
    pub grafana_service_name: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsightPayload {
    pub id: String,
    #[serde(rename = "appId")]
    pub app_id: String,
    #[serde(rename = "appName")]
    pub app_name: String,
    pub source: String,
    pub severity: String,
    pub title: String,
    pub description: String,
    #[serde(rename = "suggestedAction")]
    pub suggested_action: String,
    pub category: String,
    #[serde(rename = "detectedAt")]
    pub detected_at: String,
    pub status: String,
    #[serde(rename = "rawMetric", skip_serializing_if = "Option::is_none")]
    pub raw_metric: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct InsightsFile {
    insights: Vec<InsightPayload>,
}

#[derive(Debug, Clone, Serialize)]
struct ScanStartEvent {
    #[serde(rename = "executionId")]
    execution_id: String,
}

#[derive(Debug, Clone, Serialize)]
struct ScanDoneEvent {
    insights: Vec<InsightPayload>,
}

#[derive(Debug, Clone, Serialize)]
struct ScanErrorEvent {
    message: String,
}

// ── Shared scheduler state ─────────────────────────────────────────────────────

static SCHEDULER: tokio::sync::OnceCell<Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>> =
    tokio::sync::OnceCell::const_new();

async fn get_scheduler() -> Arc<Mutex<Option<tokio::task::JoinHandle<()>>>> {
    SCHEDULER
        .get_or_init(|| async { Arc::new(Mutex::new(None)) })
        .await
        .clone()
}

// ── Helper: resolve insights file path ────────────────────────────────────────

fn insights_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {e}"))?;
    Ok(data_dir.join("cockpit-insights.json"))
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Load persisted insights from disk. Returns empty vec if file does not exist.
#[tauri::command]
pub async fn load_insights(app: AppHandle) -> Result<Vec<InsightPayload>, String> {
    let path = insights_path(&app)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("Failed to read insights: {e}"))?;
    let file: InsightsFile =
        serde_json::from_str(&raw).map_err(|e| format!("Failed to parse insights: {e}"))?;
    Ok(file.insights)
}

/// Persist new insights to disk, merging with existing ones (dedup by id).
#[tauri::command]
pub async fn save_insights(
    app: AppHandle,
    insights: Vec<InsightPayload>,
) -> Result<(), String> {
    let path = insights_path(&app)?;

    // Read existing
    let mut existing: Vec<InsightPayload> = if path.exists() {
        let raw =
            fs::read_to_string(&path).map_err(|e| format!("Failed to read insights: {e}"))?;
        serde_json::from_str::<InsightsFile>(&raw)
            .map(|f| f.insights)
            .unwrap_or_default()
    } else {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create app data dir: {e}"))?;
        }
        vec![]
    };

    // Dedup: new insights override existing ones with same id
    let new_ids: std::collections::HashSet<&str> = insights.iter().map(|i| i.id.as_str()).collect();
    existing.retain(|i| !new_ids.contains(i.id.as_str()));
    existing.extend(insights);

    // Sort descending by detectedAt and cap at 500
    existing.sort_by(|a, b| b.detected_at.cmp(&a.detected_at));
    existing.truncate(500);

    let file = InsightsFile { insights: existing };
    let json =
        serde_json::to_string_pretty(&file).map_err(|e| format!("Failed to serialize: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write insights: {e}"))?;
    Ok(())
}

/// Spawn the OpenCode monitoring agent in a hidden PTY session.
/// Returns an execution_id. Emits monitoring:scan_start and monitoring:scan_done events.
#[tauri::command]
pub async fn start_monitoring_scan(
    app: AppHandle,
    apps: Vec<MonitoredAppPayload>,
) -> Result<String, String> {
    use tauri::Emitter;

    let execution_id = uuid::Uuid::new_v4().to_string();

    app.emit(
        "monitoring:scan_start",
        ScanStartEvent {
            execution_id: execution_id.clone(),
        },
    )
    .map_err(|e| format!("Failed to emit event: {e}"))?;

    let apps_json =
        serde_json::to_string(&apps).map_err(|e| format!("Failed to serialize apps: {e}"))?;

    // Spawn the monitoring agent as a child process
    let app_handle = app.clone();
    let exec_id = execution_id.clone();
    tokio::spawn(async move {
        let result = tokio::process::Command::new("opencode")
            .args(["run", "monitoring-agent"])
            .env("COCKPIT_MONITORED_APPS", &apps_json)
            .env("COCKPIT_EXECUTION_ID", &exec_id)
            .output()
            .await;

        match result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let mut collected: Vec<InsightPayload> = vec![];

                for line in stdout.lines() {
                    let line = line.trim();
                    if line.is_empty() {
                        continue;
                    }
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
                        if val.get("type").and_then(|t| t.as_str()) == Some("insight") {
                            if let Some(payload) = val.get("payload") {
                                if let Ok(insight) =
                                    serde_json::from_value::<InsightPayload>(payload.clone())
                                {
                                    collected.push(insight);
                                }
                            }
                        }
                    }
                }

                let _ = app_handle.emit("monitoring:scan_done", ScanDoneEvent {
                    insights: collected,
                });
            }
            Err(e) => {
                let _ = app_handle.emit(
                    "monitoring:scan_error",
                    ScanErrorEvent {
                        message: format!("Failed to run monitoring agent: {e}"),
                    },
                );
            }
        }
    });

    Ok(execution_id)
}

/// Start a recurring background schedule that emits monitoring:tick every `interval_minutes`.
#[tauri::command]
pub async fn schedule_monitoring(
    app: AppHandle,
    interval_minutes: u64,
) -> Result<(), String> {
    use tauri::Emitter;

    let scheduler = get_scheduler().await;
    let mut guard = scheduler.lock().await;

    // Cancel existing task
    if let Some(handle) = guard.take() {
        handle.abort();
    }

    if interval_minutes == 0 {
        return Ok(());
    }

    let app_clone = app.clone();
    let handle = tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(interval_minutes * 60));
        ticker.tick().await; // skip the immediate first tick
        loop {
            ticker.tick().await;
            let next_at = chrono::Utc::now()
                + chrono::Duration::seconds((interval_minutes * 60) as i64);
            let _ = app_clone.emit(
                "monitoring:tick",
                serde_json::json!({ "nextAt": next_at.to_rfc3339() }),
            );
        }
    });

    *guard = Some(handle);
    Ok(())
}

/// Stop the background monitoring schedule.
#[tauri::command]
pub async fn stop_monitoring_schedule(_app: AppHandle) -> Result<(), String> {
    let scheduler = get_scheduler().await;
    let mut guard = scheduler.lock().await;
    if let Some(handle) = guard.take() {
        handle.abort();
    }
    Ok(())
}
