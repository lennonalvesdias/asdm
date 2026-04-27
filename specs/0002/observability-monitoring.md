# Spec: Observability & Active Monitoring

> **Status**: Draft  
> **Created**: 2026-04-25  
> **Feature names (proposed)**: see section [Naming Candidates](#naming-candidates)

---

## 1. Overview

The Observability & Active Monitoring feature introduces continuous, automated health monitoring of a user-configured set of applications. The system queries **Dynatrace** (error traces, root-cause) and **Grafana** (latency, SLO, throughput) via their respective MCP servers on a configurable schedule (default: 15 min) and on-demand. When actionable signals are found, the user is notified inside a dedicated **Observability** view and offered a one-click path to open a resolution workflow via the `/support` OpenCode command.

### Goals

- Proactively surface error spikes and performance degradations **before** users file tickets.
- Reduce MTTR by bridging observability data directly into the engineering workflow (PBI creation + AI-assisted fix suggestions).
- Remain lightweight: Tauri handles scheduling and persistence; the heavy MCP analysis is delegated to an OpenCode agent running in a PTY session.

### Non-Goals (v1)

- Alerting via external channels (email, Slack, PagerDuty) — out of scope.
- Custom Grafana/Dynatrace dashboard embedding.
- Automated code fix generation (just surfaces `/support` — the user decides to act).
- Multi-user / team-level insight sharing.

---

## 2. Naming Candidates

| Name         | Rationale                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| **Radar**    | Cockpit metaphor — passive, continuous scanning; "off the radar" / "on radar" vocabulary maps naturally |
| **Pulse**    | Health-check cadence; "app pulse", "checking pulse" — readable for non-ops engineers                    |
| **Beacon**   | Navigation/signal theme; beacons emit signals when something needs attention                            |
| **Scout**    | Proactive discovery; "Scout is watching your apps"                                                      |
| **Sentinel** | Guardian/watchdog; strong monitoring connotation                                                        |

**Recommendation**: **Radar** — fits the Engineering Cockpit brand, cockpit instruments have radar, and it implies continuous passive scanning without being alarming.

---

## 3. User Stories

| ID    | Story                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------- |
| US-01 | As a developer, I can add/remove apps to monitor via Settings so the system knows what to watch.            |
| US-02 | As a developer, I see a badge on the Observability nav item when new insights are available.                |
| US-03 | As a developer, I can view all insights in a dedicated Observability view grouped by app and severity.      |
| US-04 | As a developer, I can trigger a manual monitoring scan for all configured apps.                             |
| US-05 | As a developer, clicking "Act" on an insight opens a PTY session pre-filled with `/support <description>`.  |
| US-06 | As a developer, I can mark an insight as "dismissed" so it stops appearing.                                 |
| US-07 | As a developer, the system automatically polls every 15 minutes (configurable) and updates the badge count. |
| US-08 | As a developer, I can see when the last scan ran and its status (success / partial / failed).               |

---

## 4. Architecture

### 4.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────┐
│  Tauri Background Timer (15 min)  ◄── manual trigger     │
│                                                           │
│  1. Read monitored-apps config from observability store   │
│  2. Emit Tauri event: "monitoring:scan_start"             │
│  3. spawn_pty → OpenCode monitoring agent (PTY session)   │
│     • Agent receives app list as env var JSON             │
│     • Agent calls Dynatrace MCP: getErrorTraces(app)      │
│     • Agent calls Grafana MCP: getServiceSLO(app)         │
│     • Agent scores findings → outputs structured JSON     │
│  4. Tauri reads agent stdout, parses JSON insights        │
│  5. Append to local insights file (~/cockpit-insights.json)│
│  6. Emit event: "monitoring:scan_done" with new insights   │
│  7. Frontend store hydrates → badge updates               │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Hybrid Approach (Why)

- **Tauri layer**: Owns the schedule timer, app config persistence, insights file I/O, and PTY lifecycle. This is purely mechanical — no AI reasoning.
- **OpenCode agent layer**: Owns MCP tool calls, AI reasoning ("is this actionable?"), and structured insight generation. This layer can be updated via ASDM without shipping a new binary.

### 4.3 Data Flow

```
Settings UI ──write──► observability.store.ts (Zustand persist)
                              │
                              ▼
Tauri timer / manual ──► invoke("start_monitoring_scan")
                              │
                         spawn_pty("opencode run monitoring-agent --apps $JSON")
                              │
                         agent stdout (JSON stream)
                              │
                         invoke("save_insights", payload)
                              │
                         Tauri FS write ──► ~/cockpit-insights.json
                              │
                         emit("monitoring:scan_done", insights[])
                              │
                         observability.store.setInsights()
                              │
                         ObservabilityView re-renders + sidebar badge
```

---

## 5. Types

File: `src/types/observability.types.ts`

```typescript
/** An application registered for monitoring */
export interface MonitoredApp {
  id: string; // nanoid
  name: string; // Display name, e.g. "Payments API"
  dynatraceEntityId?: string; // e.g. "SERVICE-ABC123"
  dynatraceApplicationId?: string;
  grafanaServiceName?: string; // matches Grafana service label
  grafanaDatasourceUid?: string;
  enabled: boolean;
  addedAt: string; // ISO 8601
}

/** A single insight produced by the monitoring agent */
export interface ObservabilityInsight {
  id: string; // nanoid
  appId: string; // references MonitoredApp.id
  appName: string;
  source: "dynatrace" | "grafana" | "combined";
  severity: InsightSeverity;
  title: string; // Short, e.g. "Error rate spike detected"
  description: string; // Full context from agent
  suggestedAction: string; // Pre-filled /support parameter text
  category: InsightCategory;
  detectedAt: string; // ISO 8601
  status: InsightStatus;
  rawMetric?: InsightMetric; // Optional raw numeric context
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
  unit: string; // "%" | "ms" | "req/s" | ...
  timeWindowMinutes: number;
}

/** Persisted state of the monitoring system */
export interface MonitoringState {
  lastScanAt: string | null; // ISO 8601
  lastScanStatus: ScanStatus;
  nextScheduledAt: string | null;
  isScanning: boolean;
}

export type ScanStatus = "idle" | "running" | "success" | "partial" | "failed";

/** What the monitoring agent outputs to stdout (NDJSON, one object per line) */
export interface AgentInsightOutput {
  type: "insight" | "scan_complete" | "scan_error";
  payload: ObservabilityInsight | ScanSummary | ScanError;
}

export interface ScanSummary {
  appsScanned: number;
  insightsFound: number;
  durationMs: number;
}

export interface ScanError {
  message: string;
  appId?: string;
}
```

---

## 6. Zustand Store

File: `src/stores/observability.store.ts`  
Persisted key: `cockpit-observability`

```typescript
interface ObservabilityState {
  // Config
  monitoredApps: MonitoredApp[];
  pollingIntervalMinutes: number; // default: 15

  // Runtime
  insights: ObservabilityInsight[];
  monitoringState: MonitoringState;

  // Computed (derived)
  unreadCount: number; // insights where status === 'new'

  // Actions
  addApp: (app: Omit<MonitoredApp, "id" | "addedAt">) => void;
  removeApp: (id: string) => void;
  toggleApp: (id: string) => void;
  updateApp: (id: string, patch: Partial<MonitoredApp>) => void;

  setInsights: (insights: ObservabilityInsight[]) => void;
  appendInsights: (insights: ObservabilityInsight[]) => void;
  updateInsightStatus: (id: string, status: InsightStatus) => void;
  dismissAll: () => void;

  setMonitoringState: (patch: Partial<MonitoringState>) => void;
  setPollingInterval: (minutes: number) => void;
}
```

**Persistence strategy**: Only `monitoredApps` and `pollingIntervalMinutes` are persisted in Zustand (localStorage). `insights` are loaded from the local file on app startup via a Tauri command and written on each scan. `monitoringState` is ephemeral (reset to `idle` on startup).

---

## 7. Rust Commands

File: `src-tauri/src/commands/observability.rs`

### 7.1 `start_monitoring_scan`

```rust
#[tauri::command]
async fn start_monitoring_scan(
    app: tauri::AppHandle,
    apps: Vec<MonitoredAppPayload>,  // serialized from store
) -> Result<String, String>          // returns execution_id
```

- Builds a JSON env var `COCKPIT_MONITORED_APPS`.
- Calls `spawn_pty` with the monitoring agent invocation.
- Returns an `execution_id` so the frontend can track the PTY session.
- Emits `monitoring:scan_start` event.

### 7.2 `save_insights`

```rust
#[tauri::command]
async fn save_insights(
    app: tauri::AppHandle,
    insights: Vec<InsightPayload>,
) -> Result<(), String>
```

- Reads existing `~/cockpit-insights.json` (or creates it).
- Merges new insights (dedup by `id`).
- Writes back atomically.

### 7.3 `load_insights`

```rust
#[tauri::command]
async fn load_insights(
    app: tauri::AppHandle,
) -> Result<Vec<InsightPayload>, String>
```

- Reads `~/cockpit-insights.json`.
- Returns empty vec if file doesn't exist.

### 7.4 `schedule_monitoring` (background timer)

```rust
#[tauri::command]
async fn schedule_monitoring(
    app: tauri::AppHandle,
    interval_minutes: u64,
    apps: Vec<MonitoredAppPayload>,
) -> Result<(), String>
```

- Stores the interval task in a global `Arc<Mutex<Option<JoinHandle>>>`.
- On call: cancels existing task, spawns new `tokio::time::interval` loop.
- Each tick emits `monitoring:tick` so the frontend can decide to run a scan.

### 7.5 `stop_monitoring_schedule`

```rust
#[tauri::command]
async fn stop_monitoring_schedule(app: tauri::AppHandle) -> Result<(), String>
```

- Cancels the background interval task.

---

## 8. Monitoring Agent Definition

File: Registered in user's ASDM registry as `.opencode/agents/monitoring-agent.md`

```markdown
---
name: monitoring-agent
description: Continuously monitors configured apps via Dynatrace and Grafana MCPs, outputs structured JSON insights
tools:
  - dynatrace
  - grafana
---

You are a monitoring agent for the Engineering Cockpit. You receive a list of apps as
JSON in the environment variable COCKPIT_MONITORED_APPS.

For each app:

1. Use the Dynatrace MCP to query error rates and exception traces for the last 30 minutes.
2. Use the Grafana MCP to query SLO compliance and p99 latency for the last 30 minutes.
3. Evaluate whether any metric breaches a threshold (error rate > 1%, SLO < 99.5%, p99 > 2000ms).
4. For each breach found, output a JSON object on a single line (NDJSON format):

{"type":"insight","payload":{"id":"<nanoid>","appId":"...","appName":"...","source":"dynatrace|grafana|combined","severity":"critical|warning|info","title":"...","description":"...","suggestedAction":"...","category":"...","detectedAt":"<ISO8601>","status":"new","rawMetric":{...}}}

5. At the end, output a scan_complete line:

{"type":"scan_complete","payload":{"appsScanned":N,"insightsFound":N,"durationMs":N}}

Output ONLY valid NDJSON. No prose, no markdown. Each line is one complete JSON object.
```

---

## 9. Frontend — Feature Structure

```
src/features/observability/
├── ObservabilityView.tsx       ← Main view: scan status bar + insights list
├── InsightCard.tsx             ← Individual insight with severity icon + Act button
├── AppMonitorList.tsx          ← Reused in Settings: add/remove/toggle apps
└── ScanStatusBar.tsx           ← Last scan time, next scan countdown, manual trigger button
```

### 9.1 `ObservabilityView.tsx` — Layout

```
┌────────────────────────────────────────────────────┐
│  Observability                          [Scan Now]  │
│  Last scan: 3 min ago · Next: in 12 min             │
│  ─────────────────────────────────────────────────  │
│  ⬤ CRITICAL  2   ⬤ WARNING  5   ● INFO  1           │
│  ─────────────────────────────────────────────────  │
│  [Filter: All ▼]  [App: All ▼]  [Dismiss all]       │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ ⬤ CRITICAL · Payments API · Dynatrace         │   │
│  │ Error rate spike: 4.2% (threshold: 1%)        │   │
│  │ NullPointerException in PaymentService.java   │   │
│  │ Last 30 min: 847 errors                       │   │
│  │                                    [Act →]    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ ⬤ WARNING · Checkout API · Grafana             │   │
│  │ p99 latency: 3,200ms (threshold: 2,000ms)     │   │
│  │ SLO compliance dropped to 98.1%               │   │
│  │                                    [Act →]    │   │
│  └──────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

### 9.2 "Act" Flow

Clicking `[Act →]` on an insight:

1. Sets insight `status = 'acted'`.
2. Calls `openPtySession` with command: `/support ${insight.suggestedAction}`.
3. Opens the bottom PTY panel.
4. The OpenCode `/support` command creates a PBI and proposes a dev workflow.

### 9.3 Sidebar Badge

The `Sidebar.tsx` nav item for Observability shows a red badge with `unreadCount` when `> 0`. Badge disappears when the user opens the view (all `new` insights transition to `seen`).

---

## 10. Settings Integration

Add a new section to `SettingsView.tsx`: **"Monitored Apps"**

```
Monitored Apps
──────────────────────────────────────────────────────
Polling interval:  [ 15 ] minutes

  App Name          Dynatrace Entity ID    Grafana Service    Enabled
  ──────────────────────────────────────────────────────────────────
  Payments API      SERVICE-ABC123         payments-api       ✓
  Checkout API      SERVICE-XYZ456         checkout-api       ✓
  ──────────────────────────────────────────────────────────────────
  [+ Add App]
```

Uses `AppMonitorList.tsx` component (shared with ObservabilityView if needed).

---

## 11. Mock Data

Add to `src/lib/mock-data.ts`:

```typescript
export const MOCK_MONITORED_APPS: MonitoredApp[] = [
  {
    id: "app-001",
    name: "Payments API",
    dynatraceEntityId: "SERVICE-ABC123",
    grafanaServiceName: "payments-api",
    enabled: true,
    addedAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "app-002",
    name: "Checkout API",
    dynatraceEntityId: "SERVICE-XYZ456",
    grafanaServiceName: "checkout-api",
    enabled: true,
    addedAt: "2026-04-01T00:00:00Z",
  },
];

export const MOCK_INSIGHTS: ObservabilityInsight[] = [
  {
    id: "ins-001",
    appId: "app-001",
    appName: "Payments API",
    source: "dynatrace",
    severity: "critical",
    title: "Error rate spike detected",
    description:
      "NullPointerException in PaymentService.processCard() spiked to 4.2% error rate over the last 30 minutes. Root cause: missing null check on card token.",
    suggestedAction:
      "NullPointerException in PaymentService.processCard() with 4.2% error rate. Likely missing null guard on card token input.",
    category: "error-rate",
    detectedAt: "2026-04-25T10:00:00Z",
    status: "new",
    rawMetric: {
      metricName: "error_rate",
      currentValue: 4.2,
      threshold: 1,
      unit: "%",
      timeWindowMinutes: 30,
    },
  },
  {
    id: "ins-002",
    appId: "app-002",
    appName: "Checkout API",
    source: "grafana",
    severity: "warning",
    title: "p99 latency above threshold",
    description:
      "p99 response time reached 3,200ms, exceeding the 2,000ms SLO threshold. SLO compliance is at 98.1% for the current window.",
    suggestedAction:
      "p99 latency 3200ms (threshold 2000ms) in Checkout API. SLO at 98.1%. Investigate slow DB queries or downstream dependencies.",
    category: "latency",
    detectedAt: "2026-04-25T10:05:00Z",
    status: "new",
    rawMetric: {
      metricName: "p99_latency",
      currentValue: 3200,
      threshold: 2000,
      unit: "ms",
      timeWindowMinutes: 30,
    },
  },
];
```

---

## 12. UI/UX — Active View Integration

### 12.1 `ui.store.ts` — Add `'observability'` to `ActiveView`

```typescript
// Before
export type ActiveView =
  | "sprint"
  | "board"
  | "team"
  | "dashboard"
  | "workflow"
  | "reviews"
  | "settings";

// After
export type ActiveView =
  | "sprint"
  | "board"
  | "team"
  | "dashboard"
  | "workflow"
  | "reviews"
  | "settings"
  | "observability";
```

### 12.2 `Sidebar.tsx` — New Nav Item

Position: between `reviews` and `settings`.

```tsx
<NavItem
  icon={<RadarIcon />} // lucide-react: Radar or ScanSearch
  label="Observability"
  view="observability"
  badge={unreadCount > 0 ? unreadCount : undefined}
/>
```

### 12.3 `AppShell.tsx` — Route Case

```tsx
case 'observability':
  return <ObservabilityView />;
```

---

## 13. Tauri Events

| Event name              | Direction       | Payload                                                      |
| ----------------------- | --------------- | ------------------------------------------------------------ |
| `monitoring:scan_start` | Rust → Frontend | `{ executionId: string }`                                    |
| `monitoring:scan_done`  | Rust → Frontend | `{ insights: ObservabilityInsight[], summary: ScanSummary }` |
| `monitoring:scan_error` | Rust → Frontend | `{ message: string }`                                        |
| `monitoring:tick`       | Rust → Frontend | `{ nextAt: string }` (ISO 8601)                              |

Frontend subscribes to these via `@tauri-apps/api/event` `listen()` inside a `useEffect` in the `ObservabilityView` (or a custom `useMonitoringEvents()` hook).

---

## 14. Insights Persistence

- File location: `$APP_DATA_DIR/cockpit-insights.json` (using Tauri `path` plugin's `appDataDir()`).
- Format: JSON array of `ObservabilityInsight[]`, sorted descending by `detectedAt`.
- Max retention: 500 entries (trim oldest on each write).
- Loaded once on app startup via `load_insights` → hydrated into `observability.store.setInsights()`.
- On startup, insights older than 7 days are filtered out (stale signal pruning).

---

## 15. Implementation Phases

### Phase 1 — Foundation (Types + Store + Settings)

- [ ] Add `src/types/observability.types.ts`
- [ ] Add `src/stores/observability.store.ts` (with Zustand persist, only `monitoredApps` + `pollingIntervalMinutes`)
- [ ] Add `'observability'` to `ActiveView` in `ui.store.ts`
- [ ] Add `AppMonitorList.tsx` component
- [ ] Integrate `AppMonitorList` into `SettingsView.tsx`
- [ ] Add to `src/lib/mock-data.ts`: `MOCK_MONITORED_APPS` + `MOCK_INSIGHTS`
- [ ] Hydrate mock data in `use-mock-init.ts`

### Phase 2 — Observability View (UI)

- [ ] Scaffold `src/features/observability/`
- [ ] Implement `InsightCard.tsx`
- [ ] Implement `ScanStatusBar.tsx`
- [ ] Implement `ObservabilityView.tsx`
- [ ] Wire `ObservabilityView` into `AppShell.tsx` + sidebar nav item
- [ ] Implement sidebar badge (unreadCount)

### Phase 3 — Tauri Backend

- [ ] Create `src-tauri/src/commands/observability.rs` with all 5 commands
- [ ] Register commands in `lib.rs` `invoke_handler![]`
- [ ] Implement Tauri event emissions for scan lifecycle
- [ ] Wire `load_insights` on app startup

### Phase 4 — Agent Integration

- [ ] Define `monitoring-agent.md` in ASDM registry
- [ ] Implement `start_monitoring_scan`: PTY spawn with `COCKPIT_MONITORED_APPS` env var
- [ ] Implement NDJSON stdout parser in Tauri (reads from PTY output stream)
- [ ] Wire `monitoring:scan_done` event to store `appendInsights()`
- [ ] Implement "Act" button → PTY `/support` spawn

### Phase 5 — Scheduler

- [ ] Implement `schedule_monitoring` background timer in Rust
- [ ] Frontend: call `schedule_monitoring` on startup (if apps configured)
- [ ] Frontend: re-schedule when `pollingIntervalMinutes` changes in settings
- [ ] Show countdown in `ScanStatusBar`

---

## 16. Open Questions / Decisions Deferred

| #   | Question                                                                             | Default assumption                                          |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Q1  | Should individual insights support "snooze" (reappear after X hours)?                | Not in v1 — only dismiss                                    |
| Q2  | What happens if Dynatrace MCP is unavailable?                                        | Mark scan as `partial`, surface warning in `ScanStatusBar`  |
| Q3  | Should the monitoring agent run in a visible PTY tab or a hidden background session? | Hidden (no PTY tab opened), stdout piped directly           |
| Q4  | Insight dedup strategy across scans — same issue recurring every 15 min?             | Dedup by `(appId, category, title)` within a 2h window      |
| Q5  | Should polling pause when Cockpit window is backgrounded?                            | No — Tauri background timer runs regardless of window focus |

---

## 17. Dependencies & Risks

| Item                           | Risk                                             | Mitigation                                                               |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------ |
| Dynatrace MCP availability     | Medium — external service, may not be configured | Graceful degradation, surface config hint in Settings                    |
| Grafana MCP availability       | Medium — same as above                           | Same                                                                     |
| NDJSON parsing robustness      | Low–Medium — agent could emit malformed lines    | Parse each line in a `try/catch`, skip invalid                           |
| PTY hidden session conflicts   | Low — PTY is shared with user sessions           | Use a dedicated `MONITORING_` prefixed session ID, don't show in tab bar |
| `noUnusedLocals` TS strictness | Low                                              | Clean up all imports at implementation time                              |
