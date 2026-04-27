use reqwest::header::{AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GitHubUser {
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
    pub html_url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GitHubPullRequest {
    pub id: u64,
    pub number: u64,
    pub title: String,
    pub html_url: String,
    pub state: String,
    pub draft: Option<bool>,
    pub created_at: String,
    pub updated_at: String,
    pub user: GitHubUser,
    pub repository_url: String,
    /// Derived field: owner/repo extracted from repository_url
    pub repo_full_name: Option<String>,
}

#[derive(Deserialize, Debug)]
struct SearchItem {
    id: u64,
    number: u64,
    title: String,
    html_url: String,
    state: String,
    draft: Option<bool>,
    created_at: String,
    updated_at: String,
    user: GitHubUser,
    repository_url: String,
}

#[derive(Deserialize, Debug)]
struct SearchResponse {
    items: Vec<SearchItem>,
}

/// Returns basic profile info for the authenticated GitHub user.
#[tauri::command]
pub async fn get_github_user(pat: String) -> Result<GitHubUser, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.github.com/user")
        .header(AUTHORIZATION, format!("Bearer {}", pat))
        .header(USER_AGENT, "engineering-cockpit/0.1")
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API error {}: {}", status, body));
    }

    resp.json::<GitHubUser>()
        .await
        .map_err(|e| format!("Failed to parse GitHub user: {}", e))
}

/// Returns open pull requests that are waiting for the authenticated user's review.
#[tauri::command]
pub async fn get_github_pull_requests_to_review(
    pat: String,
) -> Result<Vec<GitHubPullRequest>, String> {
    let client = reqwest::Client::new();
    let url =
        "https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=50";

    let resp = client
        .get(url)
        .header(AUTHORIZATION, format!("Bearer {}", pat))
        .header(USER_AGENT, "engineering-cockpit/0.1")
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API error {}: {}", status, body));
    }

    let search: SearchResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub search response: {}", e))?;

    let prs = search
        .items
        .into_iter()
        .map(|item| {
            // Extract owner/repo from repository_url
            // e.g. https://api.github.com/repos/owner/repo -> owner/repo
            let repo_full_name = item
                .repository_url
                .strip_prefix("https://api.github.com/repos/")
                .map(|s| s.to_string());

            GitHubPullRequest {
                id: item.id,
                number: item.number,
                title: item.title,
                html_url: item.html_url,
                state: item.state,
                draft: item.draft,
                created_at: item.created_at,
                updated_at: item.updated_at,
                user: item.user,
                repository_url: item.repository_url,
                repo_full_name,
            }
        })
        .collect();

    Ok(prs)
}
