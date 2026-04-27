import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./stores";
import { useUiStore } from "./stores/ui.store";
import { useAgentStore } from "./stores/agent.store";
import { AppShell } from "./components/layout";
import { AuthView } from "./features/auth/AuthView";
import { useMockInit } from "./lib";
import { invoke } from "@tauri-apps/api/core";
import type { CommandDefinition } from "./types";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const IS_MOCK = import.meta.env.VITE_MOCK_MODE === "true";

/** Applies document zoom and wires keyboard shortcuts (Cmd/Ctrl +/-/0). */
function ZoomController() {
  const zoomLevel = useUiStore((s) => s.zoomLevel);
  const zoomIn = useUiStore((s) => s.zoomIn);
  const zoomOut = useUiStore((s) => s.zoomOut);
  const resetZoom = useUiStore((s) => s.resetZoom);

  useEffect(() => {
    document.documentElement.style.zoom = String(zoomLevel);
  }, [zoomLevel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [zoomIn, zoomOut, resetZoom]);

  return null;
}

/** Applies data-theme attribute to <html> based on store value. */
function ThemeController() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme === "light" ? "light" : "";
  }, [theme]);
  return null;
}

function AppContent() {
  useMockInit();
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <AppShell /> : <AuthView />;
}

function AppContentReal() {
  const { isAuthenticated } = useAuthStore();
  const setCommands = useAgentStore((s) => s.setCommands);

  useEffect(() => {
    invoke<CommandDefinition[]>("load_opencode_commands")
      .then((cmds) => setCommands(cmds))
      .catch((err) =>
        console.warn("Could not load local opencode commands:", err),
      );
  }, [setCommands]);

  return isAuthenticated ? <AppShell /> : <AuthView />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ZoomController />
      <ThemeController />
      {IS_MOCK ? <AppContent /> : <AppContentReal />}
    </QueryClientProvider>
  );
}
