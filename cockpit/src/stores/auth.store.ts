import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthState } from "../types";

interface AuthStore extends AuthState {
  setAuthenticated: (state: AuthState) => void;
  logout: () => void;
  updateAccessToken: (accessToken: string, expiresAt: number) => void;
}

const initialState: AuthState = {
  isAuthenticated: false,
  provider: null,
  user: null,
  tokens: null,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,
      setAuthenticated: (state) => set(state),
      logout: () => set(initialState),
      updateAccessToken: (accessToken, expiresAt) =>
        set((prev) => ({
          tokens: prev.tokens
            ? { ...prev.tokens, accessToken, expiresAt }
            : null,
        })),
    }),
    {
      name: "cockpit-auth",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
