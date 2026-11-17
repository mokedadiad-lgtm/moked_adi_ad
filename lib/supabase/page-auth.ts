import { getUserFromBearerToken } from "@/lib/supabase/route-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const SESSION_COOKIE = "app_access_token";

type ProfileFlags = {
  is_admin?: boolean | null;
  is_technical_lead?: boolean | null;
  is_respondent?: boolean | null;
  is_proofreader?: boolean | null;
  proofreader_type_id?: string | null;
};

async function getProfileFlags(userId: string): Promise<ProfileFlags | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin, is_technical_lead, is_respondent, is_proofreader, proofreader_type_id")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data as ProfileFlags;
}

export async function getAuthFromServerCookie(): Promise<{
  ok: boolean;
  userId: string | null;
  profile: ProfileFlags | null;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  if (!token) return { ok: false, userId: null, profile: null };

  const user = await getUserFromBearerToken(token);
  if (!user) return { ok: false, userId: null, profile: null };

  const profile = await getProfileFlags(user.id);
  return { ok: profile != null, userId: user.id, profile };
}

export async function canAccessAdminFromServerCookie(): Promise<boolean> {
  const auth = await getAuthFromServerCookie();
  if (!auth.ok || !auth.profile) return false;
  return auth.profile.is_admin === true || auth.profile.is_technical_lead === true;
}

export async function canAccessRespondentFromServerCookie(): Promise<boolean> {
  const auth = await getAuthFromServerCookie();
  if (!auth.ok || !auth.profile) return false;
  return (
    auth.profile.is_admin === true ||
    auth.profile.is_technical_lead === true ||
    auth.profile.is_respondent === true
  );
}

export async function canAccessProofreaderFromServerCookie(): Promise<boolean> {
  const auth = await getAuthFromServerCookie();
  if (!auth.ok || !auth.profile || !auth.userId) return false;
  const isAdmin = auth.profile.is_admin === true || auth.profile.is_technical_lead === true;
  if (isAdmin) return true;
  if (auth.profile.is_proofreader !== true) return false;

  const supabase = getSupabaseAdmin();
  const { data: dual } = await supabase
    .from("system_dual_proofreaders")
    .select("proofreader_a_id, proofreader_b_id")
    .eq("id", 1)
    .maybeSingle();
  const a = (dual as { proofreader_a_id?: string | null } | null)?.proofreader_a_id ?? null;
  const b = (dual as { proofreader_b_id?: string | null } | null)?.proofreader_b_id ?? null;
  if (auth.userId === a || auth.userId === b) return true;

  // fallback: מגיהים עם סוג הגהה (תאימות לאחור עד שמגדירים את השתיים הקבועות)
  return Boolean(auth.profile.proofreader_type_id);
}
