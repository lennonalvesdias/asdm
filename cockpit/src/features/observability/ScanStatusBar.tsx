import {
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "../../lib/cn";
import type { ScanStatus } from "../../types";

interface ScanStatusBarProps {
  lastScanAt: string | null;
  nextScheduledAt: string | null;
  scanStatus: ScanStatus;
  isScanning: boolean;
  onScanNow: () => void;
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatCountdown(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return "now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const STATUS_ICON: Record<
  ScanStatus,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  idle: Clock,
  running: Loader2,
  success: CheckCircle2,
  partial: AlertCircle,
  failed: AlertCircle,
};

const STATUS_COLOR: Record<ScanStatus, string> = {
  idle: "text-[var(--color-surface-500)]",
  running: "text-[var(--color-accent-400)] animate-spin",
  success: "text-[var(--color-success-400)]",
  partial: "text-[var(--color-warning-400)]",
  failed: "text-[var(--color-danger-400)]",
};

export function ScanStatusBar({
  lastScanAt,
  nextScheduledAt,
  scanStatus,
  isScanning,
  onScanNow,
}: ScanStatusBarProps) {
  const Icon = STATUS_ICON[scanStatus];

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[var(--color-surface-800)] border-b border-[var(--color-surface-700)]">
      <Icon
        size={13}
        className={cn("flex-shrink-0", STATUS_COLOR[scanStatus])}
      />

      <div className="flex-1 flex items-center gap-3 text-[11px] text-[var(--color-surface-400)]">
        {isScanning ? (
          <span className="text-[var(--color-accent-400)]">Scanning apps…</span>
        ) : (
          <>
            {lastScanAt ? (
              <span>
                Last scan:{" "}
                <span className="text-[var(--color-surface-300)]">
                  {formatRelativeTime(lastScanAt)}
                </span>
              </span>
            ) : (
              <span className="text-[var(--color-surface-500)]">
                No scan yet
              </span>
            )}
            {nextScheduledAt && (
              <span className="text-[var(--color-surface-500)]">
                · Next:{" "}
                <span className="text-[var(--color-surface-400)]">
                  in {formatCountdown(nextScheduledAt)}
                </span>
              </span>
            )}
          </>
        )}
      </div>

      <button
        onClick={onScanNow}
        disabled={isScanning}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
          isScanning
            ? "opacity-50 cursor-not-allowed text-[var(--color-surface-400)]"
            : "text-[var(--color-surface-300)] hover:text-[var(--color-surface-50)] hover:bg-[var(--color-surface-700)]",
        )}
      >
        <RefreshCw size={11} className={isScanning ? "animate-spin" : ""} />
        Scan now
      </button>
    </div>
  );
}
