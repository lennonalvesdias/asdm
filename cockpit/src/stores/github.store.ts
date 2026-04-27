import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { GitHubUser, GitHubPullRequest } from "../types";

interface GitHubStore {
  pat: string | null;
  accessToken: string | null;
  oauthClientId: string | null;
  user: GitHubUser | null;
  pullRequestsToReview: GitHubPullRequest[];
  lastFetchedAt: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setPat: (pat: string | null) => void;
  setAccessToken: (token: string | null) => void;
  setOauthClientId: (id: string | null) => void;
  setUser: (user: GitHubUser | null) => void;
  setPullRequestsToReview: (prs: GitHubPullRequest[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearGitHub: () => void;
}

export const useGitHubStore = create<GitHubStore>()(
  persist(
    (set) => ({
      pat: null,
      accessToken: null,
      oauthClientId: null,
      user: null,
      pullRequestsToReview: [],
      lastFetchedAt: null,
      isLoading: false,
      error: null,

      setPat: (pat) => set({ pat }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setOauthClientId: (oauthClientId) => set({ oauthClientId }),
      setUser: (user) => set({ user }),
      setPullRequestsToReview: (prs) =>
        set({
          pullRequestsToReview: prs,
          lastFetchedAt: new Date().toISOString(),
        }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      clearGitHub: () =>
        set({
          pat: null,
          accessToken: null,
          oauthClientId: null,
          user: null,
          pullRequestsToReview: [],
          lastFetchedAt: null,
          error: null,
        }),
    }),
    {
      name: "cockpit-github",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pat: state.pat,
        accessToken: state.accessToken,
        oauthClientId: state.oauthClientId,
      }),
    },
  ),
);
