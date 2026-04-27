import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  GitBranch,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  ExternalLink,
  Play,
} from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import { cn } from "../../lib";

interface PipelineRun {
  id: number;
  buildNumber: string;
  status: string;
  result: string | null;
  queueTime: string;
  startTime: string | null;
  finishTime: string | null;
  url: string;
  definition: { id: number; name: string };
  repository: { name: string };
  sourceBranch: string;
  requestedFor: { displayName: string };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function duration(start: string | null, finish: string | null): string | null {
  if (!start || !finish) return null;
  const ms = new Date(finish).getTime() - new Date(start).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

function StatusIcon({
  status,
  result,
}: {
  status: string;
  result: string | null;
}) {
  if (status === "inProgress" || status === "notStarted") {
    return (
      <Loader2
        size={13}
        className="text-[var(--color-info-400)] animate-spin"
      />
    );
  }
  if (result === "succeeded") {
    return (
      <CheckCircle2 size={13} className="text-[var(--color-success-400)]" />
    );
  }
  if (result === "failed" || result === "canceled") {
    return <XCircle size={13} className="text-[var(--color-danger-400)]" />;
  }
  return <Clock size={13} className="text-[var(--color-surface-400)]" />;
}

function resultLabel(status: string, result: string | null): string {
  if (status === "inProgress") return "Running";
  if (status === "notStarted") return "Queued";
  if (result === "succeeded") return "Succeeded";
  if (result === "failed") return "Failed";
  if (result === "canceled") return "Canceled";
  return status;
}

function resultColor(status: string, result: string | null): string {
  if (status === "inProgress" || status === "notStarted")
    return "text-[var(--color-info-400)]";
  if (result === "succeeded") return "text-[var(--color-success-400)]";
  if (result === "failed" || result === "canceled")
    return "text-[var(--color-danger-400)]";
  return "text-[var(--color-surface-400)]";
}

export function WorkflowView() {
  const { tokens, isAuthenticated } = useAuthStore();
  const [org, setOrg] = useState(
    () => localStorage.getItem("cockpit-ado-org") ?? "",
  );
  const [project, setProject] = useState(
    () => localStorage.getItem("cockpit-ado-project") ?? "",
  );
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const accessToken = tokens?.accessToken ?? null;

  const fetchRuns = async () => {
    if (!org || !project || !accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<PipelineRun[]>("get_pipeline_runs", {
        org,
        project,
        accessToken,
      });
      setRuns(result);
      setLastFetched(new Date().toISOString());
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrgChange = (v: string) => {
    setOrg(v);
    localStorage.setItem("cockpit-ado-org", v);
  };

  const handleProjectChange = (v: string) => {
    setProject(v);
    localStorage.setItem("cockpit-ado-project", v);
  };

  // Auto-fetch if org + project are pre-filled
  useEffect(() => {
    if (org && project && accessToken) {
      fetchRuns();
    }
  }, []);

  if (!isAuthenticated || !accessToken) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <GitBranch size={28} className="text-[var(--color-surface-600)]" />
        <p className="text-sm text-[var(--color-surface-400)]">
          Connect your Azure DevOps account to see pipeline runs.
        </p>
        <p className="text-xs text-[var(--color-surface-600)]">
          Go to Settings → Azure DevOps to authenticate.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-surface-700)] shrink-0">
        <div className="flex items-center gap-2">
          <Play size={14} className="text-[var(--color-accent-400)]" />
          <h2 className="text-sm font-semibold text-[var(--color-surface-50)]">
            Workflow
          </h2>
          {runs.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent-600)] text-white font-medium">
              {runs.length}
            </span>
          )}
        </div>
        <button
          onClick={fetchRuns}
          disabled={isLoading || !org || !project}
          className="p-1.5 rounded hover:bg-[var(--color-surface-700)] text-[var(--color-surface-500)] hover:text-[var(--color-surface-200)] transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Org / Project inputs */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-surface-700)] shrink-0 bg-[var(--color-surface-850)]">
        <input
          type="text"
          placeholder="Organization"
          value={org}
          onChange={(e) => handleOrgChange(e.target.value)}
          className="flex-1 text-xs px-2 py-1 rounded bg-[var(--color-surface-700)] border border-[var(--color-surface-600)] text-[var(--color-surface-100)] placeholder-[var(--color-surface-500)] focus:outline-none focus:border-[var(--color-accent-500)]"
        />
        <span className="text-[var(--color-surface-500)] text-xs">/</span>
        <input
          type="text"
          placeholder="Project"
          value={project}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="flex-1 text-xs px-2 py-1 rounded bg-[var(--color-surface-700)] border border-[var(--color-surface-600)] text-[var(--color-surface-100)] placeholder-[var(--color-surface-500)] focus:outline-none focus:border-[var(--color-accent-500)]"
        />
        <button
          onClick={fetchRuns}
          disabled={isLoading || !org || !project}
          className="text-xs px-2.5 py-1 rounded bg-[var(--color-accent-600)] hover:bg-[var(--color-accent-500)] text-white transition-colors disabled:opacity-40"
        >
          Load
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {isLoading && runs.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2
              size={18}
              className="animate-spin text-[var(--color-surface-500)]"
            />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-xs text-red-400">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && !error && runs.length === 0 && org && project && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <Play size={22} className="text-[var(--color-surface-700)]" />
            <p className="text-sm text-[var(--color-surface-500)]">
              No pipeline runs found
            </p>
            {lastFetched && (
              <p className="text-xs text-[var(--color-surface-600)]">
                Last checked {timeAgo(lastFetched)}
              </p>
            )}
          </div>
        )}

        {!org || !project ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <p className="text-xs text-[var(--color-surface-500)]">
              Enter your organization and project above to load pipeline runs.
            </p>
          </div>
        ) : null}

        {runs.map((run) => (
          <RunCard key={run.id} run={run} org={org} project={project} />
        ))}
      </div>

      {lastFetched && (
        <div className="px-4 py-2 border-t border-[var(--color-surface-700)] shrink-0">
          <p className="text-xs text-[var(--color-surface-600)]">
            Last updated {timeAgo(lastFetched)}
          </p>
        </div>
      )}
    </div>
  );
}

function RunCard({
  run,
  org,
  project,
}: {
  run: PipelineRun;
  org: string;
  project: string;
}) {
  const dur = duration(run.startTime, run.finishTime);
  const webUrl = `https://dev.azure.com/${org}/${project}/_build/results?buildId=${run.id}`;

  return (
    <a
      href={webUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block p-3 rounded-lg border transition-colors group",
        "bg-[var(--color-surface-800)] border-[var(--color-surface-700)]",
        "hover:border-[var(--color-surface-500)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <StatusIcon status={run.status} result={run.result} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[var(--color-surface-100)] truncate group-hover:text-[var(--color-surface-50)]">
              {run.definition.name}
            </p>
            <p className="text-[10px] text-[var(--color-surface-500)] mt-0.5 truncate">
              {run.repository.name} ·{" "}
              {run.sourceBranch.replace("refs/heads/", "")}
            </p>
          </div>
        </div>
        <ExternalLink
          size={11}
          className="text-[var(--color-surface-600)] group-hover:text-[var(--color-surface-400)] shrink-0 mt-0.5"
        />
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        <span
          className={cn(
            "text-[10px] font-medium",
            resultColor(run.status, run.result),
          )}
        >
          {resultLabel(run.status, run.result)}
        </span>
        <span className="text-[10px] text-[var(--color-surface-600)]">
          #{run.buildNumber}
        </span>
        {dur && (
          <span className="text-[10px] text-[var(--color-surface-600)]">
            {dur}
          </span>
        )}
        <span className="text-[10px] text-[var(--color-surface-600)] ml-auto">
          {run.queueTime ? timeAgo(run.queueTime) : ""}
        </span>
      </div>
    </a>
  );
}
