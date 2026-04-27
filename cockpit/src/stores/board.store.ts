import { create } from "zustand";
import type { WorkItem, WorkItemFilter, Sprint } from "../types";

interface BoardStore {
  workItems: WorkItem[];
  selectedWorkItemId: string | null;
  filter: WorkItemFilter;
  sprints: Sprint[];
  activeSprint: Sprint | null;
  isLoading: boolean;
  error: string | null;

  setWorkItems: (items: WorkItem[]) => void;
  selectWorkItem: (id: string | null) => void;
  setFilter: (filter: Partial<WorkItemFilter>) => void;
  clearFilter: () => void;
  setSprints: (sprints: Sprint[]) => void;
  setActiveSprint: (sprint: Sprint | null) => void;
  updateWorkItemStatus: (id: string, newStatus: WorkItem["status"]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useBoardStore = create<BoardStore>()((set) => ({
  workItems: [],
  selectedWorkItemId: null,
  filter: {},
  sprints: [],
  activeSprint: null,
  isLoading: false,
  error: null,

  setWorkItems: (items) => set({ workItems: items }),
  selectWorkItem: (id) => set({ selectedWorkItemId: id }),
  setFilter: (filter) =>
    set((prev) => ({ filter: { ...prev.filter, ...filter } })),
  clearFilter: () => set({ filter: {} }),
  setSprints: (sprints) => set({ sprints }),
  setActiveSprint: (sprint) => set({ activeSprint: sprint }),
  updateWorkItemStatus: (id, newStatus) =>
    set((prev) => ({
      workItems: prev.workItems.map((item) =>
        item.id === id ? { ...item, status: newStatus } : item
      ),
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
