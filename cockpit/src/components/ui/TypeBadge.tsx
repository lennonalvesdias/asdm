import type { WorkItemType } from "../../types";

const TYPE_CONFIG: Record<WorkItemType, { label: string; className: string }> = {
  "user-story": { label: "Story",       className: "bg-[var(--color-accent-600)]/30 text-[var(--color-accent-300)]" },
  bug:          { label: "Bug",         className: "bg-[var(--color-danger-600)]/30 text-[var(--color-danger-300)]" },
  task:         { label: "Task",        className: "bg-[var(--color-surface-500)] text-[var(--color-surface-200)]" },
  epic:         { label: "Epic",        className: "bg-purple-900/40 text-purple-300" },
  feature:      { label: "Feature",     className: "bg-[var(--color-info-600)]/30 text-[var(--color-info-300)]" },
  impediment:   { label: "Impediment",  className: "bg-[var(--color-warning-600)]/30 text-[var(--color-warning-300)]" },
};

interface TypeBadgeProps {
  type: WorkItemType;
}

export function TypeBadge({ type }: TypeBadgeProps) {
  const config = TYPE_CONFIG[type];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${config.className}`}
    >
      {config.label}
    </span>
  );
}
