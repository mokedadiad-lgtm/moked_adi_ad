import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  sendMetaWhatsAppInitiatedWithLog,
  sendMetaWhatsAppTextWithLog,
} from "@/lib/whatsapp/outbound";
import { normalizeMetaPhone } from "@/lib/whatsapp/meta";

export type InboxKind = "bot_intake" | "anonymous" | "team";
export type InboxFilter = "all" | InboxKind;

export type WhatsAppConversationMode = "bot" | "human";

export interface InboxConversationItem {
  id: string;
  phone: string;
  mode: WhatsAppConversationMode;
  inbox_kind: InboxKind;
  unread_count: number;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
}

export interface InboxThreadItem {
  id: string;
  direction: "inbound" | "outbound";
  at: string;
  text: string;
  message_type: string | null;
  channel_event: string | null;
  status: string | null;
}

export interface TeamProfileOption {
  id: string;
  full_name_he: string | null;
  phone: string;
}

function safePreview(v: unknown): string {
  if (typeof v !== "string") return "";
  return v;
}

/** Text shown in admin thread for outbound rows — prefers stored preview, never exposes internal channel_event ids. */
export function resolveOutboundThreadDisplayText(payload: Record<string, unknown>): string {
  const direct =
    safePreview(payload.preview) ||
    safePreview(payload.bodyPreview) ||
    safePreview((payload as { text?: unknown }).text) ||
    "";
  if (direct.trim()) return direct.trim();

  if (payload.kind === "template") {
    const arr = payload.bodyParamsPreview;
    if (Array.isArray(arr)) {
      const parts = arr.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
      if (parts.length) return parts.join("\n");
    }
  }

  return "נשלחה הודעה (WhatsApp)";
}

export async function getWhatsappInboxConversations(
  filter: InboxFilter = "all"
): Promise<InboxConversationItem[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("whatsapp_conversations")
    .select("id, phone, mode, inbox_kind, unread_count, last_inbound_at, last_outbound_at")
    .order("last_inbound_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (filter !== "all") query = query.eq("inbox_kind", filter);

  const { data, error } = await query;
  if (error) {
    console.error("getWhatsappInboxConversations:", error);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    phone: (r.phone as string) ?? "",
    mode: ((r.mode as WhatsAppConversationMode | null) ?? "bot") as WhatsAppConversationMode,
    inbox_kind: ((r.inbox_kind as InboxKind | null) ?? "bot_intake") as InboxKind,
    unread_count: Number(r.unread_count ?? 0),
    last_inbound_at: (r.last_inbound_at as string | null) ?? null,
    last_outbound_at: (r.last_outbound_at as string | null) ?? null,
  }));
}

export async function getWhatsappConversationThread(
  conversationId: string
): Promise<InboxThreadItem[]> {
  const supabase = getSupabaseAdmin();

  const [{ data: inbound, error: inErr }, { data: outbound, error: outErr }] = await Promise.all([
    supabase
      .from("whatsapp_inbound_messages")
      .select("id, received_at, message_type, text_body")
      .eq("conversation_id", conversationId)
      .order("received_at", { ascending: true })
      .limit(500),
    supabase
      .from("whatsapp_outbound_messages")
      .select("id, created_at, channel_event, status, payload")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  if (inErr) console.error("getWhatsappConversationThread inbound:", inErr);
  if (outErr) console.error("getWhatsappConversationThread outbound:", outErr);

  const inRows: InboxThreadItem[] = (inbound ?? []).map((m) => ({
    id: `in_${m.id as string}`,
    direction: "inbound",
    at: (m.received_at as string) ?? new Date().toISOString(),
    text: (m.text_body as string | null) ?? "(הודעה לא טקסטואלית)",
    message_type: (m.message_type as string | null) ?? null,
    channel_event: null,
    status: "received",
  }));

  const outRows: InboxThreadItem[] = (outbound ?? []).map((m) => {
    const payload = (m.payload as Record<string, unknown> | null) ?? {};
    const text = resolveOutboundThreadDisplayText(payload);

    return {
      id: `out_${m.id as string}`,
      direction: "outbound",
      at: (m.created_at as string) ?? new Date().toISOString(),
      text,
      message_type: "text",
      channel_event: (m.channel_event as string | null) ?? null,
      status: (m.status as string | null) ?? null,
    };
  });

  return [...inRows, ...outRows].sort((a, b) => a.at.localeCompare(b.at));
}

export async function markWhatsappConversationRead(conversationId: string): Promise<{ ok: boolean }> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) {
    console.error("markWhatsappConversationRead:", error);
    return { ok: false };
  }
  return { ok: true };
}

/** Clears unread for every conversation (admin bell "mark all read"). */
export async function markAllWhatsappConversationsRead(): Promise<{ ok: boolean }> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .gt("unread_count", 0);

  if (error) {
    console.error("markAllWhatsappConversationsRead:", error);
    return { ok: false };
  }
  return { ok: true };
}

export async function sendWhatsappHumanReply(
  conversationId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  const clean = text.trim();
  if (!clean) return { ok: false, error: "נא להזין תוכן הודעה" };

  const { data: conv, error: convErr } = await supabase
    .from("whatsapp_conversations")
    .select("id, phone")
    .eq("id", conversationId)
    .maybeSingle();

  if (convErr || !conv?.phone) return { ok: false, error: "שיחה לא נמצאה" };

  const convPhoneNorm = normalizeMetaPhone(conv.phone as string);

  const teamPhoneSet = new Set<string>();
  try {
    const { data: teamProfiles } = await supabase
      .from("profiles")
      .select("phone")
      .or(
        "is_admin.eq.true,is_technical_lead.eq.true,is_respondent.eq.true,is_proofreader.eq.true,is_linguistic_editor.eq.true"
      );
    for (const p of teamProfiles ?? []) {
      const n = normalizeMetaPhone((p as { phone?: string | null }).phone ?? "");
      if (n) teamPhoneSet.add(n);
    }
  } catch (e) {
    // If we can't determine team-ness, keep inbox_kind unchanged (safe fallback).
    console.error("sendWhatsappHumanReply: team phone preload failed", e);
  }

  const result = await sendMetaWhatsAppTextWithLog(conv.phone as string, clean, {
    channel_event: "admin_inbox_reply",
    conversation_id: conversationId,
    idempotency_key: `admin_reply_${conversationId}_${Date.now()}`,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const isTeam = Boolean(convPhoneNorm && teamPhoneSet.has(convPhoneNorm));
  const nextInboxKind: InboxKind = isTeam ? "team" : "anonymous";

  await supabase
    .from("whatsapp_conversations")
    .update({
      mode: "human",
      inbox_kind: nextInboxKind,
      last_outbound_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  return { ok: true };
}

export async function getTeamWhatsappProfiles(): Promise<TeamProfileOption[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name_he, phone, is_admin, is_technical_lead, is_respondent, is_proofreader, is_linguistic_editor"
    )
    .not("phone", "is", null)
    .order("full_name_he");

  if (error) {
    console.error("getTeamWhatsappProfiles:", error);
    return [];
  }

  return (data ?? [])
    .filter(
      (p) =>
        p.is_admin === true ||
        p.is_technical_lead === true ||
        p.is_respondent === true ||
        p.is_proofreader === true ||
        p.is_linguistic_editor === true
    )
    .map((p) => ({
      id: p.id as string,
      full_name_he: (p.full_name_he as string | null) ?? null,
      phone: (p.phone as string | null)?.trim() ?? "",
    }))
    .filter((p) => p.phone.length > 0);
}

export async function startWhatsappTeamConversation(
  profileId: string
): Promise<{ ok: boolean; error?: string; conversationId?: string }> {
  const supabase = getSupabaseAdmin();

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name_he, phone")
    .eq("id", profileId)
    .maybeSingle();

  if (profileErr || !profile?.phone) {
    return { ok: false, error: "לא נמצא מספר וואטסאפ לאיש הצוות" };
  }

  const phone = (profile.phone as string).trim();

  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  let conversationId = (existing?.id as string | undefined) ?? "";
  if (!conversationId) {
    const { data: created, error: createErr } = await supabase
      .from("whatsapp_conversations")
      .insert({
        phone,
        mode: "human",
        inbox_kind: "team",
        state: "start",
        context: {},
        unread_count: 0,
        last_outbound_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (createErr || !created?.id) {
      return { ok: false, error: createErr?.message ?? "שגיאה בפתיחת שיחה" };
    }
    conversationId = created.id as string;
  } else {
    await supabase
      .from("whatsapp_conversations")
      .update({
        mode: "human",
        inbox_kind: "team",
        last_outbound_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);
  }

  const result = await sendMetaWhatsAppInitiatedWithLog(phone, {
    templateKey: "team_opening",
    channel_event: "admin_team_opening",
    conversation_id: conversationId,
    idempotency_key: `admin_team_opening_${conversationId}_${Date.now()}`,
    bodyParameters: [],
    legacyText: "שלום, מה נשמע?",
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, conversationId };
}

