import { Zap, Terminal } from "lucide-react";
import { nanoid } from "nanoid";
import { useAgentStore } from "../../stores/agent.store";
import type { CommandDefinition } from "../../types/agent.types";

interface CommandBarProps {
  workItemTags: string[];
  workItem: {
    id: string;
    title: string;
    description?: string;
    type: string;
  };
}

export function CommandBar({ workItemTags, workItem }: CommandBarProps) {
  const commands = useAgentStore((s) => s.commands);
  const openPanel = useAgentStore((s) => s.openPanel);
  const openPtySession = useAgentStore((s) => s.openPtySession);
  const setActivePtySession = useAgentStore((s) => s.setActivePtySession);
  const setPendingPtySpawn = useAgentStore((s) => s.setPendingPtySpawn);

  const tagCommands = commands.filter(
    (cmd: CommandDefinition) =>
      Array.isArray(cmd.tagsAction) &&
      cmd.tagsAction.some((tag) => workItemTags.includes(tag)),
  );

  if (tagCommands.length === 0) return null;

  const runCommand = (cmd: CommandDefinition) => {
    const sessionId = nanoid();
    openPtySession(sessionId, cmd.name);
    setActivePtySession(sessionId);
    openPanel();
    setPendingPtySpawn({
      sessionId,
      command: "opencode",
      args: ["--prompt", `/${cmd.name} ${workItem.id}`],
      cwd: null,
      envVars: {
        COCKPIT_WORK_ITEM_ID: workItem.id,
        COCKPIT_WORK_ITEM_TITLE: workItem.title,
        COCKPIT_WORK_ITEM_DESCRIPTION: workItem.description ?? "",
      },
      cols: 120,
      rows: 30,
    });
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-surface-700)] overflow-x-auto shrink-0">
      <span className="flex items-center gap-1.5 text-xs text-[var(--color-surface-400)] shrink-0">
        <Zap size={12} />
        Quick actions
      </span>
      <div className="w-px h-3 bg-[var(--color-surface-600)] shrink-0" />
      {tagCommands.map((cmd: CommandDefinition) => (
        <button
          key={cmd.id}
          onClick={() => runCommand(cmd)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-[var(--color-surface-700)] hover:bg-[var(--color-accent-600)] hover:text-white text-[var(--color-surface-100)] border border-[var(--color-surface-600)] hover:border-[var(--color-accent-500)] transition-colors whitespace-nowrap shrink-0"
          title={cmd.description}
        >
          <Terminal size={12} className="text-[var(--color-surface-400)]" />
          {cmd.name}
        </button>
      ))}
    </div>
  );
}
