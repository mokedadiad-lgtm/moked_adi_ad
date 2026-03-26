import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUserFromBearerToken } from "@/lib/supabase/route-auth";

function authToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export async function GET(request: NextRequest) {
  const user = await getUserFromBearerToken(authToken(request));
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("push_notifications_muted_until, push_notifications_muted_forever, is_admin, is_technical_lead")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "פרופיל לא נמצא" }, { status: 404 });
  }

  if (data.is_admin !== true && data.is_technical_lead !== true) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const forever = data.push_notifications_muted_forever === true;
  const raw = data.push_notifications_muted_until as string | null | undefined;
  const mutedUntil =
    forever
      ? null
      : raw && new Date(raw) > new Date()
        ? new Date(raw).toISOString()
        : null;

  return NextResponse.json({ mutedUntil, mutedForever: forever });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromBearerToken(authToken(request));
  if (!user) {
    return NextResponse.json({ ok: false, error: "לא מחובר" }, { status: 401 });
  }

  let body: { hours?: number; clear?: boolean; forever?: boolean };
  try {
    body = (await request.json()) as { hours?: number; clear?: boolean; forever?: boolean };
  } catch {
    return NextResponse.json({ ok: false, error: "גוף לא תקין" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("is_admin, is_technical_lead")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr || !profile) {
    return NextResponse.json({ ok: false, error: "פרופיל לא נמצא" }, { status: 404 });
  }

  if (profile.is_admin !== true && profile.is_technical_lead !== true) {
    return NextResponse.json({ ok: false, error: "אין הרשאה" }, { status: 403 });
  }

  if (body.clear === true) {
    const { error } = await supabase
      .from("profiles")
      .update({
        push_notifications_muted_until: null,
        push_notifications_muted_forever: false,
      })
      .eq("id", user.id);
    if (error) {
      console.error("[push/mute] clear", error);
      return NextResponse.json({ ok: false, error: "עדכון נכשל" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, mutedUntil: null, mutedForever: false });
  }

  if (body.forever === true) {
    const { error } = await supabase
      .from("profiles")
      .update({
        push_notifications_muted_forever: true,
        push_notifications_muted_until: null,
      })
      .eq("id", user.id);
    if (error) {
      console.error("[push/mute] forever", error);
      return NextResponse.json({ ok: false, error: "עדכון נכשל" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, mutedUntil: null, mutedForever: true });
  }

  const hours = typeof body.hours === "number" ? body.hours : NaN;
  if (![1, 4, 8, 24].includes(hours)) {
    return NextResponse.json({ ok: false, error: "ערך שעות לא תקין" }, { status: 400 });
  }

  const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      push_notifications_muted_until: until,
      push_notifications_muted_forever: false,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[push/mute] set", error);
    return NextResponse.json({ ok: false, error: "עדכון נכשל" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mutedUntil: until, mutedForever: false });
}
