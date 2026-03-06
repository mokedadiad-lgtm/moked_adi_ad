import { createClient } from "@supabase/supabase-js";

export type AuthResult =
  | { ok: true; userId: string; isAdmin: boolean; isLinguisticEditor: boolean }
  | { ok: false; status: number; message: string };

/**
 * מחזיר את המשתמש המאומת מהבקשה (Authorization: Bearer <jwt>) ובודק שהוא אדמין או עורך לשוני.
 * לשימוש ב-API routes שדורשים הרשאת אדמין/עורך.
 */
export async function requireAdminOrLinguistic(request: Request): Promise<AuthResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false, status: 500, message: "חסרות הגדרות שרת" };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { ok: false, status: 401, message: "חסר אימות" };
  }

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, message: "אימות לא תקף" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin, is_linguistic_editor")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { ok: false, status: 403, message: "אין פרופיל מתאים" };
  }

  const isAdmin = profile.is_admin === true;
  const isLinguisticEditor = profile.is_linguistic_editor === true;
  if (!isAdmin && !isLinguisticEditor) {
    return { ok: false, status: 403, message: "אין הרשאה" };
  }

  return {
    ok: true,
    userId: user.id,
    isAdmin,
    isLinguisticEditor,
  };
}
