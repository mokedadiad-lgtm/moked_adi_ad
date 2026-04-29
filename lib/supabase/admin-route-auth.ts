import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUserFromBearerToken } from "@/lib/supabase/route-auth";
import type { NextRequest } from "next/server";

function authToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function requireAdminFromRequest(
  request: NextRequest
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const token = authToken(request);
  const user = await getUserFromBearerToken(token);
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const supabase = getSupabaseAdmin();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin, is_technical_lead")
    .eq("id", user.id)
    .single();

  if (error) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const isAdmin = profile?.is_admin === true || profile?.is_technical_lead === true;
  if (!isAdmin) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true };
}
