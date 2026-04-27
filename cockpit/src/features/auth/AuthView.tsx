import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "../../stores";
import { Bot, Loader2, AlertCircle } from "lucide-react";
import type { OAuthTokens } from "../../types";

// These would come from app config / settings in production
const AZURE_CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID ?? "";
const AZURE_TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID ?? "organizations";
const REDIRECT_PORT = 7890;

export function AuthView() {
  const { setAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAzureLogin = async () => {
    if (!AZURE_CLIENT_ID) {
      setError("Azure Client ID not configured. Add VITE_AZURE_CLIENT_ID to your .env file.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tokens = await invoke<OAuthTokens>("start_oauth", {
        clientId: AZURE_CLIENT_ID,
        tenantId: AZURE_TENANT_ID,
        redirectPort: REDIRECT_PORT,
      });

      const userProfile = await invoke<{
        id: string;
        display_name: string;
        email: string;
        avatar_url: string | null;
      }>("get_azure_user_profile", { accessToken: tokens.accessToken });

      setAuthenticated({
        isAuthenticated: true,
        provider: "azure-boards",
        user: {
          id: userProfile.id,
          displayName: userProfile.display_name,
          email: userProfile.email,
          avatarUrl: userProfile.avatar_url ?? undefined,
        },
        tokens,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-900)] flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-600)] flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <div className="text-base font-bold text-[var(--color-surface-50)]">
                Engineering Cockpit
              </div>
              <div className="text-xs text-[var(--color-surface-400)]">
                Developer command center
              </div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[var(--color-surface-800)] border border-[var(--color-surface-600)] rounded-[var(--radius-xl)] p-6">
          <h2 className="text-sm font-semibold text-[var(--color-surface-50)] mb-1">
            Sign in to get started
          </h2>
          <p className="text-xs text-[var(--color-surface-400)] mb-5">
            Connect your Azure DevOps account to access your work items, sprints,
            and team workflows.
          </p>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-[var(--color-danger-500)]/10 border border-[var(--color-danger-500)]/30 rounded p-3 mb-4">
              <AlertCircle size={13} className="text-[var(--color-danger-400)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-danger-400)]">{error}</p>
            </div>
          )}

          {/* Azure DevOps button */}
          <button
            onClick={handleAzureLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-[#0078d4] hover:bg-[#006cbe] disabled:opacity-50 rounded text-sm font-medium text-white transition-colors"
          >
            {isLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M0 4.5L7 0l7 4.5V8L7 12.5 0 8V4.5z" fill="white" fillOpacity="0.6" />
                <path d="M14 4.5l-7 8L0 8" fill="white" fillOpacity="0.9" />
              </svg>
            )}
            {isLoading ? "Opening browser..." : "Continue with Azure DevOps"}
          </button>

          <p className="text-[10px] text-[var(--color-surface-500)] text-center mt-4">
            Your tokens are stored securely in the OS keychain.
            <br />
            We never send credentials to external servers.
          </p>
        </div>

        {/* Setup hint */}
        <p className="text-[10px] text-[var(--color-surface-500)] text-center mt-4">
          Need to set up?{" "}
          <span className="text-[var(--color-accent-400)]">
            Add VITE_AZURE_CLIENT_ID to your .env file
          </span>
        </p>
      </div>
    </div>
  );
}
