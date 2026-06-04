import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "blue" | "red" | "pure" | "light";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => {
        document.documentElement.setAttribute("data-theme", theme);
        set({ theme });
      },
    }),
    { name: "theme-storage" }
  )
);

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
