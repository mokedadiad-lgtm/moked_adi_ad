import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUserFromBearerToken } from "@/lib/supabase/route-auth";
import { isPushConfigured } from "@/lib/push/config";

type Body = {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
};

export async function POST(request: NextRequest) {
  if (!isPushConfigured()) {
    return NextResponse.json({ ok: false, error: "התראות דחיפה לא הוגדרו בשרת" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const user = await getUserFromBearerToken(token);
  if (!user) {
    return NextResponse.json({ ok: false, error: "לא מחובר" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "גוף לא תקין" }, { status: 400 });
  }

  const sub = body.subscription;
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : null;
  const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : null;
  const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth : null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: "חסר מנוי push" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("is_admin, is_technical_lead")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr || !profile) {
    return NextResponse.json({ ok: false, error: "פרופיל לא נמצא" }, { status: 403 });
  }

  if (profile.is_admin !== true && profile.is_technical_lead !== true) {
    return NextResponse.json({ ok: false, error: "אין הרשאה" }, { status: 403 });
  }

  const ua = request.headers.get("user-agent") ?? null;

  const { error: upErr } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: ua,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (upErr) {
    console.error("[push/subscribe] upsert", upErr);
    return NextResponse.json({ ok: false, error: "שמירה נכשלה" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const user = await getUserFromBearerToken(token);
  if (!user) {
    return NextResponse.json({ ok: false, error: "לא מחובר" }, { status: 401 });
  }

  let endpoint: string | null = null;
  try {
    const j = (await request.json()) as { endpoint?: string };
    endpoint = typeof j.endpoint === "string" ? j.endpoint : null;
  } catch {
    return NextResponse.json({ ok: false, error: "גוף לא תקין" }, { status: 400 });
  }

  if (!endpoint) {
    return NextResponse.json({ ok: false, error: "חסר endpoint" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("profile_id", user.id);

  if (error) {
    console.error("[push/subscribe] delete", error);
    return NextResponse.json({ ok: false, error: "מחיקה נכשלה" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
