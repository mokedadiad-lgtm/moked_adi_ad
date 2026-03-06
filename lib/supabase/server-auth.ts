import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type ServerAuthUser = {
  id: string;
  isAdmin: boolean;
  isLinguisticEditor: boolean;
  isTechnicalLead: boolean;
};

/**
 * מחזיר את המשתמש המאומת מהעוגיות (לשימוש ב-Route Handlers / Server Components).
 * מחזיר null אם אין סשן או שהפרופיל לא מאפשר גישה.
 */
export async function getServerAuthUser(): Promise<ServerAuthUser | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // ב-Route Handler אפשר לכתוב cookies; מתעלמים אם נכשל (למשל ב-Response שכבר נשלח)
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin, is_linguistic_editor, is_technical_lead")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) return null;

  return {
    id: user.id,
    isAdmin: profile.is_admin === true,
    isLinguisticEditor: profile.is_linguistic_editor === true,
    isTechnicalLead: profile.is_technical_lead === true,
  };
}

/**
 * בודק אם המשתמש הנוכחי (מעוגיות) הוא אדמין או עורך לשוני או technical lead.
 */
export async function isAdminOrLinguisticOrTechnicalLead(): Promise<boolean> {
  const user = await getServerAuthUser();
  return user != null && (user.isAdmin || user.isLinguisticEditor || user.isTechnicalLead);
}
