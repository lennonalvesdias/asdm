import { useUiStore, useBoardStore } from "../../stores";
import { useGitHubStore } from "../../stores/github.store";
import { useObservabilityStore } from "../../stores/observability.store";
import {
  LayoutDashboard,
  ListTodo,
  Workflow,
  ChevronLeft,
  ChevronRight,
  GitPullRequest,
  Radar,
  Settings,
} from "lucide-react";
import { cn } from "../../lib";

type ViewId =
  | "my-tasks"
  | "dashboard"
  | "settings"
  | "workflow"
  | "reviews"
  | "radar";

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: "my-tasks", label: "My Tasks", icon: ListTodo },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "workflow", label: "Workflow", icon: Workflow },
  { id: "reviews", label: "Reviews", icon: GitPullRequest },
  { id: "radar", label: "Radar", icon: Radar },
];

export function Sidebar() {
  const { activeView, setActiveView, isSidebarCollapsed, toggleSidebar } =
    useUiStore();
  const { workItems } = useBoardStore();
  const prCount = useGitHubStore((s) => s.pullRequestsToReview.length);
  const obsUnread = useObservabilityStore((s) => s.unreadCount());

  const navItems: NavItem[] = NAV_ITEMS.map((item) => ({
    ...item,
    badge:
      item.id === "my-tasks" && workItems.length > 0
        ? workItems.length
        : item.id === "reviews" && prCount > 0
          ? prCount
          : item.id === "radar" && obsUnread > 0
            ? obsUnread
            : undefined,
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <nav className="flex-1 overflow-y-auto py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              title={isSidebarCollapsed ? item.label : undefined}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors",
                isActive
                  ? "bg-[var(--color-surface-600)] text-[var(--color-surface-50)]"
                  : "text-[var(--color-surface-200)] hover:bg-[var(--color-surface-700)] hover:text-[var(--color-surface-100)]",
              )}
            >
              <Icon
                size={15}
                className={cn(
                  "flex-shrink-0",
                  isActive ? "text-[var(--color-accent-400)]" : "",
                )}
              />
              {!isSidebarCollapsed && (
                <>
                  <span className="text-xs flex-1 truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="text-[10px] bg-[var(--color-accent-600)] text-white px-1.5 py-0.5 rounded-full leading-none">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[var(--color-surface-700)] p-1 space-y-0.5">
        <button
          onClick={() => setActiveView("settings")}
          title="Settings"
          className={cn(
            "w-full flex items-center justify-center p-1.5 rounded transition-colors",
            activeView === "settings"
              ? "text-[var(--color-accent-400)]"
              : "text-[var(--color-surface-400)] hover:text-[var(--color-surface-200)] hover:bg-[var(--color-surface-700)]",
          )}
        >
          <Settings size={14} />
        </button>
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-1.5 text-[var(--color-surface-400)] hover:text-[var(--color-surface-200)] hover:bg-[var(--color-surface-700)] rounded transition-colors"
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isSidebarCollapsed ? (
            <ChevronRight size={14} />
          ) : (
            <ChevronLeft size={14} />
          )}
        </button>
      </div>
    </div>
  );
}
