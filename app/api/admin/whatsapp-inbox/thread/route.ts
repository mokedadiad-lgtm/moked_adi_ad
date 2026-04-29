import { NextRequest, NextResponse } from "next/server";
import { getWhatsappConversationThread } from "@/lib/whatsapp/inboxService";
import { requireAdminFromRequest } from "@/lib/supabase/admin-route-auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminFromRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");
    const beforeAt = url.searchParams.get("beforeAt");
    const rawLimit = Number(url.searchParams.get("limit") ?? "");
    const limit = Number.isFinite(rawLimit) ? rawLimit : undefined;
    if (!conversationId) {
      return NextResponse.json({ ok: false, error: "conversationId is required" }, { status: 400 });
    }
    const page = await getWhatsappConversationThread(conversationId, {
      beforeAt: beforeAt && beforeAt.trim() ? beforeAt : null,
      limit,
    });
    return NextResponse.json({ ok: true, thread: page.items, hasMore: page.hasMore, nextBeforeAt: page.nextBeforeAt });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

