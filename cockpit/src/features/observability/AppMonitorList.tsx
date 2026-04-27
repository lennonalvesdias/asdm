import { useState } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { useObservabilityStore } from "../../stores/observability.store";
import type { MonitoredApp } from "../../types";

export function AppMonitorList() {
  const { monitoredApps, addApp, removeApp, toggleApp } =
    useObservabilityStore();

  const [form, setForm] = useState<{
    name: string;
    dynatraceEntityId: string;
    grafanaServiceName: string;
  }>({ name: "", dynatraceEntityId: "", grafanaServiceName: "" });
  const [adding, setAdding] = useState(false);

  const handleAdd = () => {
    if (!form.name.trim()) return;
    addApp({
      name: form.name.trim(),
      dynatraceEntityId: form.dynatraceEntityId.trim() || undefined,
      grafanaServiceName: form.grafanaServiceName.trim() || undefined,
      enabled: true,
    });
    setForm({ name: "", dynatraceEntityId: "", grafanaServiceName: "" });
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      {monitoredApps.length === 0 && !adding && (
        <p className="text-[11px] text-[var(--color-surface-500)] py-2">
          No apps configured. Add one to start monitoring.
        </p>
      )}

      {monitoredApps.map((app: MonitoredApp) => (
        <div
          key={app.id}
          className="flex items-center gap-2.5 bg-[var(--color-surface-700)] rounded p-2.5"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-surface-100)] truncate">
                {app.name}
              </span>
              {!app.enabled && (
                <span className="text-[9px] bg-[var(--color-surface-600)] text-[var(--color-surface-400)] px-1.5 py-0.5 rounded-full">
                  disabled
                </span>
              )}
            </div>
            <div className="text-[10px] text-[var(--color-surface-500)] mt-0.5 space-x-2">
              {app.dynatraceEntityId && (
                <span>DT: {app.dynatraceEntityId}</span>
              )}
              {app.grafanaServiceName && (
                <span>Grafana: {app.grafanaServiceName}</span>
              )}
            </div>
          </div>

          <button
            onClick={() => toggleApp(app.id)}
            className={cn(
              "flex-shrink-0 transition-colors",
              app.enabled
                ? "text-[var(--color-accent-400)] hover:text-[var(--color-accent-300)]"
                : "text-[var(--color-surface-500)] hover:text-[var(--color-surface-300)]",
            )}
            title={app.enabled ? "Disable" : "Enable"}
          >
            {app.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          </button>

          <button
            onClick={() => removeApp(app.id)}
            className="flex-shrink-0 p-1 text-[var(--color-surface-500)] hover:text-[var(--color-danger-400)] transition-colors rounded"
            title="Remove"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="bg-[var(--color-surface-700)] rounded p-3 space-y-2">
          <input
            type="text"
            placeholder="App name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
            className="w-full bg-[var(--color-surface-600)] text-xs text-[var(--color-surface-100)] placeholder:text-[var(--color-surface-500)] border border-[var(--color-surface-500)] rounded px-2.5 py-1.5 outline-none focus:border-[var(--color-accent-500)] transition-colors"
          />
          <input
            type="text"
            placeholder="Dynatrace entity ID (e.g. SERVICE-ABC123)"
            value={form.dynatraceEntityId}
            onChange={(e) =>
              setForm((f) => ({ ...f, dynatraceEntityId: e.target.value }))
            }
            className="w-full bg-[var(--color-surface-600)] text-xs text-[var(--color-surface-100)] placeholder:text-[var(--color-surface-500)] border border-[var(--color-surface-600)] rounded px-2.5 py-1.5 outline-none focus:border-[var(--color-accent-500)] transition-colors"
          />
          <input
            type="text"
            placeholder="Grafana service name"
            value={form.grafanaServiceName}
            onChange={(e) =>
              setForm((f) => ({ ...f, grafanaServiceName: e.target.value }))
            }
            className="w-full bg-[var(--color-surface-600)] text-xs text-[var(--color-surface-100)] placeholder:text-[var(--color-surface-500)] border border-[var(--color-surface-600)] rounded px-2.5 py-1.5 outline-none focus:border-[var(--color-accent-500)] transition-colors"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1 text-[11px] text-[var(--color-surface-400)] hover:text-[var(--color-surface-200)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!form.name.trim()}
              className="flex items-center gap-1.5 px-3 py-1 bg-[var(--color-accent-600)] hover:bg-[var(--color-accent-500)] disabled:opacity-50 rounded text-[11px] font-medium text-white transition-colors"
            >
              <Plus size={11} />
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[var(--color-surface-400)] hover:text-[var(--color-surface-200)] hover:bg-[var(--color-surface-700)] rounded transition-colors"
        >
          <Plus size={12} />
          Add app
        </button>
      )}
    </div>
  );
}
