import { useAuthStore, useAgentStore, useUiStore } from "../../stores";
import { Bot, ChevronDown, Settings, PanelBottomOpen } from "lucide-react";
import { cn } from "../../lib";

export function Titlebar() {
  const { user } = useAuthStore();
  const { togglePanel, isPanelOpen } = useAgentStore();
  const { setActiveView } = useUiStore();

  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-[38px] px-3 bg-[var(--color-surface-800)] border-b border-[var(--color-surface-700)] flex-shrink-0 z-10"
    >
      <div className="flex items-center gap-2 mr-4">
        <Bot size={16} className="text-[var(--color-accent-400)]" />
        <span className="text-[var(--color-surface-50)] font-semibold text-xs tracking-wide">
          Cockpit
        </span>
      </div>

      <button className="flex items-center gap-1.5 px-2 py-1 rounded text-[var(--color-surface-200)] hover:text-[var(--color-surface-50)] hover:bg-[var(--color-surface-600)] transition-colors text-xs">
        <span>Engineering</span>
        <ChevronDown size={12} />
      </button>

      <div className="flex-1" />

      <button
        onClick={togglePanel}
        title="Toggle agent terminal"
        className={cn(
          "p-1.5 rounded transition-colors",
          isPanelOpen
            ? "text-[var(--color-accent-400)] bg-[var(--color-surface-600)]"
            : "text-[var(--color-surface-300)] hover:text-[var(--color-surface-100)] hover:bg-[var(--color-surface-600)]"
        )}
      >
        <PanelBottomOpen size={14} />
      </button>

      <button
        onClick={() => setActiveView("settings")}
        className="ml-1 p-1.5 rounded text-[var(--color-surface-300)] hover:text-[var(--color-surface-100)] hover:bg-[var(--color-surface-600)] transition-colors"
        title="Settings"
      >
        <Settings size={14} />
      </button>

      {user && (
        <div className="ml-2 w-6 h-6 rounded-full bg-[var(--color-accent-600)] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
          {user.displayName.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}
