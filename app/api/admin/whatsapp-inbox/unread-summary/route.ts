import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { formatPhoneForDisplay } from "@/lib/whatsapp/inboxService";
import { normalizeMetaPhone } from "@/lib/whatsapp/meta";
import { requireAdminFromRequest } from "@/lib/supabase/admin-route-auth";

type InboxKind = "bot_intake" | "anonymous" | "team";

type UnreadConversationItem = {
  conversationId: string;
  inbox_kind: InboxKind;
  phone: string;
  formatted_phone: string;
  display_title: string;
  role_labels: string[];
  unread_count: number;
  last_inbound_at: string | null;
  last_text_preview: string;
};

function inboundPreviewLabel(params: { messageType: string | null | undefined; textBody: string | null | undefined }): string {
  const text = params.textBody?.trim();
  if (text) return text;
  if (params.messageType === "image") return "📷 תמונה";
  if (params.messageType === "audio") return "🎤 הודעת אודיו";
  if (params.messageType === "video") return "🎬 וידאו";
  if (params.messageType === "document") return "📄 מסמך";
  if (params.messageType === "button") return "לחיצה על כפתור";
  return "הודעה חדשה";
}

function buildTeamRoleLabels(profile: {
  is_admin?: boolean | null;
  is_technical_lead?: boolean | null;
  is_respondent?: boolean | null;
  is_proofreader?: boolean | null;
  is_linguistic_editor?: boolean | null;
}): string[] {
  if (profile.is_technical_lead === true) return ["אחראי טכני"];
  if (profile.is_admin === true) return ["מנהל מערכת"];
  const labels: string[] = [];
  if (profile.is_respondent === true) labels.push("משיב");
  if (profile.is_proofreader === true) labels.push("מגיה");
  if (profile.is_linguistic_editor === true) labels.push("עורך לשוני");
  return labels;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminFromRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const supabase = getSupabaseAdmin();

  const inboxKinds: InboxKind[] = ["anonymous", "team"];

  const [
    { data: convs, error },
    { count: unreadConversationCount, error: countErr },
    ...byKindCountResults
  ] = await Promise.all([
    supabase
      .from("whatsapp_conversations")
      .select("id, inbox_kind, phone, unread_count, last_inbound_at")
      .in("inbox_kind", inboxKinds)
      .gt("unread_count", 0)
      .order("last_inbound_at", { ascending: false })
      .limit(20),
    supabase
      .from("whatsapp_conversations")
      .select("*", { count: "exact", head: true })
      .in("inbox_kind", inboxKinds)
      .gt("unread_count", 0),
    ...inboxKinds.map((k) =>
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
    formatted_phone: formatPhoneForDisplay((c.phone as string) ?? ""),
    unread_count: Number(c.unread_count ?? 0),
    last_inbound_at: (c.last_inbound_at as string | null) ?? null,
  }));

  const normalizedPhones = Array.from(
    new Set(
      itemsBase
        .map((i) => normalizeMetaPhone(i.phone))
        .filter((p): p is string => Boolean(p))
    )
  );
  const teamByPhone = new Map<string, { name: string; role_labels: string[] }>();
  if (normalizedPhones.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select(
        "phone, full_name_he, is_admin, is_technical_lead, is_respondent, is_proofreader, is_linguistic_editor"
      )
      .or(
        "is_admin.eq.true,is_technical_lead.eq.true,is_respondent.eq.true,is_proofreader.eq.true,is_linguistic_editor.eq.true"
      );
    for (const p of profiles ?? []) {
      const n = normalizeMetaPhone((p as { phone?: string | null }).phone ?? "");
      if (!n) continue;
      if (!normalizedPhones.includes(n)) continue;
      const name = ((p as { full_name_he?: string | null }).full_name_he ?? "").trim();
      if (!name) continue;
      teamByPhone.set(n, {
        name,
        role_labels: buildTeamRoleLabels(
          p as {
            is_admin?: boolean | null;
            is_technical_lead?: boolean | null;
            is_respondent?: boolean | null;
            is_proofreader?: boolean | null;
            is_linguistic_editor?: boolean | null;
          }
        ),
      });
    }
  }

  // One unit per conversation (not sum of per-message counters).
  const totalUnread = unreadConversationCount ?? itemsBase.length;

  const byKind: Record<InboxKind, number> = { bot_intake: 0, anonymous: 0, team: 0 };
  inboxKinds.forEach((k, i) => {
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

      const preview = inboundPreviewLabel({ messageType, textBody });

      const item: UnreadConversationItem = {
        conversationId: t.conversationId,
        inbox_kind: t.inbox_kind,
        phone: t.phone,
        formatted_phone: t.formatted_phone || t.phone,
        display_title:
          t.inbox_kind === "team"
            ? teamByPhone.get(normalizeMetaPhone(t.phone) ?? "")?.name ?? (t.formatted_phone || t.phone)
            : (t.formatted_phone || t.phone),
        role_labels:
          t.inbox_kind === "team"
            ? teamByPhone.get(normalizeMetaPhone(t.phone) ?? "")?.role_labels ?? []
            : [],
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

