import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { useObservabilityStore } from "../../stores/observability.store";
import { useAgentStore } from "../../stores";
import { InsightCard } from "./InsightCard";
import { ScanStatusBar } from "./ScanStatusBar";
import type { ObservabilityInsight, InsightSeverity } from "../../types";

type SeverityFilter = "all" | InsightSeverity;
type StatusFilter = "active" | "all";

export function ObservabilityView() {
  const {
    insights,
    monitoringState,
    monitoredApps,
    updateInsightStatus,
    markAllSeen,
    dismissAll,
    setMonitoringState,
  } = useObservabilityStore();

  const { openPtySession, setActivePtySession, openPanel, setPendingPtySpawn } =
    useAgentStore();

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  // Mark all as seen when the view opens
  useEffect(() => {
    markAllSeen();
  }, []);

  const handleScanNow = () => {
    // In mock mode, simulate a scan
    setMonitoringState({ isScanning: true, lastScanStatus: "running" });
    setTimeout(() => {
      setMonitoringState({
        isScanning: false,
        lastScanStatus: "success",
        lastScanAt: new Date().toISOString(),
      });
    }, 2500);
  };

  const handleAct = (insight: ObservabilityInsight) => {
    updateInsightStatus(insight.id, "acted");
    const sessionId = nanoid();
    const command = `/support ${insight.suggestedAction}`;
    openPtySession(sessionId);
    setActivePtySession(sessionId);
    openPanel();
    setPendingPtySpawn({
      sessionId,
      command: "opencode",
      args: ["run", command],
      cwd: null,
      envVars: {
        COCKPIT_INSIGHT_ID: insight.id,
        COCKPIT_APP_NAME: insight.appName,
      },
      cols: 120,
      rows: 30,
    });
  };

  const handleDismiss = (id: string) => {
    updateInsightStatus(id, "dismissed");
  };

  // Filter insights
  const filtered = insights.filter((i) => {
    if (statusFilter === "active" && i.status === "dismissed") return false;
    if (severityFilter !== "all" && i.severity !== severityFilter) return false;
    return true;
  });

  const criticalCount = insights.filter(
    (i) => i.severity === "critical" && i.status !== "dismissed",
  ).length;
  const warningCount = insights.filter(
    (i) => i.severity === "warning" && i.status !== "dismissed",
  ).length;
  const infoCount = insights.filter(
    (i) => i.severity === "info" && i.status !== "dismissed",
  ).length;

  const enabledAppsCount = monitoredApps.filter((a) => a.enabled).length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--color-surface-900)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-surface-700)] flex-shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-[var(--color-surface-50)]">
            Observability
          </h1>
          <p className="text-[10px] text-[var(--color-surface-500)] mt-0.5">
            Monitoring {enabledAppsCount} app{enabledAppsCount !== 1 ? "s" : ""}{" "}
            via Dynatrace &amp; Grafana
          </p>
        </div>
      </div>

      {/* Scan status bar */}
      <ScanStatusBar
        lastScanAt={monitoringState.lastScanAt}
        nextScheduledAt={monitoringState.nextScheduledAt}
        scanStatus={monitoringState.lastScanStatus}
        isScanning={monitoringState.isScanning}
        onScanNow={handleScanNow}
      />

      {/* Summary pills */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-surface-700)] flex-shrink-0">
        <button
          onClick={() => setSeverityFilter("critical")}
          className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded transition-colors ${
            severityFilter === "critical"
              ? "bg-[var(--color-danger-400)]/20 text-[var(--color-danger-400)]"
              : "text-[var(--color-danger-400)] hover:bg-[var(--color-surface-800)]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger-400)]" />
          {criticalCount} Critical
        </button>
        <button
          onClick={() => setSeverityFilter("warning")}
          className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded transition-colors ${
            severityFilter === "warning"
              ? "bg-[var(--color-warning-400)]/20 text-[var(--color-warning-400)]"
              : "text-[var(--color-warning-400)] hover:bg-[var(--color-surface-800)]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning-400)]" />
          {warningCount} Warning
        </button>
        <button
          onClick={() => setSeverityFilter("info")}
          className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded transition-colors ${
            severityFilter === "info"
              ? "bg-[var(--color-info-400)]/20 text-[var(--color-info-400)]"
              : "text-[var(--color-info-400)] hover:bg-[var(--color-surface-800)]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-info-400)]" />
          {infoCount} Info
        </button>
        {severityFilter !== "all" && (
          <button
            onClick={() => setSeverityFilter("all")}
            className="text-[10px] text-[var(--color-surface-500)] hover:text-[var(--color-surface-300)] transition-colors ml-1"
          >
            Clear filter
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={() =>
            setStatusFilter((f) => (f === "active" ? "all" : "active"))
          }
          className="text-[10px] text-[var(--color-surface-500)] hover:text-[var(--color-surface-300)] transition-colors"
        >
          {statusFilter === "active" ? "Show dismissed" : "Hide dismissed"}
        </button>
        <button
          onClick={dismissAll}
          className="text-[10px] text-[var(--color-surface-500)] hover:text-[var(--color-surface-300)] transition-colors"
        >
          Dismiss all
        </button>
      </div>

      {/* Insights list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-16">
            <p className="text-sm font-medium text-[var(--color-surface-400)]">
              No insights found
            </p>
            <p className="text-xs text-[var(--color-surface-600)]">
              {insights.length === 0
                ? "Run a scan to check your apps for issues."
                : "All issues have been addressed or dismissed."}
            </p>
          </div>
        ) : (
          filtered.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onAct={handleAct}
              onDismiss={handleDismiss}
            />
          ))
        )}
      </div>
    </div>
  );
}
