import { NextRequest, NextResponse } from "next/server";
import { getWhatsappConversationThread } from "@/lib/whatsapp/inboxService";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");
    if (!conversationId) {
      return NextResponse.json({ ok: false, error: "conversationId is required" }, { status: 400 });
    }
    const thread = await getWhatsappConversationThread(conversationId);
    return NextResponse.json({ ok: true, thread });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

