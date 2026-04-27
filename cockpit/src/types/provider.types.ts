export type ProviderType = "azure-boards" | "jira" | "trello";

export interface ProviderConfig {
  id: string;
  type: ProviderType;
  name: string;
  organizationUrl?: string; // Azure DevOps org URL
  projectName?: string;
  projectId?: string;
  host?: string; // For Jira self-hosted
  isConnected: boolean;
  lastSyncAt?: string;
  connectedAt?: string;
}

export interface AzureBoardsConfig extends ProviderConfig {
  type: "azure-boards";
  organizationUrl: string;
  projectName: string;
  projectId: string;
  // Token stored in OS keychain, not here
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // unix timestamp ms
  tokenType: string;
  scope: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  provider: ProviderType | null;
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  } | null;
  tokens: OAuthTokens | null;
}
