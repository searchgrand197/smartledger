import { create } from "zustand";
import { authApi } from "@/api/services";
import { useSettingsStore } from "@/store/settingsStore";
import { queryClient } from "@/lib/queryClient";

interface AuthState {
  isAuthenticated: boolean;
  authReady: boolean;
  username: string;
  organizationId: number | null;
  organizationName: string;
  setupCompleted: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

function applyMe(data: {
  username: string;
  organization_id?: number | null;
  organization_name?: string | null;
  setup_completed?: boolean;
}) {
  return {
    isAuthenticated: true,
    authReady: true,
    username: data.username,
    organizationId: data.organization_id ?? null,
    organizationName: data.organization_name ?? "",
    setupCompleted: !!data.setup_completed,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  authReady: false,
  username: "",
  organizationId: null,
  organizationName: "",
  setupCompleted: true,
  login: async (username, password) => {
    useSettingsStore.getState().reset();
    queryClient.clear();
    const { data } = await authApi.login(username, password);
    localStorage.setItem("access_token", data.access);
    localStorage.setItem("refresh_token", data.refresh);
    const me = await authApi.me();
    const orgId = me.data.organization_id ?? null;
    set(applyMe({ ...me.data, username }));
    await useSettingsStore.getState().load(orgId);
  },
  logout: () => {
    const theme = localStorage.getItem("theme-mode");
    localStorage.clear();
    if (theme) localStorage.setItem("theme-mode", theme);
    useSettingsStore.getState().reset();
    queryClient.clear();
    set({
      isAuthenticated: false,
      authReady: true,
      username: "",
      organizationId: null,
      organizationName: "",
      setupCompleted: true,
    });
  },
  checkAuth: async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      useSettingsStore.getState().reset();
      set({
        isAuthenticated: false,
        authReady: true,
        username: "",
        organizationId: null,
        organizationName: "",
        setupCompleted: true,
      });
      return;
    }
    try {
      const { data } = await authApi.me();
      const orgId = data.organization_id ?? null;
      set(applyMe(data));
      await useSettingsStore.getState().load(orgId);
    } catch {
      const theme = localStorage.getItem("theme-mode");
      localStorage.clear();
      if (theme) localStorage.setItem("theme-mode", theme);
      useSettingsStore.getState().reset();
      queryClient.clear();
      set({
        isAuthenticated: false,
        authReady: true,
        username: "",
        organizationId: null,
        organizationName: "",
        setupCompleted: true,
      });
    }
  },
  refreshMe: async () => {
    const { data } = await authApi.me();
    set(applyMe(data));
  },
}));
