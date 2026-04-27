import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore, useBoardStore, useAgentStore } from "../../stores";
import { Sidebar } from "./Sidebar";
import { BottomPanel } from "./BottomPanel";
import { SprintView } from "../../features/board/SprintView";
import { DashboardView } from "../../features/dashboard/DashboardView";
import { SettingsView } from "../../features/settings/SettingsView";
import { ReviewsView } from "../../features/reviews/ReviewsView";
import { ObservabilityView } from "../../features/observability/ObservabilityView";
import { WorkflowView } from "../../features/workflow/WorkflowView";
import { TaskDetailView } from "../../features/task-detail/TaskDetailView";
import { Terminal } from "lucide-react";
import { cn } from "../../lib";

export function AppShell() {
  const {
    isSidebarCollapsed,
    sidebarWidth,
    detailPanelWidth,
    setDetailPanelWidth,
  } = useUiStore();
  const { selectedWorkItemId } = useBoardStore();
  const {
    isPanelOpen,
    panelHeight,
    setPanelHeight,
    openPanel,
    openPtySession,
    setActivePtySession,
    setPendingPtySpawn,
  } = useAgentStore();

  const [defaultShell, setDefaultShell] = useState<{
    command: string;
    args: string[];
  }>({
    command: "/bin/zsh",
    args: ["-l"],
  });

  useEffect(() => {
    invoke<[string, string[]]>("get_default_shell")
      .then(([command, args]) => setDefaultShell({ command, args }))
      .catch(() => {}); // keep fallback on web/mock mode
  }, []);

  // Drag ref for detail panel (horizontal)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: detailPanelWidth };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (moveEvent: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startX - moveEvent.clientX;
        const newWidth = Math.min(
          900,
          Math.max(280, dragRef.current.startWidth + delta),
        );
        setDetailPanelWidth(newWidth);
      };

      const onUp = () => {
        dragRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [detailPanelWidth, setDetailPanelWidth],
  );

  // Drag ref for bottom panel (vertical resize)
  const panelDragRef = useRef<{
    startY: number;
    startHeight: number;
  } | null>(null);

  const handlePanelResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      panelDragRef.current = { startY: e.clientY, startHeight: panelHeight };

      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";

      const onMove = (moveEvent: MouseEvent) => {
        if (!panelDragRef.current) return;
        const delta = panelDragRef.current.startY - moveEvent.clientY;
        const newHeight = Math.min(
          Math.floor(window.innerHeight * 0.8),
          Math.max(150, panelDragRef.current.startHeight + delta),
        );
        setPanelHeight(newHeight);
      };

      const onUp = () => {
        panelDragRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [panelHeight, setPanelHeight],
  );

  const handleOpenTerminal = () => {
    const sessionId = nanoid();
    openPtySession(sessionId);
    setActivePtySession(sessionId);
    openPanel();
    setPendingPtySpawn({
      sessionId,
      command: defaultShell.command,
      args: defaultShell.args,
      cwd: null,
      envVars: {},
      cols: 120,
      rows: 30,
    });
  };

  return (
    <div className="flex h-screen w-screen bg-[var(--color-surface-900)] overflow-hidden">
      {/* Sidebar shell */}
      <div
        className={cn(
          "flex flex-col bg-[var(--color-surface-800)] border-r border-[var(--color-surface-700)] flex-shrink-0 transition-all duration-200",
          isSidebarCollapsed ? "w-12" : undefined,
        )}
        style={!isSidebarCollapsed ? { width: sidebarWidth } : undefined}
      >
        {/* Logo header */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--color-surface-700)] flex-shrink-0">
          <div className="w-6 h-6 rounded bg-[var(--color-accent-600)] flex items-center justify-center flex-shrink-0">
            <Terminal size={12} className="text-white" />
          </div>
          {!isSidebarCollapsed && (
            <span className="text-xs font-bold text-[var(--color-surface-50)] truncate">
              Engineering Cockpit
            </span>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <Sidebar />
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Content row */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <MainView />
          </div>

          {selectedWorkItemId && (
            <>
              <div
                className="relative flex-shrink-0 w-1 cursor-col-resize group z-10"
                onMouseDown={handleDragStart}
              >
                <div className="absolute inset-0 bg-[var(--color-surface-700)] group-hover:bg-[var(--color-accent-500)] transition-colors duration-150" />
                <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
              </div>

              <div
                className="flex-shrink-0 overflow-hidden border-l border-[var(--color-surface-700)]"
                style={{ width: detailPanelWidth }}
              >
                <TaskDetailView />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating terminal button — bottom-right corner */}
      <button
        onClick={handleOpenTerminal}
        className="fixed right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[var(--color-surface-700)] hover:bg-[var(--color-surface-600)] text-[var(--color-surface-200)] hover:text-[var(--color-surface-50)] border border-[var(--color-surface-600)] shadow-lg transition-all duration-200"
        style={{ bottom: isPanelOpen ? panelHeight + 12 : 12 }}
        title="Open terminal"
      >
        <Terminal size={12} />
        Terminal
      </button>

      {/* Bottom panel — resizable overlay */}
      {isPanelOpen && (
        <>
          {/* Resize handle */}
          <div
            className="fixed left-0 right-0 z-50 cursor-row-resize group"
            style={{ bottom: panelHeight, height: 4 }}
            onMouseDown={handlePanelResizeStart}
          >
            <div className="w-full h-full bg-[var(--color-surface-700)] group-hover:bg-[var(--color-accent-500)] transition-colors duration-150" />
          </div>

          {/* Panel */}
          <div
            className="fixed bottom-0 left-0 right-0 z-40"
            style={{ height: panelHeight }}
          >
            <BottomPanel />
          </div>
        </>
      )}
    </div>
  );
}

type ActiveView =
  | "my-tasks"
  | "dashboard"
  | "settings"
  | "workflow"
  | "reviews"
  | "radar";

function MainView() {
  const { activeView } = useUiStore();
  const view = activeView as ActiveView;

  switch (view) {
    case "dashboard":
      return <DashboardView />;
    case "my-tasks":
      return <SprintView filterMyTasks />;
    case "settings":
      return <SettingsView />;
    case "reviews":
      return <ReviewsView />;
    case "workflow":
      return <WorkflowView />;
    case "radar":
      return <ObservabilityView />;
    default:
      return <DashboardView />;
  }
}
