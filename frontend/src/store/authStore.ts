import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, UserStatus } from "@/types";

interface AuthState {
  user: User | null;
  access_token: string | null;
  refresh_token: string | null;
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User) => void;
  updateStatus: (status: UserStatus) => void;
  updateUser: (partial: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      access_token: null,
      refresh_token: null,
      isAuthenticated: false,

      setTokens: (access, refresh) => {
        localStorage.setItem("access_token", access);
        localStorage.setItem("refresh_token", refresh);
        set({ access_token: access, refresh_token: refresh, isAuthenticated: true });
      },

      setUser: (user) => set({ user }),

      updateStatus: (status) =>
        set((s) => ({ user: s.user ? { ...s.user, status } : null })),

      updateUser: (partial) =>
        set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),

      refreshUser: async () => {
        const token = get().access_token;
        if (!token) return;
        try {
          const base = import.meta.env.VITE_API_URL ?? "/api/v1";
          const res = await fetch(`${base}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const user = await res.json();
            set({ user });
          }
        } catch { /* ignore */ }
      },

      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({ user: null, access_token: null, refresh_token: null, isAuthenticated: false });
      },
    }),
    {
      name: "auth-storage",
      partialize: (s) => ({
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        user: s.user,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
);
