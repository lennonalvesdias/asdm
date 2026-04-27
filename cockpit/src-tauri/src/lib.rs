mod commands;

use commands::auth::{start_oauth, refresh_oauth_token, get_azure_user_profile, start_github_device_flow, poll_github_device_token, connect_github_cli};
use commands::agent::{run_agent, cancel_agent};
use commands::registry::{sync_registry, scan_local_registry, load_opencode_commands};
use commands::pty::{spawn_pty, write_pty, resize_pty, kill_pty, get_default_shell};
use commands::github::{get_github_user, get_github_pull_requests_to_review};
use commands::observability::{
    load_insights,
    save_insights,
    start_monitoring_scan,
    schedule_monitoring,
    stop_monitoring_schedule,
};
use commands::workflow::get_pipeline_runs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            start_oauth,
            refresh_oauth_token,
            get_azure_user_profile,
            start_github_device_flow,
            poll_github_device_token,
            connect_github_cli,
            run_agent,
            cancel_agent,
            sync_registry,
            scan_local_registry,
            load_opencode_commands,
            spawn_pty,
            write_pty,
            resize_pty,
            kill_pty,
            get_default_shell,
            get_github_user,
            get_github_pull_requests_to_review,
            load_insights,
            save_insights,
            start_monitoring_scan,
            schedule_monitoring,
            stop_monitoring_schedule,
            get_pipeline_runs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Engineering Cockpit");
}
