import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ActiveView =
  | "my-tasks"
  | "dashboard"
  | "settings"
  | "workflow"
  | "reviews"
  | "radar";

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;
const MIN_DETAIL_WIDTH = 280;
const MAX_DETAIL_WIDTH = 900;

interface UiStore {
  activeView: ActiveView;
  sidebarWidth: number;
  isSidebarCollapsed: boolean;
  theme: "dark" | "light";
  zoomLevel: number;
  detailPanelWidth: number;

  setActiveView: (view: ActiveView) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  setTheme: (theme: "dark" | "light") => void;
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setDetailPanelWidth: (width: number) => void;
}

function clampZoom(value: number): number {
  return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)) * 10) / 10;
}

function clampDetailWidth(value: number): number {
  return Math.min(
    MAX_DETAIL_WIDTH,
    Math.max(MIN_DETAIL_WIDTH, Math.round(value)),
  );
}

export const useUiStore = create<UiStore>()(
  persist(
    (set, get) => ({
      activeView: "my-tasks",
      sidebarWidth: 260,
      isSidebarCollapsed: false,
      theme: "dark",
      zoomLevel: 1.0,
      detailPanelWidth: 500,

      setActiveView: (view) => set({ activeView: view }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      toggleSidebar: () =>
        set((prev) => ({ isSidebarCollapsed: !prev.isSidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
      setZoomLevel: (level) => set({ zoomLevel: clampZoom(level) }),
      zoomIn: () => set({ zoomLevel: clampZoom(get().zoomLevel + ZOOM_STEP) }),
      zoomOut: () => set({ zoomLevel: clampZoom(get().zoomLevel - ZOOM_STEP) }),
      resetZoom: () => set({ zoomLevel: 1.0 }),
      setDetailPanelWidth: (width) =>
        set({ detailPanelWidth: clampDetailWidth(width) }),
    }),
    {
      name: "cockpit-ui",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
