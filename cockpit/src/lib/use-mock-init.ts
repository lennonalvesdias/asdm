import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore, useBoardStore, useAgentStore } from "../stores";
import { useObservabilityStore } from "../stores/observability.store";
import {
  MOCK_WORK_ITEMS,
  MOCK_SPRINTS,
  MOCK_AGENTS,
  MOCK_USER,
  MOCK_MONITORED_APPS,
  MOCK_INSIGHTS,
} from "./mock-data";
import type { CommandDefinition } from "../types";

/**
 * Initializes all stores with mock data.
 * Call this hook once in App.tsx when VITE_MOCK_MODE=true.
 * Commands are always loaded from real files via Tauri (no mocking needed).
 */
export function useMockInit() {
  const { setAuthenticated } = useAuthStore();
  const { setWorkItems, setSprints, setActiveSprint } = useBoardStore();
  const { setAgents, setCommands } = useAgentStore();
  const { setInsights, setMonitoredApps } = useObservabilityStore();

  useEffect(() => {
    // Auth
    setAuthenticated({
      isAuthenticated: true,
      provider: "azure-boards",
      user: MOCK_USER,
      tokens: {
        accessToken: "mock-token",
        refreshToken: "mock-refresh",
        expiresAt: Date.now() + 3600_000,
        tokenType: "Bearer",
        scope: "vso.work_write",
      },
    });

    // Board
    setWorkItems(MOCK_WORK_ITEMS);
    setSprints(MOCK_SPRINTS);
    setActiveSprint(MOCK_SPRINTS.find((s) => s.status === "current") ?? null);

    // Agents
    setAgents(MOCK_AGENTS);

    // Observability
    setMonitoredApps(MOCK_MONITORED_APPS);
    setInsights(MOCK_INSIGHTS);

    // Commands — always load from real files, no mock needed
    invoke<CommandDefinition[]>("load_opencode_commands")
      .then((cmds) => setCommands(cmds))
      .catch(() => setCommands([]));
  }, []);
}
