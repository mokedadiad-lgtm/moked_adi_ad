import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendTechnicalDigestPush } from "@/lib/push/send-admin-inbox-push";

const CHECKPOINT_KEY = "questions_monday_thursday";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runDigest();
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runDigest();
}

async function runDigest() {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: checkpointRow, error: checkpointErr } = await supabase
    .from("push_digest_checkpoints")
    .select("last_checkpoint_at")
    .eq("key", CHECKPOINT_KEY)
    .maybeSingle();

  if (checkpointErr) {
    console.error("[cron/questions-digest-push] checkpoint read failed", checkpointErr);
    return NextResponse.json({ ok: false, error: checkpointErr.message }, { status: 500 });
  }

  // בריצה ראשונה סופרים 4 ימים אחורה (פער בין שני↔חמישי).
  const fallback = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const sinceIso =
    typeof checkpointRow?.last_checkpoint_at === "string" ? checkpointRow.last_checkpoint_at : fallback;

  const { count, error: countErr } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .gt("created_at", sinceIso)
    .lte("created_at", nowIso);

  if (countErr) {
    console.error("[cron/questions-digest-push] count failed", countErr);
    return NextResponse.json({ ok: false, error: countErr.message }, { status: 500 });
  }

  const questionsCount = count ?? 0;
  const sinceLocal = new Date(sinceIso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  const nowLocal = new Date(nowIso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  const title = "סיכום שאלות: שני/חמישי";
  const body = `נכנסו ${questionsCount} שאלות מאז הסיכום הקודם (${sinceLocal}–${nowLocal}).`;

  await sendTechnicalDigestPush({
    title,
    body,
    url: "/admin",
  });

  const { error: saveErr } = await supabase.from("push_digest_checkpoints").upsert(
    {
      key: CHECKPOINT_KEY,
      last_checkpoint_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "key" }
  );

  if (saveErr) {
    console.error("[cron/questions-digest-push] checkpoint save failed", saveErr);
    return NextResponse.json({ ok: false, error: saveErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    since: sinceIso,
    until: nowIso,
    questionsCount,
  });
}
