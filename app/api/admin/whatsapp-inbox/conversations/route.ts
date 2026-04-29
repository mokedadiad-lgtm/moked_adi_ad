import { NextRequest, NextResponse } from "next/server";
import {
  getWhatsappInboxConversations,
  type InboxFilter,
} from "@/lib/whatsapp/inboxService";
import { requireAdminFromRequest } from "@/lib/supabase/admin-route-auth";

const ALLOWED_FILTERS: Set<string> = new Set(["all", "bot_intake", "anonymous", "team"]);

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminFromRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const raw = url.searchParams.get("filter") ?? "all";
    const filter = ALLOWED_FILTERS.has(raw) ? (raw as InboxFilter) : "all";

    const conversations = await getWhatsappInboxConversations(filter);
    return NextResponse.json({ ok: true, conversations });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

