import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendLobbySummaryToProofreaders } from "@/lib/email";
import { NextResponse } from "next/server";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * GET/POST: סיכום יומי ללובי – שולח למגיהים לפי סוג הגהה כמה משימות ממתינות.
 * להפעלה: Vercel Cron עם CRON_SECRET.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runLobbySummary();
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runLobbySummary();
}

async function runLobbySummary() {
  const supabase = getSupabaseAdmin();

  const { data: types, error: typesErr } = await supabase
    .from("proofreader_types")
    .select("id, name_he")
    .order("sort_order");

  if (typesErr || !types?.length) {
    return NextResponse.json({ ok: true, message: "No proofreader types" });
  }

  let totalSent = 0;
  for (const pt of types) {
    const { data: questions } = await supabase
      .from("questions")
      .select("id")
      .eq("stage", "in_proofreading_lobby")
      .eq("proofreader_type_id", pt.id);

    const count = questions?.length ?? 0;
    if (count === 0) continue;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, communication_preference")
      .eq("is_proofreader", true)
      .eq("proofreader_type_id", pt.id);

    const ids = (profiles ?? []).filter(
      (p) => p.communication_preference === "email" || p.communication_preference === "both"
    ).map((p) => p.id);
    if (ids.length === 0) continue;

    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, string> = {};
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap[u.id] = u.email;
    }
    const toEmails = ids.map((id) => emailMap[id]).filter(Boolean);
    const result = await sendLobbySummaryToProofreaders(toEmails, count, pt.name_he);
    if (result.ok) totalSent += toEmails.length;
  }

  return NextResponse.json({
    ok: true,
    summaryEmailsSent: totalSent,
  });
}
