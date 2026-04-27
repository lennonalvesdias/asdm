import { useBoardStore, useAuthStore } from "../../stores";
import { StatusBadge, TypeBadge } from "../../components/ui";
import { cn } from "../../lib";
import { Search, RefreshCw, ChevronRight, User } from "lucide-react";
import { useState, useMemo } from "react";
import type { WorkItem, WorkItemStatus } from "../../types";

const STATUS_ORDER: WorkItemStatus[] = [
  "active",
  "code-review",
  "testing",
  "blocked",
  "backlog",
  "done",
];

interface SprintViewProps {
  filterMyTasks?: boolean;
}

export function SprintView({ filterMyTasks }: SprintViewProps) {
  const {
    workItems,
    selectedWorkItemId,
    selectWorkItem,
    isLoading,
    activeSprint,
    filter,
    setFilter,
  } = useBoardStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState(filter.searchQuery ?? "");

  const filtered = useMemo(() => {
    let items = workItems;
    if (filterMyTasks && user) {
      items = items.filter((wi) => wi.assignee?.email === user.email);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (wi) =>
          wi.title.toLowerCase().includes(q) ||
          wi.id.includes(q) ||
          wi.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (filter.status && filter.status.length > 0) {
      items = items.filter((wi) => filter.status!.includes(wi.status));
    }
    return items;
  }, [workItems, filterMyTasks, user, search, filter]);

  const grouped = useMemo(() => {
    const map = new Map<WorkItemStatus, WorkItem[]>();
    for (const status of STATUS_ORDER) {
      const group = filtered.filter((wi) => wi.status === status);
      if (group.length > 0) map.set(status, group);
    }
    return map;
  }, [filtered]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setFilter({ searchQuery: value || undefined });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-surface-700)] bg-[var(--color-surface-800)] flex-shrink-0">
        <div className="flex-1">
          <div className="text-xs font-semibold text-[var(--color-surface-50)]">
            {filterMyTasks ? "My Tasks" : activeSprint ? activeSprint.name : "Sprint"}
          </div>
          {activeSprint && !filterMyTasks && (
            <div className="text-[10px] text-[var(--color-surface-400)] mt-0.5">
              {new Date(activeSprint.startDate).toLocaleDateString()} –{" "}
              {new Date(activeSprint.finishDate).toLocaleDateString()} ·{" "}
              {filtered.length} items
            </div>
          )}
        </div>
        <button
          onClick={() => {}}
          className="p-1.5 rounded text-[var(--color-surface-400)] hover:text-[var(--color-surface-100)] hover:bg-[var(--color-surface-600)] transition-colors"
          title="Refresh"
        >
          <RefreshCw size={13} className={cn(isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[var(--color-surface-700)] flex-shrink-0">
        <div className="flex items-center gap-2 bg-[var(--color-surface-700)] rounded px-2.5 py-1.5">
          <Search size={12} className="text-[var(--color-surface-400)] flex-shrink-0" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="bg-transparent text-xs text-[var(--color-surface-100)] placeholder:text-[var(--color-surface-400)] outline-none flex-1 min-w-0"
          />
        </div>
      </div>

      {/* Work items list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && workItems.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[var(--color-surface-400)] text-xs">
            Loading work items...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-1">
            <div className="text-[var(--color-surface-400)] text-xs">No tasks found</div>
            {search && (
              <button
                onClick={() => handleSearch("")}
                className="text-[10px] text-[var(--color-accent-400)] hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div>
            {[...grouped.entries()].map(([status, items]) => (
              <div key={status}>
                {/* Status group header */}
                <div className="sticky top-0 flex items-center gap-2 px-3 py-1 bg-[var(--color-surface-800)] border-b border-[var(--color-surface-700)] z-[1]">
                  <StatusBadge status={status} />
                  <span className="text-[10px] text-[var(--color-surface-400)]">
                    {items.length}
                  </span>
                </div>

                {/* Items */}
                {items.map((item) => (
                  <WorkItemRow
                    key={item.id}
                    item={item}
                    isSelected={selectedWorkItemId === item.id}
                    onSelect={() => selectWorkItem(item.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface WorkItemRowProps {
  item: WorkItem;
  isSelected: boolean;
  onSelect: () => void;
}

function WorkItemRow({ item, isSelected, onSelect }: WorkItemRowProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-start gap-2.5 px-3 py-2.5 text-left border-b border-[var(--color-surface-700)]/50 transition-colors group",
        isSelected
          ? "bg-[var(--color-surface-600)]"
          : "hover:bg-[var(--color-surface-700)]/60"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <TypeBadge type={item.type} />
          <span className="text-[10px] text-[var(--color-surface-400)]">#{item.id}</span>
        </div>
        <div className="text-xs text-[var(--color-surface-100)] line-clamp-2 leading-snug">
          {item.title}
        </div>
        {(item.storyPoints || item.assignee) && (
          <div className="flex items-center gap-2 mt-1">
            {item.storyPoints && (
              <span className="text-[10px] text-[var(--color-surface-400)]">
                {item.storyPoints} pts
              </span>
            )}
            {item.assignee && (
              <div className="flex items-center gap-1 text-[10px] text-[var(--color-surface-400)]">
                <User size={9} />
                <span className="truncate max-w-[80px]">{item.assignee.displayName}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <ChevronRight
        size={12}
        className={cn(
          "flex-shrink-0 mt-0.5 transition-colors",
          isSelected
            ? "text-[var(--color-accent-400)]"
            : "text-[var(--color-surface-600)] group-hover:text-[var(--color-surface-400)]"
        )}
      />
    </button>
  );
}
