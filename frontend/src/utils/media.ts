const API_BASE = import.meta.env.VITE_API_URL || "/api";

/** Resolve Django media path to a browser URL. */
export function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const base = API_BASE.replace(/\/api\/?$/, "") || origin;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
