import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearerToken } from "@/lib/supabase/route-auth";
import { isPushConfigured } from "@/lib/push/config";
import { sendInboxPushToProfile } from "@/lib/push/send-admin-inbox-push";

function authToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export async function POST(request: NextRequest) {
  if (!isPushConfigured()) {
    return NextResponse.json({ ok: false, error: "התראות דחיפה לא הוגדרו בשרת" }, { status: 503 });
  }

  const user = await getUserFromBearerToken(authToken(request));
  if (!user) return NextResponse.json({ ok: false, error: "לא מחובר" }, { status: 401 });

  try {
    // Test notification should help the admin verify that push works even if currently muted.
    await sendInboxPushToProfile(
      user.id,
      { title: "טסט התראה", body: "זוהי התראת בדיקה עבור דואר נכנס.", url: "/admin/whatsapp-inbox" },
      { ignoreMute: true }
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

