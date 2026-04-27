import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  GitBranch,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import { useGitHubStore } from "../../stores/github.store";
import { useUiStore } from "../../stores/ui.store";
import { cn } from "../../lib/cn";
import type { AuthState } from "../../types";

// ---------------------------------------------------------------------------
// Sub-component helpers
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-surface-300)] mb-3 px-1">
        {title}
      </h3>
      <div className="bg-[var(--color-surface-800)] rounded-lg border border-[var(--color-surface-700)] overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4 border-b border-[var(--color-surface-700)] last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm text-[var(--color-surface-50)]">{label}</p>
        {description && (
          <p className="text-xs text-[var(--color-surface-300)] mt-0.5">
            {description}
          </p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
        ok
          ? "bg-green-500/15 text-green-400 border border-green-500/30"
          : "bg-[var(--color-surface-700)] text-[var(--color-surface-300)] border border-[var(--color-surface-600)]",
      )}
    >
      <span
        className={cn(
          "inline-block w-1.5 h-1.5 rounded-full",
          ok ? "bg-green-400" : "bg-[var(--color-surface-400)]",
        )}
      />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SettingsView() {
  const { isAuthenticated, user, provider, logout } = useAuthStore();
  const {
    pat: ghPat,
    accessToken: ghAccessToken,
    user: ghUser,
    setPat: setGhPat,
    setAccessToken: setGhAccessToken,
    setUser: setGhUser,
    clearGitHub,
  } = useGitHubStore();
  const { theme, setTheme, zoomLevel, zoomIn, zoomOut, resetZoom } =
    useUiStore();

  // ---- GitHub PAT state ---------------------------------------------------
  const [ghPatInput, setGhPatInput] = useState(ghPat ?? "");
  const [ghPatLoading, setGhPatLoading] = useState(false);
  const [ghPatError, setGhPatError] = useState<string | null>(null);
  const [showGhPat, setShowGhPat] = useState(false);

  // ---- GitHub CLI auth state ----------------------------------------------
  const [ghCliLoading, setGhCliLoading] = useState(false);
  const [ghCliError, setGhCliError] = useState<string | null>(null);

  // ---- Azure PAT state ----------------------------------------------------
  const [azurePatInput, setAzurePatInput] = useState("");
  const [azurePatLoading, setAzurePatLoading] = useState(false);
  const [azurePatError, setAzurePatError] = useState<string | null>(null);
  const [showAzurePat, setShowAzurePat] = useState(false);

  // ---- Azure OAuth state --------------------------------------------------
  const [azureClientId, setAzureClientId] = useState("");
  const [azureTenantId, setAzureTenantId] = useState("common");
  const [azurePort, setAzurePort] = useState("7890");
  const [azureOAuthLoading, setAzureOAuthLoading] = useState(false);
  const [azureOAuthError, setAzureOAuthError] = useState<string | null>(null);

  // ---- Registry state -----------------------------------------------------
  const [registries, setRegistries] = useState<string[]>([]);
  const [newRegistryUrl, setNewRegistryUrl] = useState("");
  const [registrySyncing, setRegistrySyncing] = useState<string | null>(null);

  // =========================================================================
  // GitHub PAT handlers
  // =========================================================================
  async function saveGhPat() {
    if (!ghPatInput.trim()) return;
    setGhPatLoading(true);
    setGhPatError(null);
    try {
      const profile = await invoke<{
        login: string;
        name: string;
        email: string;
        avatar_url: string;
      }>("get_github_user", { pat: ghPatInput.trim() });
      setGhPat(ghPatInput.trim());
      setGhUser({
        login: profile.login,
        name: profile.name ?? profile.login,
        avatar_url: profile.avatar_url,
        html_url: "",
      });
    } catch (e) {
      setGhPatError(String(e));
    } finally {
      setGhPatLoading(false);
    }
  }

  // =========================================================================
  // GitHub CLI auth handler
  // =========================================================================
  async function connectGithubCli() {
    setGhCliLoading(true);
    setGhCliError(null);
    try {
      const token = await invoke<string>("connect_github_cli");
      setGhAccessToken(token);
      try {
        const profile = await invoke<{
          login: string;
          name: string;
          email: string;
          avatar_url: string;
        }>("get_github_user", { pat: token });
        setGhUser({
          login: profile.login,
          name: profile.name ?? profile.login,
          avatar_url: profile.avatar_url,
          html_url: "",
        });
      } catch {
        // profile fetch is non-critical — token was saved
      }
    } catch (e) {
      setGhCliError(String(e));
    } finally {
      setGhCliLoading(false);
    }
  }

  function disconnectGitHub() {
    clearGitHub();
    setGhPatInput("");
  }

  // =========================================================================
  // Azure PAT handlers
  // =========================================================================
  async function connectAzurePat() {
    if (!azurePatInput.trim()) return;
    setAzurePatLoading(true);
    setAzurePatError(null);
    try {
      const profile = await invoke<{
        id: string;
        displayName: string;
        emailAddress: string;
        publicAlias: string;
      }>("get_azure_user_profile", { accessToken: azurePatInput.trim() });
      const authState: AuthState = {
        isAuthenticated: true,
        provider: "azure-boards",
        user: {
          id: profile.id ?? profile.publicAlias,
          displayName: profile.displayName,
          email: profile.emailAddress,
        },
        tokens: {
          accessToken: azurePatInput.trim(),
          tokenType: "PAT",
          expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
          scope: "",
        },
      };
      useAuthStore.getState().setAuthenticated(authState);
    } catch (e) {
      setAzurePatError(String(e));
    } finally {
      setAzurePatLoading(false);
    }
  }

  // =========================================================================
  // Azure OAuth handler
  // =========================================================================
  async function connectAzureOAuth() {
    if (!azureClientId.trim()) {
      setAzureOAuthError("Enter your Azure App (client) ID first.");
      return;
    }
    setAzureOAuthLoading(true);
    setAzureOAuthError(null);
    try {
      const result = await invoke<{
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      }>("start_oauth", {
        clientId: azureClientId.trim(),
        tenantId: azureTenantId.trim() || "common",
        redirectPort: parseInt(azurePort) || 7890,
      });
      const profile = await invoke<{
        id: string;
        displayName: string;
        emailAddress: string;
        publicAlias: string;
      }>("get_azure_user_profile", { accessToken: result.access_token });
      const authState: AuthState = {
        isAuthenticated: true,
        provider: "azure-boards",
        user: {
          id: profile.id ?? profile.publicAlias,
          displayName: profile.displayName,
          email: profile.emailAddress,
        },
        tokens: {
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
          tokenType: "Bearer",
          expiresAt: Date.now() + result.expires_in * 1000,
          scope: "",
        },
      };
      useAuthStore.getState().setAuthenticated(authState);
    } catch (e) {
      setAzureOAuthError(String(e));
    } finally {
      setAzureOAuthLoading(false);
    }
  }

  // =========================================================================
  // Registry handlers
  // =========================================================================
  async function addRegistry() {
    if (!newRegistryUrl.trim()) return;
    try {
      await invoke("sync_registry", { registryUrl: newRegistryUrl.trim() });
      setRegistries((prev) => [...prev, newRegistryUrl.trim()]);
      setNewRegistryUrl("");
    } catch (e) {
      console.error("Failed to add registry:", e);
    }
  }

  async function syncRegistry(url: string) {
    setRegistrySyncing(url);
    try {
      await invoke("sync_registry", { registryUrl: url });
    } catch (e) {
      console.error("Failed to sync registry:", e);
    } finally {
      setRegistrySyncing(null);
    }
  }

  function removeRegistry(url: string) {
    setRegistries((prev) => prev.filter((r) => r !== url));
  }

  // =========================================================================
  // Derived state
  // =========================================================================
  const ghConnected = !!(ghPat || ghAccessToken);
  const ghDisplayName = ghUser?.name ?? ghUser?.login ?? null;
  const azureConnected = isAuthenticated && provider === "azure-boards";

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="h-full overflow-y-auto bg-[var(--color-surface-900)]">
      <div className="max-w-2xl mx-auto px-6 py-6">
        <h2 className="text-base font-semibold text-[var(--color-surface-50)] mb-6">
          Settings
        </h2>

        {/* ---------------------------------------------------------------- */}
        {/* ACCOUNT                                                          */}
        {/* ---------------------------------------------------------------- */}
        <Section title="Account">
          {azureConnected && user ? (
            <div className="px-4 py-3 flex items-center gap-3">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-9 h-9 rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[var(--color-accent-500)] flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
                  {user.displayName?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--color-surface-50)] truncate">
                  {user.displayName}
                </p>
                <p className="text-xs text-[var(--color-surface-300)] truncate">
                  {user.email}
                </p>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 text-xs text-[var(--color-surface-300)] hover:text-red-400 transition-colors"
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-[var(--color-surface-300)]">
              Not signed in. Connect Azure DevOps below.
            </div>
          )}
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* APPEARANCE                                                       */}
        {/* ---------------------------------------------------------------- */}
        <Section title="Appearance">
          <Row label="Theme">
            <div className="flex items-center gap-1.5 bg-[var(--color-surface-700)] rounded-lg p-0.5">
              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  theme === "dark" || !theme
                    ? "bg-[var(--color-surface-500)] text-[var(--color-surface-50)]"
                    : "text-[var(--color-surface-300)] hover:text-[var(--color-surface-100)]",
                )}
              >
                <Moon size={12} />
                Dark
              </button>
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  theme === "light"
                    ? "bg-[var(--color-surface-500)] text-[var(--color-surface-50)]"
                    : "text-[var(--color-surface-300)] hover:text-[var(--color-surface-100)]",
                )}
              >
                <Sun size={12} />
                Light
              </button>
            </div>
          </Row>
          <Row label="Zoom" description={`${Math.round(zoomLevel * 100)}%`}>
            <div className="flex items-center gap-1">
              <button
                onClick={zoomOut}
                className="p-1.5 text-[var(--color-surface-300)] hover:text-[var(--color-surface-50)] hover:bg-[var(--color-surface-700)] rounded transition-colors"
                title="Zoom out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={resetZoom}
                className="p-1.5 text-[var(--color-surface-300)] hover:text-[var(--color-surface-50)] hover:bg-[var(--color-surface-700)] rounded transition-colors"
                title="Reset zoom"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={zoomIn}
                className="p-1.5 text-[var(--color-surface-300)] hover:text-[var(--color-surface-50)] hover:bg-[var(--color-surface-700)] rounded transition-colors"
                title="Zoom in"
              >
                <ZoomIn size={14} />
              </button>
            </div>
          </Row>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* GITHUB                                                           */}
        {/* ---------------------------------------------------------------- */}
        <Section title="GitHub">
          {ghConnected ? (
            /* Connected state */
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <GitBranch
                  size={16}
                  className="text-[var(--color-surface-300)] flex-shrink-0"
                />
                <div className="min-w-0">
                  {ghDisplayName && (
                    <p className="text-sm text-[var(--color-surface-50)] truncate">
                      {ghDisplayName}
                    </p>
                  )}
                  <StatusBadge
                    ok
                    label={ghPat ? "Connected via PAT" : "Connected via OAuth"}
                  />
                </div>
              </div>
              <button
                onClick={disconnectGitHub}
                className="text-xs text-[var(--color-surface-300)] hover:text-red-400 transition-colors flex-shrink-0"
              >
                Disconnect
              </button>
            </div>
          ) : (
            /* Not connected — PAT + Device Flow */
            <div>
              {/* PAT */}
              <div className="px-4 py-3 border-b border-[var(--color-surface-700)]">
                <p className="text-xs font-medium text-[var(--color-surface-200)] mb-2">
                  Personal Access Token
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showGhPat ? "text" : "password"}
                      value={ghPatInput}
                      onChange={(e) => setGhPatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveGhPat()}
                      placeholder="ghp_xxxxxxxxxxxx"
                      className="w-full bg-[var(--color-surface-700)] border border-[var(--color-surface-600)] rounded px-3 py-1.5 text-sm text-[var(--color-surface-50)] placeholder-[var(--color-surface-400)] focus:outline-none focus:border-[var(--color-accent-400)] pr-8"
                    />
                    <button
                      onClick={() => setShowGhPat(!showGhPat)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-surface-400)] hover:text-[var(--color-surface-200)]"
                    >
                      {showGhPat ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <button
                    onClick={saveGhPat}
                    disabled={!ghPatInput.trim() || ghPatLoading}
                    className="px-3 py-1.5 bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-400)] disabled:opacity-40 text-white text-sm rounded transition-colors"
                  >
                    {ghPatLoading ? "..." : "Save"}
                  </button>
                </div>
                {ghPatError && (
                  <p className="mt-1.5 text-xs text-red-400">{ghPatError}</p>
                )}
              </div>

              {/* Divider */}
              <div className="px-4 py-2 flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--color-surface-700)]" />
                <span className="text-xs text-[var(--color-surface-400)]">
                  or
                </span>
                <div className="flex-1 h-px bg-[var(--color-surface-700)]" />
              </div>

              {/* CLI button */}
              <div className="px-4 pb-3">
                <p className="text-xs font-medium text-[var(--color-surface-200)] mb-2">
                  Login via Browser
                </p>
                <button
                  onClick={connectGithubCli}
                  disabled={ghCliLoading}
                  className="w-full py-1.5 flex items-center justify-center gap-2 bg-[var(--color-surface-600)] hover:bg-[var(--color-surface-500)] disabled:opacity-40 text-[var(--color-surface-50)] text-sm rounded transition-colors"
                >
                  {ghCliLoading ? (
                    <>
                      <div className="w-3 h-3 rounded-full border-2 border-[var(--color-surface-300)] border-t-transparent animate-spin" />
                      Autenticando...
                    </>
                  ) : (
                    <>
                      <GitBranch size={13} />
                      Conectar com GitHub
                    </>
                  )}
                </button>
                {ghCliError && (
                  <p className="mt-1.5 text-xs text-red-400">{ghCliError}</p>
                )}
                <p className="mt-2 text-xs text-[var(--color-surface-400)]">
                  Requer o{" "}
                  <a
                    href="https://cli.github.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-accent-400)] hover:underline"
                  >
                    GitHub CLI
                  </a>{" "}
                  instalado.
                </p>
              </div>
            </div>
          )}
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* AZURE DEVOPS                                                     */}
        {/* ---------------------------------------------------------------- */}
        <Section title="Azure DevOps">
          {azureConnected ? (
            /* Connected state */
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-[var(--color-surface-50)] truncate mb-1">
                  {user?.displayName}
                </p>
                <StatusBadge ok label="Connected" />
              </div>
              <button
                onClick={logout}
                className="text-xs text-[var(--color-surface-300)] hover:text-red-400 transition-colors flex-shrink-0"
              >
                Disconnect
              </button>
            </div>
          ) : (
            /* Not connected — PAT + OAuth */
            <div>
              {/* PAT */}
              <div className="px-4 py-3 border-b border-[var(--color-surface-700)]">
                <p className="text-xs font-medium text-[var(--color-surface-200)] mb-2">
                  Personal Access Token
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showAzurePat ? "text" : "password"}
                      value={azurePatInput}
                      onChange={(e) => setAzurePatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && connectAzurePat()}
                      placeholder="Azure DevOps PAT"
                      className="w-full bg-[var(--color-surface-700)] border border-[var(--color-surface-600)] rounded px-3 py-1.5 text-sm text-[var(--color-surface-50)] placeholder-[var(--color-surface-400)] focus:outline-none focus:border-[var(--color-accent-400)] pr-8"
                    />
                    <button
                      onClick={() => setShowAzurePat(!showAzurePat)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-surface-400)] hover:text-[var(--color-surface-200)]"
                    >
                      {showAzurePat ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <button
                    onClick={connectAzurePat}
                    disabled={!azurePatInput.trim() || azurePatLoading}
                    className="px-3 py-1.5 bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-400)] disabled:opacity-40 text-white text-sm rounded transition-colors"
                  >
                    {azurePatLoading ? "..." : "Connect"}
                  </button>
                </div>
                {azurePatError && (
                  <p className="mt-1.5 text-xs text-red-400">{azurePatError}</p>
                )}
              </div>

              {/* Divider */}
              <div className="px-4 py-2 flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--color-surface-700)]" />
                <span className="text-xs text-[var(--color-surface-400)]">
                  or
                </span>
                <div className="flex-1 h-px bg-[var(--color-surface-700)]" />
              </div>

              {/* OAuth */}
              <div className="px-4 pb-3">
                <p className="text-xs font-medium text-[var(--color-surface-200)] mb-2">
                  Browser Login (OAuth 2.0 PKCE)
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={azureClientId}
                    onChange={(e) => setAzureClientId(e.target.value)}
                    placeholder="Azure App (client) ID"
                    className="w-full bg-[var(--color-surface-700)] border border-[var(--color-surface-600)] rounded px-3 py-1.5 text-sm text-[var(--color-surface-50)] placeholder-[var(--color-surface-400)] focus:outline-none focus:border-[var(--color-accent-400)]"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={azureTenantId}
                      onChange={(e) => setAzureTenantId(e.target.value)}
                      placeholder="Tenant ID (or 'common')"
                      className="flex-1 bg-[var(--color-surface-700)] border border-[var(--color-surface-600)] rounded px-3 py-1.5 text-sm text-[var(--color-surface-50)] placeholder-[var(--color-surface-400)] focus:outline-none focus:border-[var(--color-accent-400)]"
                    />
                    <input
                      type="text"
                      value={azurePort}
                      onChange={(e) => setAzurePort(e.target.value)}
                      placeholder="Port"
                      className="w-20 bg-[var(--color-surface-700)] border border-[var(--color-surface-600)] rounded px-3 py-1.5 text-sm text-[var(--color-surface-50)] placeholder-[var(--color-surface-400)] focus:outline-none focus:border-[var(--color-accent-400)]"
                    />
                  </div>
                  <button
                    onClick={connectAzureOAuth}
                    disabled={!azureClientId.trim() || azureOAuthLoading}
                    className="w-full py-1.5 bg-[var(--color-surface-600)] hover:bg-[var(--color-surface-500)] disabled:opacity-40 text-[var(--color-surface-50)] text-sm rounded transition-colors"
                  >
                    {azureOAuthLoading
                      ? "Opening browser…"
                      : "Connect via Browser"}
                  </button>
                  {azureOAuthError && (
                    <p className="text-xs text-red-400">{azureOAuthError}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* AGENT REGISTRIES                                                 */}
        {/* ---------------------------------------------------------------- */}
        <Section title="Agent Registries">
          {registries.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--color-surface-400)]">
              No registries configured.
            </div>
          ) : (
            registries.map((url) => (
              <div
                key={url}
                className="px-4 py-2.5 border-b border-[var(--color-surface-700)] last:border-b-0 flex items-center justify-between gap-2"
              >
                <span className="text-xs text-[var(--color-surface-200)] truncate flex-1 font-mono">
                  {url}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => syncRegistry(url)}
                    disabled={registrySyncing === url}
                    className="p-1 text-[var(--color-surface-400)] hover:text-[var(--color-surface-50)] rounded transition-colors"
                    title="Sync"
                  >
                    <RefreshCw
                      size={13}
                      className={cn(registrySyncing === url && "animate-spin")}
                    />
                  </button>
                  <button
                    onClick={() => removeRegistry(url)}
                    className="p-1 text-[var(--color-surface-400)] hover:text-red-400 rounded transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
          <div className="px-4 py-3 border-t border-[var(--color-surface-700)] flex gap-2">
            <input
              type="text"
              value={newRegistryUrl}
              onChange={(e) => setNewRegistryUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRegistry()}
              placeholder="https://github.com/org/asdm-registry"
              className="flex-1 bg-[var(--color-surface-700)] border border-[var(--color-surface-600)] rounded px-3 py-1.5 text-xs text-[var(--color-surface-50)] placeholder-[var(--color-surface-400)] focus:outline-none focus:border-[var(--color-accent-400)]"
            />
            <button
              onClick={addRegistry}
              disabled={!newRegistryUrl.trim()}
              className="p-1.5 bg-[var(--color-surface-600)] hover:bg-[var(--color-surface-500)] disabled:opacity-40 text-[var(--color-surface-50)] rounded transition-colors"
              title="Add registry"
            >
              <Plus size={14} />
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
