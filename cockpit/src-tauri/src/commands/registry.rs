use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::process::Command;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RegistryInfo {
    pub id: String,
    pub name: String,
    pub git_url: String,
    pub branch: String,
    pub local_path: String,
    pub last_sync_at: Option<String>,
    pub agents: Vec<AgentEntry>,
    pub skills: Vec<SkillEntry>,
    pub commands: Vec<CommandEntry>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AgentEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub file_path: String,
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SkillEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub file_path: String,
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommandEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub file_path: String,
    pub tags: Vec<String>,
    pub tags_action: Vec<String>,
}

/// Nested metadata block in frontmatter.
#[derive(Deserialize, Default)]
struct CommandMeta {
    #[serde(default, rename = "tags-action")]
    tags_action: Vec<String>,
}

/// YAML frontmatter parsed from a command's `.md` file.
#[derive(Deserialize, Default)]
struct CommandFrontmatter {
    #[serde(default)]
    description: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    metadata: CommandMeta,
}

/// Extract YAML frontmatter from markdown content.
/// Returns `None` if no valid `---` delimited block is found.
fn parse_frontmatter(content: &str) -> Option<CommandFrontmatter> {
    let content = content.trim_start();
    if !content.starts_with("---") {
        return None;
    }
    let rest = &content[3..]; // skip opening ---
    // skip optional \r\n or \n after opening ---
    let rest = rest.trim_start_matches('\r').trim_start_matches('\n');
    // Find the closing ---
    let end = rest.find("\n---")?;
    let yaml_str = &rest[..end];
    serde_yaml::from_str::<CommandFrontmatter>(yaml_str).ok()
}

/// Loads commands from the local OpenCode config directory (~/.config/opencode/commands/).
/// Scans flat .md files (not subdirectories).
#[tauri::command]
pub fn load_opencode_commands() -> Result<Vec<CommandEntry>, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())?;

    let commands_dir = PathBuf::from(home)
        .join(".config")
        .join("opencode")
        .join("commands");

    Ok(scan_flat_commands(&commands_dir))
}

/// Scans a directory for flat .md command files (not subdirectories).
fn scan_flat_commands(dir: &PathBuf) -> Vec<CommandEntry> {
    let mut entries = vec![];
    let Ok(read) = std::fs::read_dir(dir) else {
        return entries;
    };

    for entry in read.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext != "md" {
            continue;
        }
        let name = path
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        if name.is_empty() {
            continue;
        }

        let content = std::fs::read_to_string(&path).unwrap_or_default();

        let (description, tags_action, mut tags) =
            if let Some(fm) = parse_frontmatter(&content) {
                let desc = if fm.description.is_empty() {
                    // Fall back to first non-empty non-comment line after frontmatter
                    content
                        .lines()
                        .skip_while(|l| {
                            l.trim() == "---"
                                || l.trim().starts_with('#')
                                || l.trim().is_empty()
                        })
                        .find(|l| !l.trim().is_empty() && !l.starts_with('#'))
                        .unwrap_or("")
                        .trim()
                        .to_string()
                } else {
                    fm.description
                };
                (desc, fm.metadata.tags_action, fm.tags)
            } else {
                let desc = content
                    .lines()
                    .find(|l| !l.trim().is_empty() && !l.starts_with('#'))
                    .unwrap_or("")
                    .trim()
                    .to_string();
                (desc, vec![], vec![])
            };

        tags.push("command".to_string());

        entries.push(CommandEntry {
            id: name.clone(),
            name: name.clone(),
            description,
        file_path: path.to_string_lossy().into_owned(),
        tags,
        tags_action,
        });
    }
    entries
}

/// Clones or pulls a Git registry to local app data dir.
#[tauri::command]
pub async fn sync_registry(
    registry_id: String,
    git_url: String,
    branch: String,
    app_data_dir: String,
) -> Result<RegistryInfo, String> {
    let local_path = PathBuf::from(&app_data_dir)
        .join("registries")
        .join(&registry_id);

    let local_path_str = local_path.to_string_lossy().into_owned();

    if local_path.exists() {
        let output = Command::new("git")
            .args(["pull", "origin", &branch])
            .current_dir(&local_path)
            .output()
            .await
            .map_err(|e| format!("git pull failed: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "git pull error: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
    } else {
        std::fs::create_dir_all(&local_path)
            .map_err(|e| format!("Failed to create registry dir: {}", e))?;

        let output = Command::new("git")
            .args([
                "clone",
                "--branch",
                &branch,
                "--depth",
                "1",
                &git_url,
                &local_path_str,
            ])
            .output()
            .await
            .map_err(|e| format!("git clone failed: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "git clone error: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
    }

    let registry = scan_registry(&registry_id, &git_url, &branch, &local_path)?;
    Ok(registry)
}

/// Scans a local registry directory for agents, skills and commands.
#[tauri::command]
pub fn scan_local_registry(
    registry_id: String,
    git_url: String,
    branch: String,
    local_path: String,
) -> Result<RegistryInfo, String> {
    let path = PathBuf::from(&local_path);
    scan_registry(&registry_id, &git_url, &branch, &path)
}

fn scan_registry(
    registry_id: &str,
    git_url: &str,
    branch: &str,
    local_path: &PathBuf,
) -> Result<RegistryInfo, String> {
    let opencode_dir = local_path.join(".opencode");

    let agents = scan_dir(&opencode_dir.join("agents"), "agents");
    let skills = scan_dir_skills(&opencode_dir.join("skills"));
    let commands = scan_dir_commands(&opencode_dir.join("commands"));

    Ok(RegistryInfo {
        id: registry_id.to_string(),
        name: local_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(registry_id)
            .to_string(),
        git_url: git_url.to_string(),
        branch: branch.to_string(),
        local_path: local_path.to_string_lossy().into_owned(),
        last_sync_at: Some(chrono::Utc::now().to_rfc3339()),
        agents,
        skills,
        commands,
    })
}

fn scan_dir(dir: &PathBuf, kind: &str) -> Vec<AgentEntry> {
    let mut entries = vec![];
    let Ok(read) = std::fs::read_dir(dir) else {
        return entries;
    };

    for entry in read.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let md_path = path.join(format!("{}.md", name.to_uppercase()));
            let description = std::fs::read_to_string(&md_path)
                .unwrap_or_default()
                .lines()
                .find(|l| !l.trim().is_empty() && !l.starts_with('#'))
                .unwrap_or("")
                .trim()
                .to_string();

            entries.push(AgentEntry {
                id: name.clone(),
                name: name.clone(),
                description,
                file_path: path.to_string_lossy().into_owned(),
                tags: vec![kind.to_string()],
            });
        }
    }
    entries
}

fn scan_dir_skills(dir: &PathBuf) -> Vec<SkillEntry> {
    let mut entries = vec![];
    let Ok(read) = std::fs::read_dir(dir) else {
        return entries;
    };

    for entry in read.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let skill_file = path.join("SKILL.md");
            let description = std::fs::read_to_string(&skill_file)
                .unwrap_or_default()
                .lines()
                .find(|l| !l.trim().is_empty() && !l.starts_with('#'))
                .unwrap_or("")
                .trim()
                .to_string();

            entries.push(SkillEntry {
                id: name.clone(),
                name: name.clone(),
                description,
                file_path: skill_file.to_string_lossy().into_owned(),
                tags: vec!["skill".to_string()],
            });
        }
    }
    entries
}

fn scan_dir_commands(dir: &PathBuf) -> Vec<CommandEntry> {
    let mut entries = vec![];
    let Ok(read) = std::fs::read_dir(dir) else {
        return entries;
    };

    for entry in read.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let md_path = path.join(format!("{}.md", name.to_uppercase()));
            let content = std::fs::read_to_string(&md_path).unwrap_or_default();

            let (description, tags_action, mut tags) =
                if let Some(fm) = parse_frontmatter(&content) {
                    let desc = if fm.description.is_empty() {
                        content
                            .lines()
                            .skip_while(|l| {
                                l.trim() == "---"
                                    || l.trim().starts_with('#')
                                    || l.trim().is_empty()
                            })
                            .find(|l| !l.trim().is_empty() && !l.starts_with('#'))
                            .unwrap_or("")
                            .trim()
                            .to_string()
                    } else {
                        fm.description
                    };
                    (desc, fm.metadata.tags_action, fm.tags)
                } else {
                    let desc = content
                        .lines()
                        .find(|l| !l.trim().is_empty() && !l.starts_with('#'))
                        .unwrap_or("")
                        .trim()
                        .to_string();
                    (desc, vec![], vec![])
                };

            tags.push("command".to_string());

            entries.push(CommandEntry {
                id: name.clone(),
                name: name.clone(),
                description,
                file_path: path.to_string_lossy().into_owned(),
                tags,
                tags_action,
            });
        }
    }
    entries
}
