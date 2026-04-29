import { NextRequest, NextResponse } from "next/server";
import { markWhatsappConversationRead } from "@/lib/whatsapp/inboxService";
import { requireAdminFromRequest } from "@/lib/supabase/admin-route-auth";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminFromRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const body = (await req.json()) as { conversationId?: string };
    if (!body.conversationId) {
      return NextResponse.json({ ok: false, error: "conversationId is required" }, { status: 400 });
    }
    const res = await markWhatsappConversationRead(body.conversationId);
    return NextResponse.json({ ok: res.ok });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

