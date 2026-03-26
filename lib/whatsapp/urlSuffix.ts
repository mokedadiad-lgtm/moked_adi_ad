function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

/**
 * Extract the URL suffix for WhatsApp template dynamic URL buttons.
 *
 * If `fullUrl` starts with `NEXT_PUBLIC_APP_URL`, return the part after the base URL,
 * without a leading slash (so it can be appended by Meta to a base URL set in Manager).
 *
 * If it doesn't match, return the full URL (fallback).
 */
export function extractWhatsAppUrlSuffix(fullUrl: string): string {
  const rawBase = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!rawBase) return fullUrl;
  const base = normalizeBaseUrl(rawBase);
  const u = (fullUrl ?? "").trim();
  if (!u) return "";
  if (!u.startsWith(base)) return fullUrl;

  let rest = u.slice(base.length);
  while (rest.startsWith("/")) rest = rest.slice(1);
  return rest || "";
}

