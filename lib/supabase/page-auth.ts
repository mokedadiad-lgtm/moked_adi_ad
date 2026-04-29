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
  if (!auth.ok || !auth.profile) return false;
  const isAdmin = auth.profile.is_admin === true || auth.profile.is_technical_lead === true;
  const isProofreader =
    auth.profile.is_proofreader === true && Boolean(auth.profile.proofreader_type_id);
  return isAdmin || isProofreader;
}
