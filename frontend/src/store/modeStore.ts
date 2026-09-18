import { create } from "zustand";

export type AppMode = "wholesale" | "customer" | null;

const MODE_KEY = "smart_ledger_mode";

function readStoredMode(): AppMode {
  const v = localStorage.getItem(MODE_KEY);
  return v === "wholesale" || v === "customer" ? v : null;
}

interface ModeState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  clearMode: () => void;
}

export const useModeStore = create<ModeState>((set) => ({
  mode: readStoredMode(),
  setMode: (mode) => {
    if (mode) localStorage.setItem(MODE_KEY, mode);
    else localStorage.removeItem(MODE_KEY);
    set({ mode });
  },
  clearMode: () => {
    localStorage.removeItem(MODE_KEY);
    set({ mode: null });
  },
}));
