import { useUiStore, useBoardStore } from "../../stores";
import { SprintView } from "../../features/board/SprintView";
import { TaskDetailView } from "../../features/task-detail/TaskDetailView";
import { SettingsView } from "../../features/settings/SettingsView";
import { DashboardView } from "../../features/dashboard/DashboardView";

export function MainPanel() {
  const { activeView } = useUiStore();
  const { selectedWorkItemId } = useBoardStore();

  if (selectedWorkItemId) {
    return (
      <div className="h-full overflow-hidden">
        <TaskDetailView />
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      {activeView === "sprint" && <SprintView />}
      {activeView === "my-tasks" && <SprintView filterMyTasks />}
      {activeView === "board" && <SprintView />}
      {activeView === "team" && <DashboardView />}
      {activeView === "dashboard" && <DashboardView />}
      {activeView === "settings" && <SettingsView />}
      {activeView === "workflow" && <SettingsView />}
    </div>
  );
}
