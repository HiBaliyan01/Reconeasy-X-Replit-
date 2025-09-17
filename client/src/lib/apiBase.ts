const envBase =
  (import.meta.env.VITE_API_BASE ?? import.meta.env.NEXT_PUBLIC_API_BASE ?? "")
    .toString()
    .trim();

const trimmed = envBase.replace(/\/$/, "");
export const API_BASE = trimmed.length > 0 ? trimmed : "/api";

export function apiUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const baseHasSlash = API_BASE.endsWith("/");
  const suffixHasSlash = suffix.startsWith("/");

  if (baseHasSlash && suffixHasSlash) {
    return `${API_BASE}${suffix.slice(1)}`;
  }

  if (!baseHasSlash && !suffixHasSlash) {
    return `${API_BASE}/${suffix}`;
  }

  return `${API_BASE}${suffix}`;
}
