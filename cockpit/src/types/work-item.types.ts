export type WorkItemStatus =
  | "backlog"
  | "active"
  | "code-review"
  | "testing"
  | "done"
  | "blocked";

export type WorkItemType =
  | "user-story"
  | "bug"
  | "task"
  | "epic"
  | "feature"
  | "impediment";

export type WorkItemPriority = "critical" | "high" | "medium" | "low";

export interface WorkItemAssignee {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}

export interface WorkItemIteration {
  id: string;
  name: string;
  path: string;
  startDate?: string;
  finishDate?: string;
}

export interface WorkItemTransition {
  to: WorkItemStatus;
  label: string;
  requiresComment?: boolean;
  gates?: WorkItemGate[];
}

export interface WorkItemGate {
  type: "pr-approved" | "pipeline-green" | "coverage-threshold" | "manual";
  label: string;
  passed: boolean;
  value?: string | number;
}

export interface WorkItemComment {
  id: string;
  author: WorkItemAssignee;
  text: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkItem {
  id: string;
  title: string;
  description?: string;
  status: WorkItemStatus;
  type: WorkItemType;
  priority: WorkItemPriority;
  assignee?: WorkItemAssignee;
  reporter?: WorkItemAssignee;
  iteration?: WorkItemIteration;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  estimatedHours?: number;
  remainingHours?: number;
  completedHours?: number;
  parentId?: string;
  childIds?: string[];
  storyPoints?: number;
  availableTransitions: WorkItemTransition[];
  comments?: WorkItemComment[];
  attachments?: WorkItemAttachment[];
  // Raw data from provider for fidelity
  providerMetadata: {
    provider: "azure-boards" | "jira" | "trello";
    rawId: string | number;
    url: string;
    raw: Record<string, unknown>;
  };
}

export interface WorkItemAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  createdAt: string;
}

export interface WorkItemFilter {
  status?: WorkItemStatus[];
  type?: WorkItemType[];
  priority?: WorkItemPriority[];
  assigneeId?: string;
  iterationId?: string;
  searchQuery?: string;
  tags?: string[];
}

export interface Sprint {
  id: string;
  name: string;
  path: string;
  startDate: string;
  finishDate: string;
  status: "past" | "current" | "future";
}
