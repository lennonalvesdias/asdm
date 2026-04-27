import {
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/cn";
import type { ObservabilityInsight, InsightSeverity } from "../../types";

interface InsightCardProps {
  insight: ObservabilityInsight;
  onAct: (insight: ObservabilityInsight) => void;
  onDismiss: (id: string) => void;
}

const SEVERITY_CONFIG: Record<
  InsightSeverity,
  {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    bg: string;
    label: string;
  }
> = {
  critical: {
    icon: AlertCircle,
    color: "text-[var(--color-danger-400)]",
    bg: "bg-[var(--color-danger-400)]/10 border-[var(--color-danger-400)]/30",
    label: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-[var(--color-warning-400)]",
    bg: "bg-[var(--color-warning-400)]/10 border-[var(--color-warning-400)]/30",
    label: "Warning",
  },
  info: {
    icon: Info,
    color: "text-[var(--color-info-400)]",
    bg: "bg-[var(--color-info-400)]/10 border-[var(--color-info-400)]/30",
    label: "Info",
  },
};

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function InsightCard({ insight, onAct, onDismiss }: InsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[insight.severity];
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border p-3 transition-opacity",
        cfg.bg,
        insight.status === "dismissed" && "opacity-40",
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2.5">
        <Icon size={14} className={cn("flex-shrink-0 mt-0.5", cfg.color)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                cfg.color,
              )}
            >
              {cfg.label}
            </span>
            <span className="text-[10px] text-[var(--color-surface-400)]">
              ·
            </span>
            <span className="text-[10px] text-[var(--color-surface-300)]">
              {insight.appName}
            </span>
            <span className="text-[10px] text-[var(--color-surface-400)]">
              ·
            </span>
            <span className="text-[10px] text-[var(--color-surface-500)] capitalize">
              {insight.source}
            </span>
          </div>
          <p className="text-xs font-medium text-[var(--color-surface-100)] mt-0.5 leading-snug">
            {insight.title}
          </p>

          {/* Metric pill */}
          {insight.rawMetric && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 bg-[var(--color-surface-700)] rounded px-2 py-0.5">
              <span className="text-[10px] font-mono text-[var(--color-surface-200)]">
                {insight.rawMetric.currentValue.toLocaleString()}
                {insight.rawMetric.unit}
              </span>
              <span className="text-[10px] text-[var(--color-surface-500)]">
                vs
              </span>
              <span className="text-[10px] font-mono text-[var(--color-surface-400)]">
                {insight.rawMetric.threshold.toLocaleString()}
                {insight.rawMetric.unit} threshold
              </span>
            </div>
          )}

          {/* Expanded description */}
          {expanded && (
            <p className="text-[11px] text-[var(--color-surface-300)] mt-2 leading-relaxed">
              {insight.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[9px] text-[var(--color-surface-500)]">
            {formatRelativeTime(insight.detectedAt)}
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 text-[var(--color-surface-400)] hover:text-[var(--color-surface-200)] transition-colors rounded"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            onClick={() => onDismiss(insight.id)}
            className="p-1 text-[var(--color-surface-500)] hover:text-[var(--color-surface-300)] transition-colors rounded"
            title="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Act button */}
      {insight.status !== "dismissed" && (
        <div className="mt-2.5 flex justify-end">
          <button
            onClick={() => onAct(insight)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-accent-600)] hover:bg-[var(--color-accent-500)] rounded text-[11px] font-medium text-white transition-colors"
          >
            Act with /support
            <ArrowRight size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
