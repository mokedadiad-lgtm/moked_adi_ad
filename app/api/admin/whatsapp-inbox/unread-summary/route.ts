import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type InboxKind = "bot_intake" | "anonymous" | "team";

type UnreadConversationItem = {
  conversationId: string;
  inbox_kind: InboxKind;
  phone: string;
  unread_count: number;
  last_inbound_at: string | null;
  last_text_preview: string;
};

export async function GET() {
  const supabase = getSupabaseAdmin();

  const kinds: InboxKind[] = ["bot_intake", "anonymous", "team"];

  const [
    { data: convs, error },
    { count: unreadConversationCount, error: countErr },
    ...byKindCountResults
  ] = await Promise.all([
    supabase
      .from("whatsapp_conversations")
      .select("id, inbox_kind, phone, unread_count, last_inbound_at")
      .gt("unread_count", 0)
      .order("last_inbound_at", { ascending: false })
      .limit(20),
    supabase
      .from("whatsapp_conversations")
      .select("*", { count: "exact", head: true })
      .gt("unread_count", 0),
    ...kinds.map((k) =>
      supabase
        .from("whatsapp_conversations")
        .select("*", { count: "exact", head: true })
        .eq("inbox_kind", k)
        .gt("unread_count", 0)
    ),
  ]);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (countErr) {
    return NextResponse.json({ ok: false, error: countErr.message }, { status: 500 });
  }
  for (const r of byKindCountResults) {
    if (r.error) {
      return NextResponse.json({ ok: false, error: r.error.message }, { status: 500 });
    }
  }

  const itemsBase = (convs ?? []).map((c) => ({
    conversationId: c.id as string,
    inbox_kind: (c.inbox_kind as InboxKind | null) ?? "bot_intake",
    phone: (c.phone as string) ?? "",
    unread_count: Number(c.unread_count ?? 0),
    last_inbound_at: (c.last_inbound_at as string | null) ?? null,
  }));

  // One unit per conversation (not sum of per-message counters).
  const totalUnread = unreadConversationCount ?? itemsBase.length;

  const byKind: Record<InboxKind, number> = { bot_intake: 0, anonymous: 0, team: 0 };
  kinds.forEach((k, i) => {
    const c = byKindCountResults[i]?.count;
    byKind[k] = typeof c === "number" ? c : 0;
  });

  // Previews for bell popover (detail list)
  const top = itemsBase.slice(0, 10);
  const previews = await Promise.all(
    top.map(async (t) => {
      const { data: lastInbound } = await supabase
        .from("whatsapp_inbound_messages")
        .select("text_body, message_type, payload")
        .eq("conversation_id", t.conversationId)
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const textBody = (lastInbound as any)?.text_body as string | null | undefined;
      const messageType = (lastInbound as any)?.message_type as string | null | undefined;

      const preview =
        (textBody && textBody.trim()) ||
        (messageType === "button" ? "לחיצה על כפתור" : "הודעה חדשה") ||
        "—";

      const item: UnreadConversationItem = {
        conversationId: t.conversationId,
        inbox_kind: t.inbox_kind,
        phone: t.phone,
        unread_count: t.unread_count > 0 ? 1 : 0,
        last_inbound_at: t.last_inbound_at,
        last_text_preview: preview,
      };
      return item;
    })
  );

  return NextResponse.json({
    ok: true,
    totalUnread,
    byKind,
    /** סה״כ שיחות עם דואר שלא נקרא; items הוא עד 10 לפי תצוגה */
    conversationsWithUnread: totalUnread,
    items: previews,
  });
}

