import type { WorkItemStatus } from "../../types";

const STATUS_CONFIG: Record<
  WorkItemStatus,
  { label: string; className: string }
> = {
  backlog:       { label: "Backlog",      className: "bg-[var(--color-surface-600)] text-[var(--color-surface-300)]" },
  active:        { label: "Active",       className: "bg-[var(--color-info-600)]/30 text-[var(--color-info-300)]" },
  "code-review": { label: "Code Review",  className: "bg-[var(--color-warning-600)]/30 text-[var(--color-warning-300)]" },
  testing:       { label: "Testing",      className: "bg-[var(--color-accent-600)]/30 text-[var(--color-accent-300)]" },
  done:          { label: "Done",         className: "bg-[var(--color-success-600)]/30 text-[var(--color-success-300)]" },
  blocked:       { label: "Blocked",      className: "bg-[var(--color-danger-600)]/30 text-[var(--color-danger-300)]" },
};

interface StatusBadgeProps {
  status: WorkItemStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${config.className}`}
    >
      {config.label}
    </span>
  );
}
