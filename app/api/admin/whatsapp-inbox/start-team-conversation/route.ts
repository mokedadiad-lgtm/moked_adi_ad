import { NextRequest, NextResponse } from "next/server";
import { startWhatsappTeamConversation } from "@/lib/whatsapp/inboxService";
import { requireAdminFromRequest } from "@/lib/supabase/admin-route-auth";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminFromRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const body = (await req.json()) as { profileId?: string };
    if (!body.profileId) {
      return NextResponse.json({ ok: false, error: "profileId is required" }, { status: 400 });
    }
    const res = await startWhatsappTeamConversation(body.profileId);
    return NextResponse.json({ ok: res.ok, error: res.error, conversationId: res.conversationId });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

