import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  sendMetaWhatsAppInitiatedWithLog,
  sendMetaWhatsAppTextWithLog,
} from "@/lib/whatsapp/outbound";
import { normalizeMetaPhone } from "@/lib/whatsapp/meta";
import { getWhatsAppTemplateName } from "@/lib/whatsapp/templateConfig";

export type InboxKind = "bot_intake" | "anonymous" | "team";
export type InboxFilter = "all" | InboxKind;

export type WhatsAppConversationMode = "bot" | "human";

export interface InboxConversationItem {
  id: string;
  phone: string;
  mode: WhatsAppConversationMode;
  inbox_kind: InboxKind;
  display_name: string | null;
  role_labels: string[];
  display_title: string;
  unread_count: number;
  unread_anchor_at: string | null;
  is_outside_24h_window: boolean;
  seconds_since_last_inbound: number | null;
  is_opening_template_configured: boolean;
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

export interface InboxThreadPage {
  items: InboxThreadItem[];
  hasMore: boolean;
  nextBeforeAt: string | null;
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

function buildTeamRoleLabels(profile: {
  is_admin?: boolean | null;
  is_technical_lead?: boolean | null;
  is_respondent?: boolean | null;
  is_proofreader?: boolean | null;
  is_linguistic_editor?: boolean | null;
}): string[] {
  if (profile.is_admin === true) return ["מנהל מערכת"];
  const labels: string[] = [];
  if (profile.is_technical_lead === true) labels.push("אחראי טכני");
  if (profile.is_respondent === true) labels.push("משיב");
  if (profile.is_proofreader === true) labels.push("מגיה");
  if (profile.is_linguistic_editor === true) labels.push("עורך לשוני");
  return labels;
}

function getSecondsSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 1000));
}

function isOutside24hWindow(lastInboundAt: string | null | undefined): boolean {
  const sec = getSecondsSince(lastInboundAt);
  if (sec == null) return true;
  return sec > 24 * 60 * 60;
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

  const rows = (data ?? []) as Array<{
    id: string;
    phone: string | null;
    mode: WhatsAppConversationMode | null;
    inbox_kind: InboxKind | null;
    unread_count: number | null;
    last_inbound_at: string | null;
    last_outbound_at: string | null;
  }>;

  const normalizedPhones = Array.from(
    new Set(
      rows
        .map((r) => normalizeMetaPhone(r.phone ?? ""))
        .filter((p): p is string => Boolean(p))
    )
  );

  const teamByPhone = new Map<
    string,
    { full_name_he: string | null; role_labels: string[] }
  >();
  if (normalizedPhones.length > 0) {
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select(
        "phone, full_name_he, is_admin, is_technical_lead, is_respondent, is_proofreader, is_linguistic_editor"
      )
      .or(
        "is_admin.eq.true,is_technical_lead.eq.true,is_respondent.eq.true,is_proofreader.eq.true,is_linguistic_editor.eq.true"
      );

    if (profilesErr) {
      console.error("getWhatsappInboxConversations profiles:", profilesErr);
    } else {
      for (const p of profiles ?? []) {
        const phoneNorm = normalizeMetaPhone((p as { phone?: string | null }).phone ?? "");
        if (!phoneNorm) continue;
        if (!normalizedPhones.includes(phoneNorm)) continue;
        teamByPhone.set(phoneNorm, {
          full_name_he: ((p as { full_name_he?: string | null }).full_name_he ?? null),
          role_labels: buildTeamRoleLabels(p as {
            is_admin?: boolean | null;
            is_technical_lead?: boolean | null;
            is_respondent?: boolean | null;
            is_proofreader?: boolean | null;
            is_linguistic_editor?: boolean | null;
          }),
        });
      }
    }
  }

  return rows.map((r) => {
    const phone = r.phone ?? "";
    const phoneNorm = normalizeMetaPhone(phone);
    const teamMeta = phoneNorm ? teamByPhone.get(phoneNorm) : undefined;
    const displayName = teamMeta?.full_name_he?.trim() ? teamMeta.full_name_he.trim() : null;
    const roleLabels = teamMeta?.role_labels ?? [];
    const displayTitle = displayName
      ? roleLabels.length > 0
        ? `${displayName} · ${roleLabels.join(", ")}`
        : displayName
      : phone;

    const secondsSinceLastInbound = getSecondsSince(r.last_inbound_at);
    const outside24h = isOutside24hWindow(r.last_inbound_at);
    return {
      id: r.id,
      phone,
      mode: (r.mode ?? "bot") as WhatsAppConversationMode,
      inbox_kind: (r.inbox_kind ?? "bot_intake") as InboxKind,
      display_name: displayName,
      role_labels: roleLabels,
      display_title: displayTitle,
      unread_count: Number(r.unread_count ?? 0),
      unread_anchor_at: Number(r.unread_count ?? 0) > 0 ? (r.last_inbound_at ?? null) : null,
      is_outside_24h_window: outside24h,
      seconds_since_last_inbound: secondsSinceLastInbound,
      is_opening_template_configured: Boolean(getWhatsAppTemplateName("team_opening")),
      last_inbound_at: r.last_inbound_at ?? null,
      last_outbound_at: r.last_outbound_at ?? null,
    };
  });
}

export async function getWhatsappConversationThread(
  conversationId: string,
  options?: { beforeAt?: string | null; limit?: number }
): Promise<InboxThreadPage> {
  const supabase = getSupabaseAdmin();
  const fetchLimit = Math.min(Math.max(options?.limit ?? 60, 20), 120);
  const beforeAt = options?.beforeAt ?? null;

  let inQuery = supabase
      .from("whatsapp_inbound_messages")
      .select("id, received_at, message_type, text_body")
      .eq("conversation_id", conversationId)
      .order("received_at", { ascending: false })
      .limit(fetchLimit + 1);
  let outQuery = supabase
      .from("whatsapp_outbound_messages")
      .select("id, created_at, channel_event, status, payload")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(fetchLimit + 1);
  if (beforeAt) {
    inQuery = inQuery.lt("received_at", beforeAt);
    outQuery = outQuery.lt("created_at", beforeAt);
  }

  const [{ data: inbound, error: inErr }, { data: outbound, error: outErr }] = await Promise.all([
    inQuery,
    outQuery,
  ]);

  if (inErr) console.error("getWhatsappConversationThread inbound:", inErr);
  if (outErr) console.error("getWhatsappConversationThread outbound:", outErr);

  const inSlice = (inbound ?? []).slice(0, fetchLimit);
  const outSlice = (outbound ?? []).slice(0, fetchLimit);
  const hasMore = (inbound ?? []).length > fetchLimit || (outbound ?? []).length > fetchLimit;

  const inRows: InboxThreadItem[] = inSlice.map((m) => ({
    id: `in_${m.id as string}`,
    direction: "inbound",
    at: (m.received_at as string) ?? new Date().toISOString(),
    text: (m.text_body as string | null) ?? "(הודעה לא טקסטואלית)",
    message_type: (m.message_type as string | null) ?? null,
    channel_event: null,
    status: "received",
  }));

  const outRows: InboxThreadItem[] = outSlice.map((m) => {
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

  const items = [...inRows, ...outRows].sort((a, b) => a.at.localeCompare(b.at));
  const nextBeforeAt = items.length > 0 ? items[0]!.at : null;
  return { items, hasMore, nextBeforeAt };
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
    .select("id, phone, last_inbound_at")
    .eq("id", conversationId)
    .maybeSingle();

  if (convErr || !conv?.phone) return { ok: false, error: "שיחה לא נמצאה" };
  if (isOutside24hWindow((conv as { last_inbound_at?: string | null }).last_inbound_at ?? null)) {
    return { ok: false, error: "עבר חלון 24 שעות. ניתן לשלוח רק הודעת פתיחה יזומה." };
  }

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

export async function sendWhatsappOpeningTemplate(
  conversationId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  const { data: conv, error: convErr } = await supabase
    .from("whatsapp_conversations")
    .select("id, phone")
    .eq("id", conversationId)
    .maybeSingle();
  if (convErr || !conv?.phone) return { ok: false, error: "שיחה לא נמצאה" };

  if (!getWhatsAppTemplateName("team_opening")) {
    return { ok: false, error: "Template פתיחה לא מוגדר. יש להגדיר WHATSAPP_TEMPLATE_TEAM_OPENING." };
  }

  const result = await sendMetaWhatsAppInitiatedWithLog(conv.phone as string, {
    templateKey: "team_opening",
    channel_event: "admin_team_opening",
    conversation_id: conversationId,
    idempotency_key: `admin_team_opening_from_chat_${conversationId}_${Date.now()}`,
    bodyParameters: [],
    legacyText: "שלום, מה נשמע?",
  });
  if (!result.ok) return { ok: false, error: result.error };

  await supabase
    .from("whatsapp_conversations")
    .update({
      mode: "human",
      inbox_kind: "team",
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

export async function openWhatsappTeamConversation(
  profileId: string
): Promise<{ ok: boolean; error?: string; conversationId?: string }> {
  const supabase = getSupabaseAdmin();

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, phone")
    .eq("id", profileId)
    .maybeSingle();

  if (profileErr || !profile?.phone) {
    return { ok: false, error: "לא נמצא מספר וואטסאפ לאיש הקשר" };
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);
  }

  return { ok: true, conversationId };
}

export async function clearWhatsappConversationHistory(
  conversationId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  const [{ error: inErr }, { error: outErr }] = await Promise.all([
    supabase.from("whatsapp_inbound_messages").delete().eq("conversation_id", conversationId),
    supabase.from("whatsapp_outbound_messages").delete().eq("conversation_id", conversationId),
  ]);

  if (inErr || outErr) {
    return { ok: false, error: inErr?.message ?? outErr?.message ?? "שגיאה במחיקת היסטוריה" };
  }

  const { error: convErr } = await supabase
    .from("whatsapp_conversations")
    .update({
      unread_count: 0,
      last_inbound_at: null,
      last_outbound_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (convErr) return { ok: false, error: convErr.message };
  return { ok: true };
}

export async function deleteWhatsappConversation(
  conversationId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  const [{ error: inErr }, { error: outErr }] = await Promise.all([
    supabase.from("whatsapp_inbound_messages").delete().eq("conversation_id", conversationId),
    supabase.from("whatsapp_outbound_messages").delete().eq("conversation_id", conversationId),
  ]);
  if (inErr || outErr) {
    return { ok: false, error: inErr?.message ?? outErr?.message ?? "שגיאה במחיקת הודעות השיחה" };
  }

  const { error: convErr } = await supabase
    .from("whatsapp_conversations")
    .delete()
    .eq("id", conversationId);

  if (convErr) return { ok: false, error: convErr.message };
  return { ok: true };
}

