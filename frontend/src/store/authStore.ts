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
  isPlatformAdmin: boolean;
  supportAccess: boolean;
  login: (username: string, password: string) => Promise<void>;
  adoptSupportSession: (tokens: {
    access: string;
    refresh: string;
  }) => Promise<void>;
  returnToPlatform: () => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

function applyMe(data: {
  username: string;
  organization_id?: number | null;
  organization_name?: string | null;
  setup_completed?: boolean;
  is_platform_admin?: boolean;
  is_superuser?: boolean;
  support_access?: boolean;
}) {
  return {
    isAuthenticated: true,
    authReady: true,
    username: data.username,
    organizationId: data.organization_id ?? null,
    organizationName: data.organization_name ?? "",
    setupCompleted: !!data.setup_completed,
    isPlatformAdmin: !!(data.is_platform_admin ?? data.is_superuser),
    supportAccess: !!data.support_access,
  };
}

const loggedOut = {
  isAuthenticated: false,
  authReady: true,
  username: "",
  organizationId: null as number | null,
  organizationName: "",
  setupCompleted: true,
  isPlatformAdmin: false,
  supportAccess: false,
};

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  authReady: false,
  username: "",
  organizationId: null,
  organizationName: "",
  setupCompleted: true,
  isPlatformAdmin: false,
  supportAccess: false,
  login: async (username, password) => {
    useSettingsStore.getState().reset();
    queryClient.clear();
    const { data } = await authApi.login(username, password);
    localStorage.setItem("access_token", data.access);
    localStorage.setItem("refresh_token", data.refresh);
    const me = await authApi.me();
    const orgId = me.data.organization_id ?? null;
    set(applyMe({ ...me.data, username }));
    if (orgId != null && (!me.data.is_platform_admin || me.data.support_access)) {
      await useSettingsStore.getState().load(orgId);
    }
  },
  adoptSupportSession: async (tokens) => {
    useSettingsStore.getState().reset();
    queryClient.clear();
    const prevAccess = localStorage.getItem("access_token");
    const prevRefresh = localStorage.getItem("refresh_token");
    if (prevAccess && prevRefresh) {
      sessionStorage.setItem("platform_access_token", prevAccess);
      sessionStorage.setItem("platform_refresh_token", prevRefresh);
    }
    localStorage.setItem("access_token", tokens.access);
    localStorage.setItem("refresh_token", tokens.refresh);
    const me = await authApi.me();
    const orgId = me.data.organization_id ?? null;
    set(applyMe(me.data));
    if (orgId != null) {
      await useSettingsStore.getState().load(orgId);
    }
  },
  returnToPlatform: async () => {
    const access = sessionStorage.getItem("platform_access_token");
    const refresh = sessionStorage.getItem("platform_refresh_token");
    sessionStorage.removeItem("platform_access_token");
    sessionStorage.removeItem("platform_refresh_token");
    if (!access || !refresh) {
      throw new Error("No platform session saved");
    }
    useSettingsStore.getState().reset();
    queryClient.clear();
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    const me = await authApi.me();
    set(applyMe(me.data));
  },
  logout: () => {
    sessionStorage.removeItem("platform_access_token");
    sessionStorage.removeItem("platform_refresh_token");

    const theme = localStorage.getItem("theme-mode");
    localStorage.clear();
    if (theme) localStorage.setItem("theme-mode", theme);
    useSettingsStore.getState().reset();
    queryClient.clear();
    set(loggedOut);
  },
  checkAuth: async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      useSettingsStore.getState().reset();
      set(loggedOut);
      return;
    }
    try {
      const { data } = await authApi.me();
      const orgId = data.organization_id ?? null;
      set(applyMe(data));
      if (orgId != null && (!data.is_platform_admin || data.support_access)) {
        await useSettingsStore.getState().load(orgId);
      }
    } catch {
      const theme = localStorage.getItem("theme-mode");
      localStorage.clear();
      if (theme) localStorage.setItem("theme-mode", theme);
      useSettingsStore.getState().reset();
      queryClient.clear();
      set(loggedOut);
    }
  },
  refreshMe: async () => {
    const { data } = await authApi.me();
    set(applyMe(data));
  },
}));
