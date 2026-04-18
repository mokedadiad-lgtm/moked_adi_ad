import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { encryptTeamJoinPassword } from "@/lib/team-join-crypto";
import { hashTeamJoinToken } from "@/lib/team-join-token";

export const runtime = "nodejs";

const rateBucket = new Map<string, { count: number; reset: number }>();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 15;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const b = rateBucket.get(ip);
  if (!b || now > b.reset) {
    rateBucket.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_MAX) return false;
  b.count += 1;
  return true;
}

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }

  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "יותר מדי ניסיונות. נסו שוב מאוחר יותר." }, { status: 429 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const formKind = body.form_kind === "respondent" || body.form_kind === "proofreader" ? body.form_kind : null;
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !formKind || password.length < 6) {
    return NextResponse.json({ ok: false, error: "חסרים שדות או סיסמה קצרה מדי" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const tokenHash = hashTeamJoinToken(token);
  const { data: linkRow, error: linkErr } = await supabase
    .from("team_join_link_tokens")
    .select("id, form_kind, is_active, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkErr || !linkRow) {
    return NextResponse.json({ ok: false, error: "קישור לא תקין או שפג תוקפו" }, { status: 403 });
  }
  if (!linkRow.is_active) {
    return NextResponse.json({ ok: false, error: "הקישור אינו פעיל" }, { status: 403 });
  }
  if (linkRow.form_kind !== formKind) {
    return NextResponse.json({ ok: false, error: "סוג הטופס לא תואם לקישור" }, { status: 400 });
  }
  if (linkRow.expires_at && new Date(linkRow.expires_at as string) < new Date()) {
    return NextResponse.json({ ok: false, error: "פג תוקף הקישור" }, { status: 403 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "אימייל לא תקין" }, { status: 400 });
  }

  const rawConc = body.concurrency_limit;
  let concurrencyLimitNum =
    typeof rawConc === "number" && Number.isFinite(rawConc)
      ? Math.trunc(rawConc)
      : typeof rawConc === "string"
        ? parseInt(rawConc.trim(), 10)
        : NaN;
  if (Number.isNaN(concurrencyLimitNum)) concurrencyLimitNum = 1;
  if (formKind === "respondent") {
    if (concurrencyLimitNum < 1 || concurrencyLimitNum > 3) {
      return NextResponse.json(
        { ok: false, error: "מספר שאלות בשבוע חייב להיות בין 1 ל־3" },
        { status: 400 }
      );
    }
  } else {
    concurrencyLimitNum = Math.max(0, concurrencyLimitNum);
  }

  const { data: pendingRows } = await supabase.from("team_join_submissions").select("id, payload").eq("status", "pending");
  const dup = pendingRows?.some(
    (r) => String((r.payload as { email?: string })?.email ?? "").toLowerCase() === email
  );
  if (dup) {
    return NextResponse.json(
      { ok: false, error: "כבר קיימת בקשה ממתינה עם אימייל זה" },
      { status: 409 }
    );
  }

  const { data: emailTaken, error: emailTakenErr } = await supabase.rpc("team_join_email_taken", {
    p_email: email,
  });
  if (emailTakenErr) {
    console.error("[team/join] team_join_email_taken", emailTakenErr);
    return NextResponse.json({ ok: false, error: "שגיאת שרת (בדיקת אימייל)" }, { status: 500 });
  }
  if (emailTaken === true) {
    return NextResponse.json(
      { ok: false, error: "כתובת האימייל כבר רשומה במערכת" },
      { status: 409 }
    );
  }

  const payload: Record<string, unknown> = { ...body };
  delete payload.token;
  delete payload.password;
  delete payload.form_kind;
  payload.email = email;
  payload.concurrency_limit = concurrencyLimitNum;

  let passwordCipher: string;
  try {
    passwordCipher = encryptTeamJoinPassword(password);
  } catch (e) {
    console.error("[team/join] encrypt", e);
    return NextResponse.json({ ok: false, error: "שגיאת שרת (הצפנה)" }, { status: 500 });
  }

  const { error: insErr } = await supabase.from("team_join_submissions").insert({
    link_token_id: linkRow.id,
    form_kind: formKind,
    status: "pending",
    payload,
    password_ciphertext: passwordCipher,
  });

  if (insErr) {
    console.error("[team/join] insert", insErr);
    return NextResponse.json({ ok: false, error: "שמירה נכשלה" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
