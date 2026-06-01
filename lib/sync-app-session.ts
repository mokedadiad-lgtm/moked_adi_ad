import { getSupabaseBrowser } from "@/lib/supabase/client";

/** מסנכרן את עוגיית השרת (app_access_token) עם סשן Supabase בדפדפן */
export async function syncAppSessionCookie(): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;
  if (!token) return;
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}
