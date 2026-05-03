import { getSupabaseAdmin } from "@/lib/supabase/server";
import { wantsEmail, wantsWhatsApp } from "@/lib/communicationPreference";
import { sendLobbySummaryToProofreaders } from "@/lib/email";
import { NextResponse } from "next/server";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

function goLink(pathWithQuery: string): string {
  return `${APP_URL}/api/go?r=${encodeURIComponent(pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`)}`;
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * GET/POST: סיכום יומי ללובי – שולח למגיהים לפי סוג הגהה כמה משימות ממתינות (מייל ו/או וואטסאפ).
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
  const dayKey = new Date().toISOString().slice(0, 10);

  const { data: types, error: typesErr } = await supabase
    .from("proofreader_types")
    .select("id, name_he")
    .order("sort_order");

  if (typesErr || !types?.length) {
    return NextResponse.json({ ok: true, message: "No proofreader types" });
  }

  let totalSent = 0;
  const { sendMetaWhatsAppInitiatedWithLog } = await import("@/lib/whatsapp/outbound");

  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const emailMap: Record<string, string> = {};
  for (const u of authData?.users ?? []) {
    if (u.email) emailMap[u.id] = u.email;
  }

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
      .select("id, communication_preference, phone")
      .eq("is_proofreader", true)
      .eq("proofreader_type_id", pt.id);

    const list = profiles ?? [];
    const emailIds = list.filter((p) => wantsEmail(p.communication_preference)).map((p) => p.id);
    const toEmails = emailIds.map((id) => emailMap[id]).filter(Boolean) as string[];

    if (toEmails.length > 0) {
      const result = await sendLobbySummaryToProofreaders(toEmails, count, pt.name_he);
      if (result.ok) totalSent += toEmails.length;
    }

    const lobbyUrl = goLink("/proofreader");
    const { extractWhatsAppUrlSuffix } = await import("@/lib/whatsapp/urlSuffix");
    const lobbyLinkSuffix = extractWhatsAppUrlSuffix(lobbyUrl);

    for (const p of list) {
      if (!wantsWhatsApp(p.communication_preference)) continue;
      const phone = (p.phone as string | null)?.trim();
      if (!phone) continue;
      const text = `שלום,\nהיום יש ${count} משימה/ות ממתינות בלובי ההגהה.\nכניסה: ${lobbyUrl}`;
      const wa = await sendMetaWhatsAppInitiatedWithLog(phone, {
        templateKey: "cron_lobby_summary",
        channel_event: "cron_lobby_summary",
        idempotency_key: `lobby_sum_${dayKey}_${pt.id}_${p.id}`,
        bodyParameters: [String(count)],
        buttonDynamicParam: lobbyLinkSuffix,
        legacyText: text,
      });
      if (wa.ok) totalSent++;
    }
  }

  return NextResponse.json({
    ok: true,
    summaryNotificationsSent: totalSent,
  });
}
