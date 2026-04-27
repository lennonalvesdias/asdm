import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  GitPullRequest,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useGitHubStore } from "../../stores/github.store";
import type { GitHubPullRequest } from "../../types/github.types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function PrCard({ pr }: { pr: GitHubPullRequest }) {
  return (
    <a
      href={pr.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-600 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-100 truncate group-hover:text-white">
            {pr.title}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {pr.repo_full_name ?? pr.repository_url} #{pr.number}
          </p>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-400 shrink-0 mt-0.5" />
      </div>
      <div className="flex items-center gap-3 mt-2">
        <span className="flex items-center gap-1 text-xs text-neutral-500">
          <img
            src={pr.user.avatar_url}
            alt={pr.user.login}
            className="w-3.5 h-3.5 rounded-full"
          />
          {pr.user.login}
        </span>
        <span className="text-xs text-neutral-600">
          {timeAgo(pr.updated_at)}
        </span>
        {pr.draft && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
            Draft
          </span>
        )}
      </div>
    </a>
  );
}

export function ReviewsView() {
  const pat = useGitHubStore((s) => s.pat);
  const accessToken = useGitHubStore((s) => s.accessToken);
  const prs = useGitHubStore((s) => s.pullRequestsToReview);
  const isLoading = useGitHubStore((s) => s.isLoading);
  const error = useGitHubStore((s) => s.error);
  const lastFetchedAt = useGitHubStore((s) => s.lastFetchedAt);
  const setPullRequestsToReview = useGitHubStore(
    (s) => s.setPullRequestsToReview,
  );
  const setLoading = useGitHubStore((s) => s.setLoading);
  const setError = useGitHubStore((s) => s.setError);

  // Use PAT if available, fall back to OAuth/CLI access token
  const token = pat ?? accessToken;

  const fetchPRs = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<GitHubPullRequest[]>(
        "get_github_pull_requests_to_review",
        { pat: token },
      );
      setPullRequestsToReview(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount if token is available
  useEffect(() => {
    if (token && prs.length === 0 && !lastFetchedAt) {
      fetchPRs();
    }
  }, [token]);

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <GitPullRequest className="w-8 h-8 text-neutral-600" />
        <p className="text-sm text-neutral-400">
          Connect your GitHub account to see pull requests awaiting your review.
        </p>
        <p className="text-xs text-neutral-600">
          Go to Settings → GitHub to connect via CLI or add a PAT.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-2">
          <GitPullRequest className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-100">PR Reviews</h2>
          {prs.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">
              {prs.length}
            </span>
          )}
        </div>
        <button
          onClick={fetchPRs}
          disabled={isLoading}
          className="p-1.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && prs.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-600" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && !error && prs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <GitPullRequest className="w-6 h-6 text-neutral-700" />
            <p className="text-sm text-neutral-500">
              No PRs waiting for your review
            </p>
            {lastFetchedAt && (
              <p className="text-xs text-neutral-700">
                Last checked {timeAgo(lastFetchedAt)}
              </p>
            )}
          </div>
        )}

        {prs.map((pr) => (
          <PrCard key={pr.id} pr={pr} />
        ))}
      </div>

      {lastFetchedAt && prs.length > 0 && (
        <div className="px-4 py-2 border-t border-neutral-800 shrink-0">
          <p className="text-xs text-neutral-700">
            Last updated {timeAgo(lastFetchedAt)}
          </p>
        </div>
      )}
    </div>
  );
}
