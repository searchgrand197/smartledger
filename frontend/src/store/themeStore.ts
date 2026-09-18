import { create } from "zustand";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "smart-ledger-theme";

function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", mode);
}

interface ThemeState {
  mode: ThemeMode;
  init: () => void;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "light",
  init: () => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const mode = saved === "dark" ? "dark" : "light";
    applyTheme(mode);
    set({ mode });
  },
  setMode: (mode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
    set({ mode });
  },
  toggle: () => {
    const next = get().mode === "light" ? "dark" : "light";
    get().setMode(next);
  },
}));
