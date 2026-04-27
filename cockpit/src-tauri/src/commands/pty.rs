use dashmap::DashMap;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

struct PtySession {
    master: Arc<Mutex<Box<dyn portable_pty::MasterPty + Send>>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send>>>,
}

// SAFETY: MasterPty and Child are wrapped in Arc<Mutex<>> which provides Sync.
unsafe impl Sync for PtySession {}
unsafe impl Send for PtySession {}

static PTY_SESSIONS: OnceLock<DashMap<String, PtySession>> = OnceLock::new();

fn sessions() -> &'static DashMap<String, PtySession> {
    PTY_SESSIONS.get_or_init(DashMap::new)
}

/// Spawn a new PTY session running the given command.
/// Emits `pty:output:{session_id}` with stdout/stderr data and
/// `pty:exit:{session_id}` with the exit code when the process finishes.
#[tauri::command]
pub async fn spawn_pty(
    app: AppHandle,
    session_id: String,
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
    env_vars: Option<HashMap<String, String>>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let pty_system = NativePtySystem::default();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd = CommandBuilder::new(&command);
    for arg in &args {
        cmd.arg(arg);
    }
    if let Some(dir) = cwd {
        cmd.cwd(dir);
    }
    if let Some(vars) = env_vars {
        for (k, v) in vars {
            cmd.env(k, v);
        }
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

    let master_arc: Arc<Mutex<Box<dyn portable_pty::MasterPty + Send>>> =
        Arc::new(Mutex::new(pair.master));
    let writer_arc: Arc<Mutex<Box<dyn Write + Send>>> = Arc::new(Mutex::new(writer));
    let child_arc: Arc<Mutex<Box<dyn portable_pty::Child + Send>>> =
        Arc::new(Mutex::new(child));

    sessions().insert(
        session_id.clone(),
        PtySession {
            master: master_arc,
            writer: writer_arc,
            child: child_arc.clone(),
        },
    );

    let app_clone = app.clone();
    let sid = session_id.clone();
    tokio::task::spawn_blocking(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    app_clone
                        .emit(&format!("pty:output:{}", sid), data)
                        .ok();
                }
                Err(_) => break,
            }
        }
        let exit_code = {
            let mut child = child_arc.lock().unwrap();
            child
                .wait()
                .ok()
                .and_then(|s| Some(s.exit_code()))
                .unwrap_or(0) as i32
        };
        app_clone
            .emit(&format!("pty:exit:{}", sid), exit_code)
            .ok();
        sessions().remove(&sid);
    });

    Ok(())
}

/// Write data (keystrokes) into an existing PTY session.
#[tauri::command]
pub fn write_pty(session_id: String, data: String) -> Result<(), String> {
    let session = sessions()
        .get(&session_id)
        .ok_or_else(|| format!("PTY session '{}' not found", session_id))?;
    let mut writer = session.writer.lock().unwrap();
    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {}", e))
}

/// Resize an existing PTY session.
#[tauri::command]
pub fn resize_pty(session_id: String, cols: u16, rows: u16) -> Result<(), String> {
    let session = sessions()
        .get(&session_id)
        .ok_or_else(|| format!("PTY session '{}' not found", session_id))?;
    let master = session.master.lock().unwrap();
    master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize PTY: {}", e))
}

/// Kill an existing PTY session.
#[tauri::command]
pub fn kill_pty(session_id: String) -> Result<(), String> {
    let removed = sessions()
        .remove(&session_id)
        .ok_or_else(|| format!("PTY session '{}' not found", session_id))?;
    let mut child = removed.1.child.lock().unwrap();
    child
        .kill()
        .map_err(|e| format!("Failed to kill PTY process: {}", e))
}

/// Returns the OS-appropriate default shell and its launch args.
/// macOS: /bin/zsh [-l]
/// Linux: $SHELL or /bin/bash [-l]
/// Windows: Git Bash if found, otherwise PowerShell
#[tauri::command]
pub fn get_default_shell() -> (String, Vec<String>) {
    #[cfg(target_os = "windows")]
    {
        let candidates = [
            r"C:\Program Files\Git\bin\bash.exe",
            r"C:\Program Files (x86)\Git\bin\bash.exe",
        ];
        for path in &candidates {
            if std::path::Path::new(path).exists() {
                return (path.to_string(), vec!["--login".to_string(), "-i".to_string()]);
            }
        }
        return ("powershell.exe".to_string(), vec![]);
    }
    #[cfg(target_os = "macos")]
    {
        ("/bin/zsh".to_string(), vec!["-l".to_string()])
    }
    #[cfg(target_os = "linux")]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        (shell, vec!["-l".to_string()])
    }
}
