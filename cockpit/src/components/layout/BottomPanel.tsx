import { nanoid } from "nanoid";
import { X, Plus, TerminalSquare } from "lucide-react";
import { useAgentStore } from "../../stores";
import { PtyTerminal } from "../terminal/PtyTerminal";
import { cn } from "../../lib/cn";

export function BottomPanel() {
  const {
    ptySessions,
    activePtySessionId,
    setActivePtySession,
    closePtySession,
    closePanel,
    openPtySession,
    setPendingPtySpawn,
  } = useAgentStore();

  const sessions = Object.values(ptySessions);

  const handleNewTerminal = () => {
    const sessionId = nanoid();
    openPtySession(sessionId);
    setActivePtySession(sessionId);
    setPendingPtySpawn({
      sessionId,
      command: "/bin/zsh",
      args: ["-l"],
      cwd: null,
      envVars: {},
      cols: 120,
      rows: 30,
    });
  };

  const handleCloseSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = sessions.filter((s) => s.sessionId !== sessionId);
    if (activePtySessionId === sessionId) {
      if (remaining.length > 0) {
        setActivePtySession(remaining[remaining.length - 1].sessionId);
      } else {
        closePanel();
      }
    }
    closePtySession(sessionId);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-900)] border-t border-[var(--color-surface-700)]">
      {/* Tab bar */}
      <div className="flex items-center h-8 border-b border-[var(--color-surface-700)] bg-[var(--color-surface-800)] flex-shrink-0 overflow-x-auto">
        {sessions.map((session) => (
          <button
            key={session.sessionId}
            onClick={() => setActivePtySession(session.sessionId)}
            className={cn(
              "flex items-center gap-1.5 px-3 h-full text-[11px] border-r border-[var(--color-surface-700)] whitespace-nowrap flex-shrink-0 transition-colors",
              session.sessionId === activePtySessionId
                ? "bg-[var(--color-surface-900)] text-[var(--color-surface-100)]"
                : "text-[var(--color-surface-400)] hover:text-[var(--color-surface-200)] hover:bg-[var(--color-surface-700)]",
            )}
          >
            <TerminalSquare size={11} className="flex-shrink-0" />
            <span className="max-w-[120px] truncate">{session.title}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => handleCloseSession(session.sessionId, e)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  handleCloseSession(
                    session.sessionId,
                    e as unknown as React.MouseEvent,
                  );
              }}
              className="ml-1 p-0.5 rounded hover:bg-[var(--color-surface-600)] text-[var(--color-surface-500)] hover:text-[var(--color-surface-200)] transition-colors"
            >
              <X size={10} />
            </span>
          </button>
        ))}

        {/* New terminal */}
        <button
          onClick={handleNewTerminal}
          className="flex items-center justify-center w-7 h-full text-[var(--color-surface-400)] hover:text-[var(--color-surface-100)] hover:bg-[var(--color-surface-700)] transition-colors flex-shrink-0 border-r border-[var(--color-surface-700)]"
          title="New terminal"
        >
          <Plus size={13} />
        </button>

        <div className="flex-1" />

        {/* Close panel */}
        <button
          onClick={closePanel}
          className="flex items-center justify-center w-7 h-full text-[var(--color-surface-400)] hover:text-[var(--color-surface-100)] hover:bg-[var(--color-surface-700)] transition-colors flex-shrink-0"
          title="Close panel"
        >
          <X size={13} />
        </button>
      </div>

      {/* Terminal content — all sessions mounted, only active visible */}
      <div className="flex-1 overflow-hidden relative">
        {sessions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-[var(--color-surface-500)]">
            No terminal sessions open
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.sessionId}
              className={cn(
                "absolute inset-0",
                session.sessionId === activePtySessionId
                  ? "opacity-100 pointer-events-auto z-10"
                  : "opacity-0 pointer-events-none z-0",
              )}
            >
              <PtyTerminal sessionId={session.sessionId} className="h-full" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
