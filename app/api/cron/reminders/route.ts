import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendInactivityReminder } from "@/lib/email";
import { NextResponse } from "next/server";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * GET/POST: תזכורת 5 ימים – שולח מייל למשיבים/מגיהים שמשימתם לא עודכנה 5 ימים.
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

  const allIds = [...respondentIds, ...proofreaderIds];
  const emailMap: Record<string, string> = {};
  if (allIds.length > 0) {
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap[u.id] = u.email;
    }
  }

  let sent = 0;
  for (const uid of respondentIds) {
    const email = emailMap[uid];
    if (!email) continue;
    const tasks = byRespondent.get(uid) ?? [];
    const first = tasks[0];
    const result = await sendInactivityReminder(email, "respondent", first?.content);
    if (result.ok) sent++;
  }
  for (const uid of proofreaderIds) {
    const email = emailMap[uid];
    if (!email) continue;
    const tasks = byProofreader.get(uid) ?? [];
    const first = tasks[0];
    const result = await sendInactivityReminder(email, "proofreader", first?.content);
    if (result.ok) sent++;
  }

  return NextResponse.json({
    ok: true,
    checked: questions?.length ?? 0,
    remindersSent: sent,
  });
}
