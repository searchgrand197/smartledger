import { create } from "zustand";
import { portalApi } from "@/api/portal";

interface PortalState {
  token: string | null;
  label: string;
  isLoggedIn: boolean;
  customer?: any;
  login: (username: string, password: string) => Promise<void>;
  loginFromToken: (token: string, label: string) => void;
  logout: () => void;
  restore: () => void;
}

function persistSession(token: string, label: string) {
  localStorage.setItem("customer_portal_token", token);
  localStorage.setItem("customer_portal_label", label);
  localStorage.removeItem("customer_portal_customer");
  localStorage.removeItem("customer_portal_due");
}

export const useCustomerPortalStore = create<PortalState>((set) => ({
  token: localStorage.getItem("customer_portal_token"),
  label: localStorage.getItem("customer_portal_label") || "Walk-in / Quick Sale",
  isLoggedIn: !!localStorage.getItem("customer_portal_token"),

  restore: () => {
    const token = localStorage.getItem("customer_portal_token");
    if (token) {
      set({
        token,
        label: localStorage.getItem("customer_portal_label") || "Walk-in / Quick Sale",
        isLoggedIn: true,
      });
    }
  },

  login: async (username, password) => {
    const { data } = await portalApi.login(username, password);
    const label = data.label || "Walk-in / Quick Sale";
    persistSession(data.token, label);
    set({ token: data.token, label, isLoggedIn: true });
  },

  loginFromToken: (token, label) => {
    persistSession(token, label);
    set({ token, label, isLoggedIn: true });
  },

  logout: () => {
    localStorage.removeItem("customer_portal_token");
    localStorage.removeItem("customer_portal_label");
    localStorage.removeItem("customer_portal_customer");
    localStorage.removeItem("customer_portal_due");
    set({ token: null, label: "Walk-in / Quick Sale", isLoggedIn: false });
  },
}));
