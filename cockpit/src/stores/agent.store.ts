import { create } from "zustand";
import type {
  AgentExecution,
  AgentDefinition,
  CommandDefinition,
  AsdmRegistry,
} from "../types";

export interface PtySession {
  sessionId: string;
  title: string;
}

export interface PendingPtySpawn {
  sessionId: string;
  command: string;
  args: string[];
  cwd: string | null;
  envVars: Record<string, string>;
  cols: number;
  rows: number;
}

interface AgentStore {
  registries: AsdmRegistry[];
  agents: AgentDefinition[];
  commands: CommandDefinition[];
  activeExecution: AgentExecution | null;
  executionHistory: AgentExecution[];
  isPanelOpen: boolean;
  panelHeight: number;
  ptySessions: Record<string, PtySession>;
  activePtySessionId: string | null;
  pendingPtySpawn: PendingPtySpawn | null;

  setRegistries: (registries: AsdmRegistry[]) => void;
  setAgents: (agents: AgentDefinition[]) => void;
  setCommands: (commands: CommandDefinition[]) => void;
  startExecution: (execution: AgentExecution) => void;
  appendLog: (executionId: string, log: AgentExecution["logs"][number]) => void;
  finishExecution: (executionId: string, exitCode: number) => void;
  cancelExecution: (executionId: string) => void;
  clearActiveExecution: () => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setPanelHeight: (height: number) => void;
  openPtySession: (sessionId: string, title?: string) => void;
  closePtySession: (sessionId: string) => void;
  setActivePtySession: (sessionId: string | null) => void;
  setPendingPtySpawn: (spawn: PendingPtySpawn | null) => void;
}

export const useAgentStore = create<AgentStore>()((set) => ({
  registries: [],
  agents: [],
  commands: [],
  activeExecution: null,
  executionHistory: [],
  isPanelOpen: false,
  panelHeight: 280,
  ptySessions: {},
  activePtySessionId: null,
  pendingPtySpawn: null,

  setRegistries: (registries) => set({ registries }),
  setAgents: (agents) => set({ agents }),
  setCommands: (commands) => set({ commands }),

  startExecution: (execution) =>
    set({ activeExecution: execution, isPanelOpen: true }),

  appendLog: (executionId, log) =>
    set((prev) => {
      if (prev.activeExecution?.id !== executionId) return prev;
      return {
        activeExecution: {
          ...prev.activeExecution,
          logs: [...prev.activeExecution.logs, log],
        },
      };
    }),

  finishExecution: (executionId, exitCode) =>
    set((prev) => {
      if (prev.activeExecution?.id !== executionId) return prev;
      const finished: AgentExecution = {
        ...prev.activeExecution,
        status: exitCode === 0 ? "success" : "error",
        exitCode,
        finishedAt: new Date().toISOString(),
      };
      return {
        activeExecution: finished,
        executionHistory: [finished, ...prev.executionHistory].slice(0, 50),
      };
    }),

  cancelExecution: (executionId) =>
    set((prev) => {
      if (prev.activeExecution?.id !== executionId) return prev;
      return {
        activeExecution: {
          ...prev.activeExecution,
          status: "cancelled",
          finishedAt: new Date().toISOString(),
        },
      };
    }),

  clearActiveExecution: () => set({ activeExecution: null }),
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  togglePanel: () => set((prev) => ({ isPanelOpen: !prev.isPanelOpen })),
  setPanelHeight: (height) => set({ panelHeight: height }),

  openPtySession: (sessionId, title) =>
    set((prev) => {
      const count = Object.keys(prev.ptySessions).length + 1;
      return {
        ptySessions: {
          ...prev.ptySessions,
          [sessionId]: {
            sessionId,
            title: title ?? `Terminal ${count}`,
          },
        },
      };
    }),

  closePtySession: (sessionId) =>
    set((prev) => {
      const next = { ...prev.ptySessions };
      delete next[sessionId];
      return {
        ptySessions: next,
        activePtySessionId:
          prev.activePtySessionId === sessionId
            ? null
            : prev.activePtySessionId,
      };
    }),

  setActivePtySession: (sessionId) => set({ activePtySessionId: sessionId }),
  setPendingPtySpawn: (spawn) => set({ pendingPtySpawn: spawn }),
}));
