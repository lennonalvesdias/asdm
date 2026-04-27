import { nanoid } from "nanoid";
import { useBoardStore, useAgentStore } from "../../stores";
import { StatusBadge, TypeBadge, PriorityBadge } from "../../components/ui";

import {
  ArrowLeft,
  ChevronRight,
  Terminal,
  Search,
  Play,
  Clock,
  Tag,
  User,
  BookOpen,
} from "lucide-react";
import { useState } from "react";
import type { WorkItemTransition } from "../../types";
import type { CommandDefinition } from "../../types";
import { CommandBar } from "./CommandBar";

export function TaskDetailView() {
  const {
    workItems,
    selectedWorkItemId,
    selectWorkItem,
    updateWorkItemStatus,
  } = useBoardStore();
  const {
    openPanel,
    openPtySession,
    setActivePtySession,
    commands,
    setPendingPtySpawn,
  } = useAgentStore();
  const [commandSearch, setCommandSearch] = useState("");
  const [runningCommands, setRunningCommands] = useState<Set<string>>(
    new Set(),
  );

  const item = workItems.find((wi) => wi.id === selectedWorkItemId);

  if (!item) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-surface-400)] text-xs">
        Work item not found.
      </div>
    );
  }

  const runCommand = (cmd: CommandDefinition) => {
    const sessionId = nanoid();
    openPtySession(sessionId, cmd.name);
    setActivePtySession(sessionId);
    openPanel();

    setRunningCommands((prev) => new Set(prev).add(cmd.id));
    setPendingPtySpawn({
      sessionId,
      command: "opencode",
      args: ["--prompt", `/${cmd.name} ${String(item.id)}`],
      cwd: null,
      envVars: {
        COCKPIT_WORK_ITEM_ID: String(item.id),
        COCKPIT_WORK_ITEM_TITLE: item.title,
        COCKPIT_WORK_ITEM_DESCRIPTION: item.description ?? "",
      },
      cols: 120,
      rows: 30,
    });

    // Clear running state after a brief moment
    setTimeout(() => {
      setRunningCommands((prev) => {
        const next = new Set(prev);
        next.delete(cmd.id);
        return next;
      });
    }, 1000);
  };

  const availableCommands = commands.filter(
    (cmd) =>
      Array.isArray(cmd.tagsAction) &&
      cmd.tagsAction.length > 0 &&
      cmd.tagsAction.some((tag) => item.tags.includes(tag)),
  );

  const filteredCommands = availableCommands.filter((cmd) => {
    if (!commandSearch) return true;
    const q = commandSearch.toLowerCase();
    return (
      cmd.name.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-surface-700)] bg-[var(--color-surface-800)] flex-shrink-0">
        <button
          onClick={() => selectWorkItem(null)}
          className="p-1 rounded text-[var(--color-surface-400)] hover:text-[var(--color-surface-100)] hover:bg-[var(--color-surface-600)] transition-colors"
          title="Back to list"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <TypeBadge type={item.type} />
          <span className="text-[10px] text-[var(--color-surface-400)]">
            #{item.id}
          </span>
          <span className="text-xs text-[var(--color-surface-100)] truncate font-medium ml-1">
            {item.title}
          </span>
        </div>
      </div>

      {/* Tag-based command bar */}
      <CommandBar
        workItemTags={item.tags}
        workItem={{
          id: String(item.id),
          title: item.title,
          description: item.description,
          type: item.type,
        }}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Title + status */}
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-[var(--color-surface-50)] leading-snug mb-2">
            {item.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <PriorityBadge priority={item.priority} />
            {item.storyPoints && (
              <span className="text-[10px] text-[var(--color-surface-400)] bg-[var(--color-surface-600)] px-1.5 py-0.5 rounded">
                {item.storyPoints} pts
              </span>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <MetaField label="Assignee" icon={User}>
            {item.assignee ? (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-[var(--color-accent-600)] flex items-center justify-center text-[8px] font-bold text-white">
                  {item.assignee.displayName.charAt(0)}
                </div>
                <span className="text-xs text-[var(--color-surface-100)] truncate">
                  {item.assignee.displayName}
                </span>
              </div>
            ) : (
              <span className="text-xs text-[var(--color-surface-400)]">
                Unassigned
              </span>
            )}
          </MetaField>

          <MetaField label="Iteration" icon={Clock}>
            <span className="text-xs text-[var(--color-surface-100)]">
              {item.iteration?.name ?? "–"}
            </span>
          </MetaField>

          <MetaField label="Updated" icon={Clock}>
            <span className="text-xs text-[var(--color-surface-100)]">
              {new Date(item.updatedAt).toLocaleDateString()}
            </span>
          </MetaField>

          <MetaField label="Tags" icon={Tag}>
            {item.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] bg-[var(--color-surface-600)] text-[var(--color-surface-200)] px-1.5 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-[var(--color-surface-400)]">–</span>
            )}
          </MetaField>
        </div>

        {/* Description */}
        {item.description && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <BookOpen size={12} className="text-[var(--color-surface-400)]" />
              <span className="text-[10px] uppercase tracking-widest text-[var(--color-surface-400)]">
                Description
              </span>
            </div>
            <div
              className="text-xs text-[var(--color-surface-200)] leading-relaxed bg-[var(--color-surface-700)] rounded p-3"
              dangerouslySetInnerHTML={{ __html: item.description }}
            />
          </div>
        )}

        {/* Available transitions */}
        {item.availableTransitions.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-surface-400)] mb-2">
              Transitions
            </div>
            <div className="flex flex-wrap gap-2">
              {item.availableTransitions.map((t) => (
                <TransitionButton
                  key={t.to}
                  transition={t}
                  onApply={() => updateWorkItemStatus(item.id, t.to)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Commands */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-surface-300)] uppercase tracking-wider mb-2">
            <Terminal size={14} />
            <span>Commands</span>
            <span className="ml-auto text-[var(--color-surface-400)] font-mono">
              {availableCommands.length}
            </span>
          </div>

          <div className="relative flex items-center">
            <Search
              size={12}
              className="absolute left-2.5 text-[var(--color-surface-400)]"
            />
            <input
              type="text"
              placeholder="Search commands…"
              value={commandSearch}
              onChange={(e) => setCommandSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-[var(--color-surface-700)] border border-[var(--color-surface-600)] rounded text-[var(--color-surface-50)] placeholder:text-[var(--color-surface-400)] focus:outline-none focus:border-[var(--color-accent-500)] transition-colors"
            />
          </div>

          {filteredCommands.length === 0 ? (
            <div className="text-xs text-[var(--color-surface-400)] py-4 text-center">
              {availableCommands.length === 0
                ? "No commands loaded. Commands are loaded from ~/.config/opencode/commands."
                : "No commands match your search."}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredCommands.map((cmd) => {
                const isRunning = runningCommands.has(cmd.id);
                return (
                  <div
                    key={cmd.id}
                    className="flex items-start gap-2 p-2.5 rounded bg-[var(--color-surface-700)] border border-[var(--color-surface-600)] hover:border-[var(--color-surface-400)] hover:bg-[var(--color-surface-600)] transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-[var(--color-surface-50)] mb-0.5">
                        <Terminal size={12} />
                        <span>{cmd.name}</span>
                      </div>
                      <p className="text-xs text-[var(--color-surface-200)] leading-relaxed mb-1.5">
                        {cmd.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {cmd.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-800)] border border-[var(--color-surface-600)] text-[var(--color-surface-400)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--color-accent-600)] text-white hover:bg-[var(--color-accent-500)] disabled:opacity-50 disabled:cursor-not-allowed transition-all ${isRunning ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      onClick={() => runCommand(cmd)}
                      disabled={isRunning}
                      title={isRunning ? "Running…" : `Run ${cmd.name}`}
                    >
                      <Play size={12} />
                      <span>{isRunning ? "Running" : "Run"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components ----

interface MetaFieldProps {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}

function MetaField({ label, icon: Icon, children }: MetaFieldProps) {
  return (
    <div className="bg-[var(--color-surface-700)] rounded p-2.5">
      <div className="flex items-center gap-1 mb-1">
        <Icon size={10} className="text-[var(--color-surface-400)]" />
        <span className="text-[9px] uppercase tracking-widest text-[var(--color-surface-400)]">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

interface TransitionButtonProps {
  transition: WorkItemTransition;
  onApply: () => void;
}

function TransitionButton({ transition, onApply }: TransitionButtonProps) {
  return (
    <button
      onClick={onApply}
      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--color-surface-700)] hover:bg-[var(--color-accent-600)] border border-[var(--color-surface-500)] hover:border-[var(--color-accent-500)] rounded text-xs text-[var(--color-surface-100)] transition-colors"
    >
      <ChevronRight size={11} className="text-[var(--color-accent-400)]" />
      {transition.label}
    </button>
  );
}
