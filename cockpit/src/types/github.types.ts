export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft: boolean | null;
  created_at: string;
  updated_at: string;
  user: GitHubUser;
  repository_url: string;
  repo_full_name: string | null;
}
