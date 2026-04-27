import { useBoardStore } from "../../stores";
import {
  LayoutDashboard,
  Activity,
  CheckCircle,
  AlertCircle,
  CheckSquare,
} from "lucide-react";
import type { WorkItemStatus } from "../../types";

const STATUS_COLORS: Record<WorkItemStatus, string> = {
  backlog: "bg-[var(--color-surface-500)]",
  active: "bg-[var(--color-info-500)]",
  "code-review": "bg-[var(--color-warning-500)]",
  testing: "bg-[var(--color-accent-500)]",
  done: "bg-[var(--color-success-500)]",
  blocked: "bg-[var(--color-danger-500)]",
};

export function DashboardView() {
  const { workItems } = useBoardStore();

  const byStatus = workItems.reduce(
    (acc, wi) => {
      acc[wi.status] = (acc[wi.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<WorkItemStatus, number>,
  );

  const total = workItems.length;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <LayoutDashboard
            size={16}
            className="text-[var(--color-accent-400)]"
          />
          <h1 className="text-sm font-semibold text-[var(--color-surface-50)]">
            Dashboard
          </h1>
        </div>

        {/* Stats — 4 cards */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="In Progress"
            value={byStatus["active"] ?? 0}
            icon={Activity}
            color="text-[var(--color-info-400)]"
          />
          <StatCard
            label="In Review"
            value={byStatus["code-review"] ?? 0}
            icon={CheckCircle}
            color="text-[var(--color-warning-400)]"
          />
          <StatCard
            label="Blocked"
            value={byStatus["blocked"] ?? 0}
            icon={AlertCircle}
            color="text-[var(--color-danger-400)]"
          />
          <StatCard
            label="Done"
            value={byStatus["done"] ?? 0}
            icon={CheckSquare}
            color="text-[var(--color-success-400)]"
          />
        </div>

        {/* Status breakdown */}
        <div className="bg-[var(--color-surface-800)] border border-[var(--color-surface-700)] rounded-[var(--radius-lg)] p-4">
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-surface-400)] mb-3">
            By Status
          </div>
          {total === 0 ? (
            <p className="text-xs text-[var(--color-surface-500)]">
              No work items loaded.
            </p>
          ) : (
            <div className="space-y-2">
              {(Object.entries(byStatus) as [WorkItemStatus, number][]).map(
                ([status, count]) => (
                  <div key={status} className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[status]}`}
                    />
                    <span className="text-xs text-[var(--color-surface-200)] capitalize flex-1">
                      {status.replace("-", " ")}
                    </span>
                    <span className="text-xs font-medium text-[var(--color-surface-100)]">
                      {count}
                    </span>
                    <div className="w-20 h-1 bg-[var(--color-surface-600)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${STATUS_COLORS[status]}`}
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-[var(--color-surface-800)] border border-[var(--color-surface-700)] rounded-[var(--radius-lg)] p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={12} className={color} />
        <span className="text-[10px] text-[var(--color-surface-400)]">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold text-[var(--color-surface-50)]">
        {value}
      </div>
    </div>
  );
}
