import { NextRequest, NextResponse } from "next/server";
import { markAllWhatsappConversationsRead } from "@/lib/whatsapp/inboxService";
import { requireAdminFromRequest } from "@/lib/supabase/admin-route-auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminFromRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const res = await markAllWhatsappConversationsRead();
    return NextResponse.json({ ok: res.ok });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
