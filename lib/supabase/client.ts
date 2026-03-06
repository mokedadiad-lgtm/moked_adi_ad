"use client";

import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

function getSupabaseBrowser() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars (URL or Anon Key)");
  browserClient = createBrowserClient(url, key);
  return browserClient;
}

/** לשליחה ב-fetch ל-API שדורשים אימות (אדמין/עורך לשוני) */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await getSupabaseBrowser().auth.getSession();
  if (session?.access_token) return { Authorization: `Bearer ${session.access_token}` };
  return {};
}

export { getSupabaseBrowser };
