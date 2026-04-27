use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PipelineDefinition {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PipelineRepository {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestedFor {
    #[serde(rename = "displayName")]
    pub display_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PipelineRun {
    pub id: i64,
    #[serde(rename = "buildNumber")]
    pub build_number: String,
    pub status: String,
    pub result: Option<String>,
    #[serde(rename = "queueTime")]
    pub queue_time: String,
    #[serde(rename = "startTime")]
    pub start_time: Option<String>,
    #[serde(rename = "finishTime")]
    pub finish_time: Option<String>,
    pub url: String,
    pub definition: PipelineDefinition,
    pub repository: PipelineRepository,
    #[serde(rename = "sourceBranch")]
    pub source_branch: String,
    #[serde(rename = "requestedFor")]
    pub requested_for: RequestedFor,
}

#[derive(Debug, Deserialize)]
struct BuildsResponse {
    value: Vec<PipelineRun>,
}

#[tauri::command]
pub async fn get_pipeline_runs(
    org: String,
    project: String,
    access_token: String,
) -> Result<Vec<PipelineRun>, String> {
    let url = format!(
        "https://dev.azure.com/{}/{}/_apis/build/builds?api-version=7.1&$top=50&queryOrder=queueTimeDescending",
        org, project
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .header("User-Agent", "engineering-cockpit/0.1")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Azure DevOps API error {}: {}", status, body));
    }

    let data: BuildsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data.value)
}
