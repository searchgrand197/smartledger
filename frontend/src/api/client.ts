import axios from "axios";
import { downloadPdfResponse } from "@/utils/pdf";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh/`, { refresh });
          localStorage.setItem("access_token", data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          const p = window.location.pathname;
          if (!p.startsWith("/login") && !p.startsWith("/wholesale/login") && p !== "/") {
            window.location.href = "/";
          }
        }
      } else {
        const p = window.location.pathname;
        if (!p.startsWith("/login") && !p.startsWith("/wholesale/login") && p !== "/") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/";
        }
      }
    }
    return Promise.reject(error);
  }
);

export const downloadFile = async (url: string, filename: string) => {
  try {
    const res = await api.get(url, {
      responseType: "blob",
      headers: { Accept: "application/pdf" },
    });
    await downloadPdfResponse(res, filename);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: Blob; status?: number } };
    if (ax.response?.data instanceof Blob) {
      try {
        const text = await ax.response.data.text();
        const json = JSON.parse(text) as { detail?: string };
        throw new Error(json.detail || "Download failed");
      } catch (e) {
        if (e instanceof Error && e.message !== "Download failed") throw e;
      }
    }
    throw err;
  }
};
