import { useAgentStore } from "../../stores";
import { cn } from "../../lib";
import { X, Bot, Search, Play, Tag } from "lucide-react";
import { useState, useMemo } from "react";
import type { WorkItem, AgentDefinition, AgentContext } from "../../types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { nanoid } from "nanoid";

interface AgentPickerModalProps {
  workItem: WorkItem;
  onClose: () => void;
}

export function AgentPickerModal({ workItem, onClose }: AgentPickerModalProps) {
  const { agents, startExecution, appendLog, finishExecution, openPanel } = useAgentStore();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AgentDefinition | null>(null);
  const [repoPath, setRepoPath] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [agents, search]);

  const handleRun = async () => {
    if (!selected) return;
    setIsLaunching(true);

    const executionId = nanoid();
    const context: AgentContext = {
      workItemId: workItem.id,
      workItemTitle: workItem.title,
      workItemDescription: workItem.description,
      workItemType: workItem.type,
      repoPath: repoPath || undefined,
    };

    startExecution({
      id: executionId,
      agentId: selected.id,
      agentName: selected.name,
      workItemId: workItem.id,
      status: "running",
      startedAt: new Date().toISOString(),
      logs: [],
      context,
    });

    openPanel();
    onClose();

    // Listen for streamed logs
    const unlistenLog = await listen<{ timestamp: string; logType: string; content: string }>(
      `agent:log:${executionId}`,
      (event) => {
        appendLog(executionId, {
          timestamp: event.payload.timestamp,
          type: event.payload.logType as "stdout" | "stderr" | "system",
          content: event.payload.content,
        });
      }
    );

    try {
      const exitCode = await invoke<number>("run_agent", {
        executionId,
        command: selected.command,
        args: selected.args ?? [],
        context: {
          work_item_id: context.workItemId,
          work_item_title: context.workItemTitle,
          work_item_description: context.workItemDescription,
          work_item_type: context.workItemType,
          repo_path: context.repoPath,
          branch: context.branch,
          additional_context: context.additionalContext,
          skills: context.skills,
        },
        workingDir: repoPath || null,
      });
      finishExecution(executionId, exitCode);
    } catch (err) {
      finishExecution(executionId, 1);
    } finally {
      unlistenLog();
      setIsLaunching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--color-surface-800)] border border-[var(--color-surface-600)] rounded-[var(--radius-lg)] w-[480px] max-h-[600px] flex flex-col shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-surface-700)]">
          <Bot size={15} className="text-[var(--color-accent-400)]" />
          <div className="flex-1">
            <div className="text-xs font-semibold text-[var(--color-surface-50)]">Run Agent</div>
            <div className="text-[10px] text-[var(--color-surface-400)] truncate">
              on: #{workItem.id} {workItem.title}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--color-surface-400)] hover:text-[var(--color-surface-100)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-[var(--color-surface-700)]">
          <div className="flex items-center gap-2 bg-[var(--color-surface-700)] rounded px-2.5 py-1.5">
            <Search size={12} className="text-[var(--color-surface-400)]" />
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="bg-transparent text-xs text-[var(--color-surface-100)] placeholder:text-[var(--color-surface-400)] outline-none flex-1"
            />
          </div>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="text-center text-xs text-[var(--color-surface-400)] py-8">
              No agents found.{" "}
              <span className="text-[var(--color-accent-400)]">
                Configure a registry in Settings.
              </span>
            </div>
          ) : (
            filtered.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelected(agent)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors border-b border-[var(--color-surface-700)]/40",
                  selected?.id === agent.id
                    ? "bg-[var(--color-accent-600)]/20 border-l-2 border-l-[var(--color-accent-400)]"
                    : "hover:bg-[var(--color-surface-700)]"
                )}
              >
                <div className="w-7 h-7 rounded bg-[var(--color-surface-600)] flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-[var(--color-accent-400)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[var(--color-surface-100)]">
                    {agent.name}
                  </div>
                  <div className="text-[10px] text-[var(--color-surface-400)] mt-0.5 line-clamp-2">
                    {agent.description}
                  </div>
                  {agent.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Tag size={9} className="text-[var(--color-surface-500)]" />
                      {agent.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] text-[var(--color-surface-400)] bg-[var(--color-surface-600)] px-1.5 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer: repo path + run */}
        {selected && (
          <div className="border-t border-[var(--color-surface-700)] p-4 space-y-3">
            <div>
              <label className="text-[10px] text-[var(--color-surface-400)] uppercase tracking-widest block mb-1">
                Repo path (optional)
              </label>
              <input
                type="text"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                placeholder="/Users/you/projects/my-repo"
                className="w-full bg-[var(--color-surface-700)] text-xs text-[var(--color-surface-100)] placeholder:text-[var(--color-surface-500)] border border-[var(--color-surface-600)] rounded px-2.5 py-1.5 outline-none focus:border-[var(--color-accent-500)] transition-colors"
              />
            </div>
            <button
              onClick={handleRun}
              disabled={isLaunching}
              className="w-full flex items-center justify-center gap-2 py-2 bg-[var(--color-accent-600)] hover:bg-[var(--color-accent-500)] disabled:opacity-50 rounded text-xs font-medium text-white transition-colors"
            >
              <Play size={12} />
              {isLaunching ? "Launching..." : `Run ${selected.name}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
