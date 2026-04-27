import type { WorkItemPriority } from "../../types";

const PRIORITY_CONFIG: Record<
  WorkItemPriority,
  { label: string; className: string }
> = {
  critical: { label: "Critical", className: "bg-[var(--color-danger-600)]/30 text-[var(--color-danger-300)]" },
  high:     { label: "High",     className: "bg-[var(--color-warning-600)]/30 text-[var(--color-warning-300)]" },
  medium:   { label: "Medium",   className: "bg-[var(--color-info-600)]/30 text-[var(--color-info-300)]" },
  low:      { label: "Low",      className: "bg-[var(--color-surface-600)] text-[var(--color-surface-300)]" },
};

interface PriorityBadgeProps {
  priority: WorkItemPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${config.className}`}
    >
      {config.label}
    </span>
  );
}
