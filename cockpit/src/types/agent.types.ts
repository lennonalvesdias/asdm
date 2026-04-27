export type AgentStatus =
  | "idle"
  | "running"
  | "success"
  | "error"
  | "cancelled";

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  command: string;
  args?: string[];
  tags: string[];
  version: string;
  source: "registry" | "local";
  registryPath?: string;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  filePath: string;
  tags: string[];
}

export interface CommandDefinition {
  id: string;
  name: string;
  description: string;
  command: string;
  filePath: string;
  args?: string[];
  tags: string[];
  tagsAction: string[];
}

export interface AgentContext {
  workItemId?: string;
  workItemTitle?: string;
  workItemDescription?: string;
  workItemType?: string;
  repoPath?: string;
  branch?: string;
  additionalContext?: string;
  skills?: string[];
}

export interface AgentExecutionLog {
  timestamp: string;
  type: "stdout" | "stderr" | "system";
  content: string;
}

export interface AgentExecution {
  id: string;
  agentId: string;
  agentName: string;
  workItemId?: string;
  status: AgentStatus;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  logs: AgentExecutionLog[];
  context: AgentContext;
}

export interface AsdmRegistry {
  id: string;
  name: string;
  gitUrl: string;
  branch: string;
  localPath: string;
  lastSyncAt?: string;
  agents: AgentDefinition[];
  skills: SkillDefinition[];
  commands: CommandDefinition[];
}
