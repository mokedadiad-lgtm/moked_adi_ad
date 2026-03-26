import { NextResponse } from "next/server";
import { markAllWhatsappConversationsRead } from "@/lib/whatsapp/inboxService";

export async function POST() {
  try {
    const res = await markAllWhatsappConversationsRead();
    return NextResponse.json({ ok: res.ok });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
