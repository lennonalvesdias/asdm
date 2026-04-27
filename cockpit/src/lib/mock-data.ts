import type {
  WorkItem,
  Sprint,
  AgentDefinition,
  WorkItemAssignee,
  MonitoredApp,
  ObservabilityInsight,
} from "../types";

const ME: WorkItemAssignee = {
  id: "dev-1",
  displayName: "Matheus Peres",
  email: "matheus@company.com",
  avatarUrl: undefined,
};

const LEAD: WorkItemAssignee = {
  id: "lead-1",
  displayName: "Ana Souza",
  email: "ana@company.com",
};

const DEV2: WorkItemAssignee = {
  id: "dev-2",
  displayName: "Carlos Lima",
  email: "carlos@company.com",
};

export const MOCK_SPRINTS: Sprint[] = [
  {
    id: "sprint-23",
    name: "Sprint 23",
    path: "Engineering\\Sprint 23",
    startDate: "2026-04-14",
    finishDate: "2026-04-28",
    status: "current",
  },
  {
    id: "sprint-22",
    name: "Sprint 22",
    path: "Engineering\\Sprint 22",
    startDate: "2026-03-31",
    finishDate: "2026-04-13",
    status: "past",
  },
  {
    id: "sprint-24",
    name: "Sprint 24",
    path: "Engineering\\Sprint 24",
    startDate: "2026-04-29",
    finishDate: "2026-05-12",
    status: "future",
  },
];

export const MOCK_WORK_ITEMS: WorkItem[] = [
  {
    id: "4201",
    title: "Implement OAuth 2.0 PKCE flow for Azure DevOps integration",
    description:
      "<p>Set up the full OAuth 2.0 PKCE authorization flow to authenticate users against Azure DevOps. The flow must open a local HTTP loopback server to capture the callback, exchange the code for tokens, and store them securely in the OS keychain.</p><p><b>Acceptance criteria:</b></p><ul><li>User can sign in via browser</li><li>Tokens stored in keychain</li><li>Auto-refresh before expiry</li></ul>",
    status: "active",
    type: "user-story",
    priority: "high",
    assignee: ME,
    reporter: LEAD,
    iteration: {
      id: "sprint-23",
      name: "Sprint 23",
      path: "Engineering\\Sprint 23",
    },
    tags: ["auth", "azure", "security", "validated"],
    createdAt: "2026-04-10T09:00:00Z",
    updatedAt: "2026-04-17T14:30:00Z",
    storyPoints: 5,
    availableTransitions: [
      { to: "code-review", label: "Move to Code Review" },
      { to: "blocked", label: "Mark as Blocked" },
    ],
    providerMetadata: {
      provider: "azure-boards",
      rawId: 4201,
      url: "https://dev.azure.com/company/engineering/_workitems/edit/4201",
      raw: {},
    },
  },
  {
    id: "4198",
    title: "Work item list: filtering by status, type and iteration",
    description:
      "<p>Add filter controls to the sprint task list. Users should be able to filter by status, work item type, assignee, and tags. Filters persist per session.</p>",
    status: "code-review",
    type: "user-story",
    priority: "medium",
    assignee: ME,
    reporter: LEAD,
    iteration: {
      id: "sprint-23",
      name: "Sprint 23",
      path: "Engineering\\Sprint 23",
    },
    tags: ["ui", "filters", "code-review"],
    createdAt: "2026-04-09T11:00:00Z",
    updatedAt: "2026-04-17T10:00:00Z",
    storyPoints: 3,
    availableTransitions: [
      { to: "testing", label: "Send to Testing" },
      { to: "active", label: "Back to Active" },
    ],
    providerMetadata: {
      provider: "azure-boards",
      rawId: 4198,
      url: "https://dev.azure.com/company/engineering/_workitems/edit/4198",
      raw: {},
    },
  },
  {
    id: "4185",
    title: "Agent terminal: stream stdout/stderr in real time",
    description:
      "<p>The bottom panel should display agent output line by line as it streams. Use Tauri events to bridge the Rust process stdout to the React frontend.</p>",
    status: "testing",
    type: "feature",
    priority: "high",
    assignee: ME,
    reporter: LEAD,
    iteration: {
      id: "sprint-23",
      name: "Sprint 23",
      path: "Engineering\\Sprint 23",
    },
    tags: ["agent", "terminal", "tauri", "tasks-created"],
    createdAt: "2026-04-07T08:00:00Z",
    updatedAt: "2026-04-16T18:00:00Z",
    storyPoints: 8,
    availableTransitions: [
      { to: "done", label: "Mark as Done" },
      { to: "active", label: "Reopen" },
    ],
    providerMetadata: {
      provider: "azure-boards",
      rawId: 4185,
      url: "https://dev.azure.com/company/engineering/_workitems/edit/4185",
      raw: {},
    },
  },
  {
    id: "4210",
    title: "ASDM registry sync fails when git is not in PATH",
    description:
      "<p>When the user's git binary is not found in the system PATH, the registry sync silently fails. We need to detect git absence early and show a clear error with instructions to install git.</p>",
    status: "blocked",
    type: "bug",
    priority: "critical",
    assignee: ME,
    reporter: DEV2,
    iteration: {
      id: "sprint-23",
      name: "Sprint 23",
      path: "Engineering\\Sprint 23",
    },
    tags: ["bug", "registry", "git"],
    createdAt: "2026-04-15T09:30:00Z",
    updatedAt: "2026-04-17T09:00:00Z",
    storyPoints: 2,
    availableTransitions: [{ to: "active", label: "Unblock" }],
    providerMetadata: {
      provider: "azure-boards",
      rawId: 4210,
      url: "https://dev.azure.com/company/engineering/_workitems/edit/4210",
      raw: {},
    },
  },
  {
    id: "4172",
    title: "Tech Lead dashboard: sprint velocity and cycle time charts",
    description:
      "<p>Build the tech lead dashboard with two key charts: sprint velocity (story points delivered per sprint) and average cycle time per work item type.</p>",
    status: "backlog",
    type: "feature",
    priority: "medium",
    assignee: LEAD,
    reporter: LEAD,
    iteration: {
      id: "sprint-23",
      name: "Sprint 23",
      path: "Engineering\\Sprint 23",
    },
    tags: ["dashboard", "metrics", "charts", "spec-generated"],
    createdAt: "2026-04-01T10:00:00Z",
    updatedAt: "2026-04-12T11:00:00Z",
    storyPoints: 13,
    availableTransitions: [{ to: "active", label: "Start" }],
    providerMetadata: {
      provider: "azure-boards",
      rawId: 4172,
      url: "https://dev.azure.com/company/engineering/_workitems/edit/4172",
      raw: {},
    },
  },
  {
    id: "4160",
    title: "Workflow rule engine: UI editor for if/then automations",
    description:
      "<p>Visual editor for creating workflow automation rules. Tech leads should be able to create rules like 'when task moves to Code Review, run code-reviewer agent automatically'.</p>",
    status: "backlog",
    type: "epic",
    priority: "medium",
    assignee: LEAD,
    reporter: LEAD,
    iteration: {
      id: "sprint-23",
      name: "Sprint 23",
      path: "Engineering\\Sprint 23",
    },
    tags: ["workflow", "automation", "rule-engine"],
    createdAt: "2026-03-28T14:00:00Z",
    updatedAt: "2026-04-10T09:00:00Z",
    storyPoints: 21,
    availableTransitions: [{ to: "active", label: "Start" }],
    providerMetadata: {
      provider: "azure-boards",
      rawId: 4160,
      url: "https://dev.azure.com/company/engineering/_workitems/edit/4160",
      raw: {},
    },
  },
  {
    id: "4155",
    title: "Sidebar: resizable width with persisted preference",
    description:
      "<p>The sidebar should be resizable by dragging the edge. The width should persist across sessions via localStorage.</p>",
    status: "done",
    type: "task",
    priority: "low",
    assignee: ME,
    reporter: LEAD,
    iteration: {
      id: "sprint-23",
      name: "Sprint 23",
      path: "Engineering\\Sprint 23",
    },
    tags: ["ui", "layout"],
    createdAt: "2026-04-05T10:00:00Z",
    updatedAt: "2026-04-14T16:00:00Z",
    storyPoints: 1,
    availableTransitions: [],
    providerMetadata: {
      provider: "azure-boards",
      rawId: 4155,
      url: "https://dev.azure.com/company/engineering/_workitems/edit/4155",
      raw: {},
    },
  },
  {
    id: "4148",
    title: "Tauri window: custom frameless titlebar with drag region",
    description:
      "<p>Replace the native OS titlebar with a custom one using Tauri's data-tauri-drag-region. Must support window drag, minimize, maximize and close.</p>",
    status: "done",
    type: "task",
    priority: "low",
    assignee: ME,
    reporter: ME,
    iteration: {
      id: "sprint-23",
      name: "Sprint 23",
      path: "Engineering\\Sprint 23",
    },
    tags: ["ui", "tauri", "titlebar"],
    createdAt: "2026-04-03T08:00:00Z",
    updatedAt: "2026-04-13T14:30:00Z",
    storyPoints: 2,
    availableTransitions: [],
    providerMetadata: {
      provider: "azure-boards",
      rawId: 4148,
      url: "https://dev.azure.com/company/engineering/_workitems/edit/4148",
      raw: {},
    },
  },
  {
    id: "4220",
    title: "Add Jira provider adapter",
    description:
      "<p>Implement the Jira Cloud REST API adapter following the same interface as AzureBoardsClient. Support OAuth 2.0 (3LO) auth flow.</p>",
    status: "backlog",
    type: "feature",
    priority: "medium",
    assignee: DEV2,
    reporter: LEAD,
    iteration: {
      id: "sprint-24",
      name: "Sprint 24",
      path: "Engineering\\Sprint 24",
    },
    tags: ["jira", "provider", "v2"],
    createdAt: "2026-04-16T10:00:00Z",
    updatedAt: "2026-04-16T10:00:00Z",
    storyPoints: 13,
    availableTransitions: [{ to: "active", label: "Start" }],
    providerMetadata: {
      provider: "azure-boards",
      rawId: 4220,
      url: "https://dev.azure.com/company/engineering/_workitems/edit/4220",
      raw: {},
    },
  },
];

export const MOCK_AGENTS: AgentDefinition[] = [
  {
    id: "code-reviewer",
    name: "code-reviewer",
    description:
      "Reviews code changes for bugs, security issues, and best practices. Provides structured feedback with severity classification.",
    command: "echo",
    args: ["[mock] code-reviewer agent running..."],
    tags: ["review", "quality", "security"],
    version: "1.0.0",
    source: "registry",
    registryPath: ".opencode/agents/code-reviewer",
  },
  {
    id: "architect",
    name: "architect",
    description:
      "Designs system architecture, evaluates technical decisions, and creates implementation plans for complex features.",
    command: "echo",
    args: ["[mock] architect agent running..."],
    tags: ["architecture", "design", "planning"],
    version: "1.0.0",
    source: "registry",
    registryPath: ".opencode/agents/architect",
  },
  {
    id: "test-engineer",
    name: "test-engineer",
    description:
      "Generates unit tests, integration tests, and e2e test suites. Identifies edge cases and improves test coverage.",
    command: "echo",
    args: ["[mock] test-engineer agent running..."],
    tags: ["testing", "quality", "coverage"],
    version: "1.0.0",
    source: "registry",
    registryPath: ".opencode/agents/test-engineer",
  },
  {
    id: "documentation-writer",
    name: "documentation-writer",
    description:
      "Writes and updates technical documentation, API docs, READMEs, and inline code comments.",
    command: "echo",
    args: ["[mock] documentation-writer agent running..."],
    tags: ["docs", "writing", "api"],
    version: "1.0.0",
    source: "registry",
    registryPath: ".opencode/agents/documentation-writer",
  },
];

export const MOCK_USER = {
  id: "dev-1",
  displayName: "Matheus Peres",
  email: "matheus@company.com",
  avatarUrl: undefined,
};

export const MOCK_MONITORED_APPS: MonitoredApp[] = [
  {
    id: "mock-app-001",
    name: "Payments API",
    dynatraceEntityId: "SERVICE-ABC123",
    grafanaServiceName: "payments-api",
    enabled: true,
    addedAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "mock-app-002",
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
    appId: "mock-app-001",
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
    appId: "mock-app-002",
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
  {
    id: "ins-003",
    appId: "mock-app-001",
    appName: "Payments API",
    source: "grafana",
    severity: "info",
    title: "SLO approaching breach threshold",
    description:
      "Monthly SLO compliance for Payments API is at 99.6%, approaching the 99.5% breach threshold with 6 days remaining in the window.",
    suggestedAction:
      "SLO approaching breach at 99.6% (threshold 99.5%) for Payments API. Review recent error budget consumption and pending deployments.",
    category: "slo-breach",
    detectedAt: "2026-04-25T09:30:00Z",
    status: "seen",
    rawMetric: {
      metricName: "slo_compliance",
      currentValue: 99.6,
      threshold: 99.5,
      unit: "%",
      timeWindowMinutes: 43200,
    },
  },
];
