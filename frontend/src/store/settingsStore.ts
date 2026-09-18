import { create } from "zustand";
import { businessApi } from "@/api/services";

interface Settings {
  business_name: string;
  dark_mode: boolean;
  gst_enabled: boolean;
  default_gst_rate: number;
  invoice_prefix: string;
  setup_completed?: boolean;
}

interface SettingsState extends Settings {
  loaded: boolean;
  loadedForOrgId: number | null;
  load: (organizationId?: number | null) => Promise<void>;
  reset: () => void;
  setDarkMode: (v: boolean) => void;
}

const initialState: Settings & { loaded: boolean; loadedForOrgId: number | null } = {
  business_name: "Smart Ledger",
  dark_mode: false,
  gst_enabled: false,
  default_gst_rate: 0,
  invoice_prefix: "BILL",
  setup_completed: false,
  loaded: false,
  loadedForOrgId: null,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ...initialState,
  load: async (organizationId) => {
    try {
      const { data } = await businessApi.settings();
      set({
        ...data,
        loaded: true,
        loadedForOrgId: organizationId ?? null,
      });
      document.documentElement.classList.toggle("dark", data.dark_mode);
    } catch {
      set({ loaded: true, loadedForOrgId: organizationId ?? null });
    }
  },
  reset: () => set({ ...initialState }),
  setDarkMode: (v) => {
    document.documentElement.classList.toggle("dark", v);
    set({ dark_mode: v });
    if (localStorage.getItem("access_token")) {
      businessApi.updateSettings({ dark_mode: v }).catch(() => {});
    }
  },
}));
