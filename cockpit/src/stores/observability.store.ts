import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import type {
  MonitoredApp,
  ObservabilityInsight,
  InsightStatus,
  MonitoringState,
} from "../types";

interface ObservabilityStore {
  monitoredApps: MonitoredApp[];
  pollingIntervalMinutes: number;
  insights: ObservabilityInsight[];
  monitoringState: MonitoringState;

  unreadCount: () => number;

  addApp: (app: Omit<MonitoredApp, "id" | "addedAt">) => void;
  removeApp: (id: string) => void;
  toggleApp: (id: string) => void;
  updateApp: (id: string, patch: Partial<MonitoredApp>) => void;
  setMonitoredApps: (apps: MonitoredApp[]) => void;

  setInsights: (insights: ObservabilityInsight[]) => void;
  appendInsights: (insights: ObservabilityInsight[]) => void;
  updateInsightStatus: (id: string, status: InsightStatus) => void;
  markAllSeen: () => void;
  dismissAll: () => void;

  setMonitoringState: (patch: Partial<MonitoringState>) => void;
  setPollingInterval: (minutes: number) => void;
}

const DEFAULT_MONITORING_STATE: MonitoringState = {
  lastScanAt: null,
  lastScanStatus: "idle",
  nextScheduledAt: null,
  isScanning: false,
};

export const useObservabilityStore = create<ObservabilityStore>()(
  persist(
    (set, get) => ({
      monitoredApps: [],
      pollingIntervalMinutes: 15,
      insights: [],
      monitoringState: DEFAULT_MONITORING_STATE,

      unreadCount: () =>
        get().insights.filter((i) => i.status === "new").length,

      addApp: (app) =>
        set((s) => ({
          monitoredApps: [
            ...s.monitoredApps,
            { ...app, id: nanoid(), addedAt: new Date().toISOString() },
          ],
        })),

      removeApp: (id) =>
        set((s) => ({
          monitoredApps: s.monitoredApps.filter((a) => a.id !== id),
        })),

      toggleApp: (id) =>
        set((s) => ({
          monitoredApps: s.monitoredApps.map((a) =>
            a.id === id ? { ...a, enabled: !a.enabled } : a,
          ),
        })),

      updateApp: (id, patch) =>
        set((s) => ({
          monitoredApps: s.monitoredApps.map((a) =>
            a.id === id ? { ...a, ...patch } : a,
          ),
        })),

      setMonitoredApps: (apps) => set({ monitoredApps: apps }),

      setInsights: (insights) => set({ insights }),

      appendInsights: (newInsights) =>
        set((s) => {
          const existingIds = new Set(s.insights.map((i) => i.id));
          const fresh = newInsights.filter((i) => !existingIds.has(i.id));
          return { insights: [...fresh, ...s.insights].slice(0, 500) };
        }),

      updateInsightStatus: (id, status) =>
        set((s) => ({
          insights: s.insights.map((i) => (i.id === id ? { ...i, status } : i)),
        })),

      markAllSeen: () =>
        set((s) => ({
          insights: s.insights.map((i) =>
            i.status === "new" ? { ...i, status: "seen" as InsightStatus } : i,
          ),
        })),

      dismissAll: () =>
        set((s) => ({
          insights: s.insights.map((i) =>
            i.status !== "acted"
              ? { ...i, status: "dismissed" as InsightStatus }
              : i,
          ),
        })),

      setMonitoringState: (patch) =>
        set((s) => ({ monitoringState: { ...s.monitoringState, ...patch } })),

      setPollingInterval: (minutes) => set({ pollingIntervalMinutes: minutes }),
    }),
    {
      name: "cockpit-observability",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        monitoredApps: state.monitoredApps,
        pollingIntervalMinutes: state.pollingIntervalMinutes,
      }),
    },
  ),
);
