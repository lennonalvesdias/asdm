use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct OAuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: i64,
    pub token_type: String,
    pub scope: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UserProfile {
    pub id: String,
    pub display_name: String,
    pub email: String,
    pub avatar_url: Option<String>,
}

/// Initiates the OAuth 2.0 PKCE flow for Azure DevOps.
/// Opens the system browser for authorization, then captures the callback
/// via a local loopback server.
#[tauri::command]
pub async fn start_oauth(
    app: AppHandle,
    client_id: String,
    tenant_id: String,
    redirect_port: u16,
) -> Result<OAuthTokens, String> {
    use std::collections::HashMap;

    // Generate PKCE code verifier and challenge
    let code_verifier = generate_code_verifier();
    let code_challenge = generate_code_challenge(&code_verifier);

    let state = generate_state();
    let redirect_uri = format!("http://localhost:{}/callback", redirect_port);

    let auth_url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/authorize?\
        client_id={}&\
        response_type=code&\
        redirect_uri={}&\
        response_mode=query&\
        scope=vso.work_write vso.code_read offline_access&\
        state={}&\
        code_challenge={}&\
        code_challenge_method=S256",
        tenant_id,
        client_id,
        urlencoding::encode(&redirect_uri),
        state,
        code_challenge
    );

    // Open browser
    app.opener().open_url(&auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    // Start local HTTP server to receive callback
    let code = receive_oauth_callback(redirect_port, &state).await?;

    // Exchange code for tokens
    let client = reqwest::Client::new();
    let mut params = HashMap::new();
    params.insert("client_id", client_id.as_str());
    params.insert("grant_type", "authorization_code");
    params.insert("code", code.as_str());
    params.insert("redirect_uri", redirect_uri.as_str());
    params.insert("code_verifier", code_verifier.as_str());

    let token_url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
        tenant_id
    );

    let res = client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    if let Some(err) = body.get("error") {
        return Err(format!("Token exchange failed: {}", err));
    }

    let expires_in = body["expires_in"].as_i64().unwrap_or(3600);
    let expires_at =
        chrono::Utc::now().timestamp_millis() + (expires_in * 1000);

    Ok(OAuthTokens {
        access_token: body["access_token"].as_str().unwrap_or("").to_string(),
        refresh_token: body["refresh_token"].as_str().map(String::from),
        expires_at,
        token_type: body["token_type"].as_str().unwrap_or("Bearer").to_string(),
        scope: body["scope"].as_str().unwrap_or("").to_string(),
    })
}

#[tauri::command]
pub async fn refresh_oauth_token(
    client_id: String,
    tenant_id: String,
    refresh_token: String,
    _redirect_port: u16,
) -> Result<OAuthTokens, String> {
    use std::collections::HashMap;

    let client = reqwest::Client::new();
    let mut params = HashMap::new();
    params.insert("client_id", client_id.as_str());
    params.insert("grant_type", "refresh_token");
    params.insert("refresh_token", refresh_token.as_str());
    params.insert("scope", "vso.work_write vso.code_read offline_access");

    let token_url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
        tenant_id
    );

    let res = client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    if let Some(err) = body.get("error") {
        return Err(format!("Token refresh failed: {}", err));
    }

    let expires_in = body["expires_in"].as_i64().unwrap_or(3600);
    let expires_at = chrono::Utc::now().timestamp_millis() + (expires_in * 1000);

    Ok(OAuthTokens {
        access_token: body["access_token"].as_str().unwrap_or("").to_string(),
        refresh_token: body["refresh_token"].as_str().map(String::from),
        expires_at,
        token_type: body["token_type"].as_str().unwrap_or("Bearer").to_string(),
        scope: body["scope"].as_str().unwrap_or("").to_string(),
    })
}

#[tauri::command]
pub async fn get_azure_user_profile(access_token: String) -> Result<UserProfile, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1")
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Profile fetch failed: {}", res.status()));
    }

    let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    Ok(UserProfile {
        id: body["publicAlias"].as_str().unwrap_or("").to_string(),
        display_name: body["displayName"].as_str().unwrap_or("").to_string(),
        email: body["emailAddress"].as_str().unwrap_or("").to_string(),
        avatar_url: None,
    })
}

// ----- PKCE helpers -----

fn generate_code_verifier() -> String {
    use rand::Rng;
    let verifier: String = rand::rng()
        .sample_iter(rand::distr::Alphanumeric)
        .take(128)
        .map(char::from)
        .collect();
    verifier
}

fn generate_code_challenge(verifier: &str) -> String {
    use sha2::{Sha256, Digest};
    use base64::{Engine as _, engine::general_purpose};
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let result = hasher.finalize();
    general_purpose::URL_SAFE_NO_PAD.encode(result)
}

fn generate_state() -> String {
    use rand::Rng;
    rand::rng()
        .sample_iter(rand::distr::Alphanumeric)
        .take(32)
        .map(char::from)
        .collect()
}

async fn receive_oauth_callback(port: u16, expected_state: &str) -> Result<String, String> {
    use tokio::net::TcpListener;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let listener = TcpListener::bind(format!("127.0.0.1:{}", port))
        .await
        .map_err(|e| format!("Failed to bind callback listener: {}", e))?;

    let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;

    let mut buffer = [0u8; 4096];
    let n = stream.read(&mut buffer).await.map_err(|e| e.to_string())?;
    let request = String::from_utf8_lossy(&buffer[..n]);

    // Extract path from "GET /callback?code=...&state=... HTTP/1.1"
    let path = request
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .unwrap_or("");

    let query = path.split('?').nth(1).unwrap_or("");
    let params: std::collections::HashMap<_, _> = query
        .split('&')
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            Some((parts.next()?, parts.next()?))
        })
        .collect();

    // Send HTTP response to browser
    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
        <html><body><h2>Authentication successful!</h2>\
        <p>You can close this tab and return to Engineering Cockpit.</p></body></html>";
    stream.write_all(response.as_bytes()).await.map_err(|e| e.to_string())?;

    let state = params.get("state").copied().unwrap_or("");
    if state != expected_state {
        return Err("OAuth state mismatch — possible CSRF attack".to_string());
    }

    params
        .get("code")
        .map(|c| c.to_string())
        .ok_or_else(|| "No authorization code in callback".to_string())
}

// ----- GitHub Device Flow -----

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GitHubDeviceCode {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

/// Initiates GitHub Device Flow. Returns device_code + user_code for display,
/// and opens the browser to the verification URL automatically.
#[tauri::command]
pub async fn start_github_device_flow(app: AppHandle, client_id: String) -> Result<GitHubDeviceCode, String> {
    let client = reqwest::Client::new();

    let res = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id.as_str()),
            ("scope", "read:user repo"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Device code request failed: {}", res.status()));
    }

    let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    if let Some(err) = body.get("error") {
        return Err(format!("Device code error: {}", err));
    }

    let verification_uri = body["verification_uri"]
        .as_str()
        .unwrap_or("https://github.com/login/device")
        .to_string();

    // Open browser so user can enter the code
    app.opener().open_url(&verification_uri, None::<&str>).ok();

    Ok(GitHubDeviceCode {
        device_code: body["device_code"].as_str().unwrap_or("").to_string(),
        user_code: body["user_code"].as_str().unwrap_or("").to_string(),
        verification_uri,
        expires_in: body["expires_in"].as_u64().unwrap_or(900),
        interval: body["interval"].as_u64().unwrap_or(5),
    })
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GitHubPollResult {
    pub status: String, // "complete" | "pending" | "expired" | "denied"
    pub access_token: Option<String>,
}

/// Polls GitHub for a device token. Call repeatedly until status != "pending".
#[tauri::command]
pub async fn poll_github_device_token(
    client_id: String,
    device_code: String,
) -> Result<GitHubPollResult, String> {
    let client = reqwest::Client::new();

    let res = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id.as_str()),
            ("device_code", device_code.as_str()),
            (
                "grant_type",
                "urn:ietf:params:oauth:grant-type:device_code",
            ),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Poll request failed: {}", res.status()));
    }

    let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    if let Some(access_token) = body["access_token"].as_str() {
        return Ok(GitHubPollResult {
            status: "complete".to_string(),
            access_token: Some(access_token.to_string()),
        });
    }

    let error = body["error"].as_str().unwrap_or("unknown");
    let status = match error {
        "authorization_pending" | "slow_down" => "pending",
        "expired_token" => "expired",
        "access_denied" => "denied",
        _ => "pending",
    };

    Ok(GitHubPollResult {
        status: status.to_string(),
        access_token: None,
    })
}

// ----- GitHub CLI-based authentication -----

/// Authenticates with GitHub using the local `gh` CLI.
/// Runs `gh auth login --web` (opens browser, no client_id needed),
/// then returns the token via `gh auth token`.
#[tauri::command]
pub async fn connect_github_cli() -> Result<String, String> {
    tokio::task::spawn_blocking(|| {
        // 1. Check gh is installed
        std::process::Command::new("gh")
            .arg("--version")
            .output()
            .map_err(|_| {
                "GitHub CLI (gh) não encontrado. Instale em https://cli.github.com".to_string()
            })?;

        // 2. Check if already authenticated
        let status = std::process::Command::new("gh")
            .args(["auth", "status", "--hostname", "github.com"])
            .output()
            .map_err(|e| e.to_string())?;

        if !status.status.success() {
            // 3. Open browser auth — blocks until user completes flow
            let login = std::process::Command::new("gh")
                .args([
                    "auth",
                    "login",
                    "--web",
                    "--hostname",
                    "github.com",
                    "--git-protocol",
                    "https",
                ])
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .output()
                .map_err(|e| e.to_string())?;

            if !login.status.success() {
                let stderr = String::from_utf8_lossy(&login.stderr).to_string();
                return Err(format!("Falha no login GitHub: {}", stderr));
            }
        }

        // 4. Retrieve token
        let token_out = std::process::Command::new("gh")
            .args(["auth", "token", "--hostname", "github.com"])
            .output()
            .map_err(|e| e.to_string())?;

        if token_out.status.success() {
            let token = String::from_utf8_lossy(&token_out.stdout)
                .trim()
                .to_string();
            if token.is_empty() {
                Err("Nenhum token retornado pelo gh".to_string())
            } else {
                Ok(token)
            }
        } else {
            Err(String::from_utf8_lossy(&token_out.stderr)
                .trim()
                .to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
