/** An application registered for monitoring */
export interface MonitoredApp {
  id: string;
  name: string;
  dynatraceEntityId?: string;
  dynatraceApplicationId?: string;
  grafanaServiceName?: string;
  grafanaDatasourceUid?: string;
  enabled: boolean;
  addedAt: string; // ISO 8601
}

export type InsightSeverity = "critical" | "warning" | "info";
export type InsightStatus = "new" | "seen" | "acted" | "dismissed";
export type InsightCategory =
  | "error-rate"
  | "latency"
  | "slo-breach"
  | "exception"
  | "throughput-drop"
  | "crash";

export interface InsightMetric {
  metricName: string;
  currentValue: number;
  threshold: number;
  unit: string;
  timeWindowMinutes: number;
}

/** A single insight produced by the monitoring agent */
export interface ObservabilityInsight {
  id: string;
  appId: string;
  appName: string;
  source: "dynatrace" | "grafana" | "combined";
  severity: InsightSeverity;
  title: string;
  description: string;
  suggestedAction: string;
  category: InsightCategory;
  detectedAt: string; // ISO 8601
  status: InsightStatus;
  rawMetric?: InsightMetric;
}

export type ScanStatus = "idle" | "running" | "success" | "partial" | "failed";

export interface MonitoringState {
  lastScanAt: string | null;
  lastScanStatus: ScanStatus;
  nextScheduledAt: string | null;
  isScanning: boolean;
}
