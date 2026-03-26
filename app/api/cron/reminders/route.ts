import { getSupabaseAdmin } from "@/lib/supabase/server";
import { wantsEmail, wantsWhatsApp } from "@/lib/communicationPreference";
import { sendInactivityReminder } from "@/lib/email";
import { NextResponse } from "next/server";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

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
 * GET/POST: תזכורת 5 ימים – שולח מייל ו/או וואטסאפ למשיבים/מגיהים שמשימתם לא עודכנה 5 ימים.
 * להפעלה: Vercel Cron או שירות חיצוני עם CRON_SECRET ב-Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runReminders();
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runReminders();
}

async function runReminders() {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - FIVE_DAYS_MS).toISOString();
  const dayKey = new Date().toISOString().slice(0, 10);

  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, stage, assigned_respondent_id, assigned_proofreader_id, content, updated_at")
    .in("stage", ["with_respondent", "in_proofreading_lobby"])
    .lt("updated_at", cutoff);

  if (error) {
    console.error("cron/reminders: fetch error", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const respondentIds = new Set<string>();
  const proofreaderIds = new Set<string>();
  const byRespondent = new Map<string, { id: string; content: string }[]>();
  const byProofreader = new Map<string, { id: string; content: string }[]>();

  for (const q of questions ?? []) {
    const preview = (q.content as string)?.slice(0, 50) ?? "";
    if (q.stage === "with_respondent" && q.assigned_respondent_id) {
      respondentIds.add(q.assigned_respondent_id);
      const list = byRespondent.get(q.assigned_respondent_id) ?? [];
      list.push({ id: q.id, content: preview });
      byRespondent.set(q.assigned_respondent_id, list);
    }
    if (q.stage === "in_proofreading_lobby" && q.assigned_proofreader_id) {
      proofreaderIds.add(q.assigned_proofreader_id);
      const list = byProofreader.get(q.assigned_proofreader_id) ?? [];
      list.push({ id: q.id, content: preview });
      byProofreader.set(q.assigned_proofreader_id, list);
    }
  }

  const allIds = [...new Set([...respondentIds, ...proofreaderIds])];
  const emailMap: Record<string, string> = {};
  const profById = new Map<string, { communication_preference: string | null; phone: string | null; full_name_he: string | null }>();

  if (allIds.length > 0) {
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap[u.id] = u.email;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, communication_preference, phone, full_name_he")
      .in("id", allIds);
    for (const p of profs ?? []) {
      profById.set(p.id as string, {
        communication_preference: p.communication_preference as string | null,
        phone: (p.phone as string | null) ?? null,
        full_name_he: (p.full_name_he as string | null) ?? null,
      });
    }
  }

  let sent = 0;
  const { sendMetaWhatsAppInitiatedWithLog } = await import("@/lib/whatsapp/outbound");
  const { waTemplateBodyParam } = await import("@/lib/whatsapp/templateConfig");
  const { extractWhatsAppUrlSuffix } = await import("@/lib/whatsapp/urlSuffix");

  for (const uid of respondentIds) {
    const tasks = byRespondent.get(uid) ?? [];
    const first = tasks[0];
    const prof = profById.get(uid);
    const comm = prof?.communication_preference ?? "email";

    if (wantsEmail(comm)) {
      const email = emailMap[uid];
      if (email) {
        const result = await sendInactivityReminder(email, "respondent", first?.content);
        if (result.ok) sent++;
      }
    }
    if (wantsWhatsApp(comm)) {
      const phone = prof?.phone?.trim();
      if (phone) {
        const link = goLink("/respondent");
        const linkSuffix = extractWhatsAppUrlSuffix(link);
        const name = prof?.full_name_he?.trim() ?? "";
        const greetingLegacy = name ? `שלום ${name}` : "שלום";
        const nameParam = waTemplateBodyParam(name);
        const text = `${greetingLegacy},\nמשימה שהוקצתה אליך כמשיב/ה לא עודכנה מזה 5 ימים.\nכניסה למערכת: ${link}`;
        const wa = await sendMetaWhatsAppInitiatedWithLog(phone, {
          templateKey: "cron_inactivity_reminder",
          channel_event: "cron_inactivity_reminder",
          idempotency_key: `remind5d_${dayKey}_${uid}_respondent`,
          // Template begins with fixed "שלום וברכה" so param 1 must be name-only (or invisible).
          bodyParameters: [nameParam, "משיב/ה"],
          buttonDynamicParam: linkSuffix,
          legacyText: text,
        });
        if (wa.ok) sent++;
      }
    }
  }

  for (const uid of proofreaderIds) {
    const tasks = byProofreader.get(uid) ?? [];
    const first = tasks[0];
    const prof = profById.get(uid);
    const comm = prof?.communication_preference ?? "email";

    if (wantsEmail(comm)) {
      const email = emailMap[uid];
      if (email) {
        const result = await sendInactivityReminder(email, "proofreader", first?.content);
        if (result.ok) sent++;
      }
    }
    if (wantsWhatsApp(comm)) {
      const phone = prof?.phone?.trim();
      if (phone) {
        const link = goLink("/proofreader");
        const linkSuffix = extractWhatsAppUrlSuffix(link);
        const name = prof?.full_name_he?.trim() ?? "";
        const greetingLegacy = name ? `שלום ${name}` : "שלום";
        const nameParam = waTemplateBodyParam(name);
        const text = `${greetingLegacy},\nמשימה שהוקצתה אליך כמגיה/ה לא עודכנה מזה 5 ימים.\nכניסה ללובי: ${link}`;
        const wa = await sendMetaWhatsAppInitiatedWithLog(phone, {
          templateKey: "cron_inactivity_reminder",
          channel_event: "cron_inactivity_reminder",
          idempotency_key: `remind5d_${dayKey}_${uid}_proofreader`,
          // Template begins with fixed "שלום וברכה" so param 1 must be name-only (or invisible).
          bodyParameters: [nameParam, "מגיה/ה"],
          buttonDynamicParam: linkSuffix,
          legacyText: text,
        });
        if (wa.ok) sent++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checked: questions?.length ?? 0,
    remindersSent: sent,
  });
}
