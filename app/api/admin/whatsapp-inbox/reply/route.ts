import { NextRequest, NextResponse } from "next/server";
import { sendWhatsappHumanReply } from "@/lib/whatsapp/inboxService";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { conversationId?: string; text?: string };
    if (!body.conversationId || typeof body.text !== "string") {
      return NextResponse.json({ ok: false, error: "conversationId and text are required" }, { status: 400 });
    }
    const res = await sendWhatsappHumanReply(body.conversationId, body.text);
    return NextResponse.json({ ok: res.ok, error: res.error });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

