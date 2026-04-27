export type TriggerType =
  | "status-changed"
  | "assignee-changed"
  | "comment-added"
  | "pr-opened"
  | "pr-merged"
  | "pipeline-completed"
  | "manual";

export type ConditionOperator = "eq" | "neq" | "contains" | "gt" | "lt" | "gte" | "lte";

export type ActionType =
  | "change-status"
  | "assign-to"
  | "add-comment"
  | "run-agent"
  | "send-notification"
  | "create-pr"
  | "trigger-pipeline";

export interface WorkflowTrigger {
  type: TriggerType;
  config?: Record<string, unknown>;
}

export interface WorkflowCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export interface WorkflowAction {
  type: ActionType;
  config: Record<string, unknown>;
  label?: string;
}

export interface WorkflowRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  runCount: number;
  lastRunAt?: string;
}

export interface WorkflowStage {
  id: string;
  name: string;
  status: string; // maps to WorkItemStatus
  color: string;
  order: number;
  gates: StageGate[];
  entryAutomations: WorkflowAction[];
  exitAutomations: WorkflowAction[];
}

export interface StageGate {
  id: string;
  type: "required-field" | "approval" | "pr-approved" | "pipeline-green" | "coverage" | "custom";
  label: string;
  config: Record<string, unknown>;
  blocking: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  projectId: string;
  stages: WorkflowStage[];
  rules: WorkflowRule[];
  createdBy: string;
  updatedAt: string;
}

export type UserRole = "admin" | "tech-lead" | "developer" | "viewer";

export interface TeamMember {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  currentWorkItems: string[];
}
