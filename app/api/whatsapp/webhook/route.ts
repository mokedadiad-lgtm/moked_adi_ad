import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { runBotFsm, type BotConversationState, type BotContext } from "@/lib/whatsapp/botFsm";
import { classifyConversationKind } from "@/lib/whatsapp/inboxKind";
import { normalizeMetaPhone, sendMetaWhatsAppButtons, sendMetaWhatsAppList, sendMetaWhatsAppText } from "@/lib/whatsapp/meta";
import { logWhatsAppOutbound } from "@/lib/whatsapp/outbound";

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return false;
  if (!signatureHeader) return false;
  if (!signatureHeader.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return timingSafeEqual(expected, signatureHeader);
}

/**
 * Meta WhatsApp Cloud API webhook verification (GET)
 * Meta sends: hub.mode, hub.verify_token, hub.challenge
 */
export async function GET(request: Request) {
  const req = request as NextRequest;
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    return NextResponse.json({ error: "Missing WHATSAPP_VERIFY_TOKEN" }, { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken && challenge !== null) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          [k: string]: unknown;
        }>;
        statuses?: unknown[];
        contacts?: unknown[];
        [k: string]: unknown;
      };
    }>;
  }>;
};

function normalizedPhoneKey(raw: string | null | undefined): string {
  if (!raw) return "";
  const n = normalizeMetaPhone(raw);
  if (n) return n;
  return raw.replace(/\D/g, "");
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(rawBody, sig)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: MetaWebhookPayload | null = null;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const teamPhoneSet = new Set<string>();
  try {
    const { data: teamProfiles } = await supabase
      .from("profiles")
      .select("phone")
      .or("is_admin.eq.true,is_technical_lead.eq.true,is_respondent.eq.true,is_proofreader.eq.true,is_linguistic_editor.eq.true");
    for (const p of teamProfiles ?? []) {
      const k = normalizedPhoneKey((p as { phone?: string | null }).phone ?? null);
      if (k) teamPhoneSet.add(k);
    }
  } catch (e) {
    console.error("whatsapp webhook: team phone preload failed", e);
  }

  const messages: Array<{
    provider_message_id: string;
    from_phone: string;
    message_type: string | null;
    text_body: string | null;
    buttonId: string | null;
    listReplyId: string | null;
    payload: unknown;
  }> = [];

  for (const entry of payload?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      for (const m of value?.messages ?? []) {
        const id = typeof m.id === "string" ? m.id : null;
        const from = typeof m.from === "string" ? m.from : null;
        if (!id || !from) continue;
        const type = typeof m.type === "string" ? m.type : null;
        const text = typeof m.text?.body === "string" ? m.text.body : null;
        const interactive = (m as { interactive?: unknown }).interactive as
          | {
              type?: string;
              button_reply?: { id?: string };
              list_reply?: { id?: string; title?: string };
            }
          | undefined;
        const buttonId =
          typeof interactive?.button_reply?.id === "string" ? interactive.button_reply.id : null;
        const listReplyId =
          typeof interactive?.list_reply?.id === "string" ? interactive.list_reply.id : null;
        const listTitle =
          typeof interactive?.list_reply?.title === "string" ? interactive.list_reply.title : null;
        messages.push({
          provider_message_id: id,
          from_phone: from,
          message_type: type,
          text_body: text ?? listTitle,
          buttonId,
          listReplyId,
          payload: m,
        });
      }
    }
  }

  async function sendOutbound(
    toPhoneRaw: string,
    convId: string | undefined,
    outbound: Array<{ kind: string; [k: string]: unknown }>
  ) {
    for (const o of outbound) {
      if (o.kind === "text") {
        const text = typeof o.text === "string" ? o.text : "";
        if (!text) continue;
        try {
          const { isMetaWhatsAppConfigured } = await import("@/lib/whatsapp/meta");
          if (!isMetaWhatsAppConfigured()) {
            await logWhatsAppOutbound({
              to_phone: toPhoneRaw,
              channel_event: "bot_reply_text",
              conversation_id: convId,
              status: "error",
              error: "Meta not configured",
              payload: { preview: text.slice(0, 400) },
            });
            continue;
          }
          const result = await sendMetaWhatsAppText(toPhoneRaw, text);
          await logWhatsAppOutbound({
            to_phone: toPhoneRaw,
            channel_event: "bot_reply_text",
            conversation_id: convId,
            status: result.ok ? "sent" : "error",
            error: result.ok ? null : result.error,
            provider_message_id: result.ok ? result.idMessage : null,
            payload: { preview: text.slice(0, 400) },
          });
        } catch (e) {
          console.error("whatsapp webhook: send text failed", e);
          await logWhatsAppOutbound({
            to_phone: toPhoneRaw,
            channel_event: "bot_reply_text",
            conversation_id: convId,
            status: "error",
            error: e instanceof Error ? e.message : "send_failed",
            payload: {},
          });
        }
      } else if (o.kind === "buttons") {
        const bodyText = typeof o.bodyText === "string" ? o.bodyText : "";
        const buttons = Array.isArray(o.buttons)
          ? o.buttons.filter((b) => b && typeof (b as any).id === "string" && typeof (b as any).title === "string")
          : [];
        if (buttons.length === 0) continue;
        try {
          const { isMetaWhatsAppConfigured } = await import("@/lib/whatsapp/meta");
          if (!isMetaWhatsAppConfigured()) {
            await logWhatsAppOutbound({
              to_phone: toPhoneRaw,
              channel_event: "bot_reply_buttons",
              conversation_id: convId,
              status: "error",
              error: "Meta not configured",
              payload: { bodyPreview: bodyText.slice(0, 200) },
            });
            continue;
          }
          const result = await sendMetaWhatsAppButtons(toPhoneRaw, bodyText || "בחירה", buttons.map((b) => ({ id: (b as any).id, title: (b as any).title })));
          await logWhatsAppOutbound({
            to_phone: toPhoneRaw,
            channel_event: "bot_reply_buttons",
            conversation_id: convId,
            status: result.ok ? "sent" : "error",
            error: result.ok ? null : result.error,
            provider_message_id: result.ok ? result.idMessage : null,
            payload: { bodyPreview: bodyText.slice(0, 200), buttonIds: buttons.map((b: any) => b.id) },
          });
        } catch (e) {
          console.error("whatsapp webhook: send buttons failed", e);
          await logWhatsAppOutbound({
            to_phone: toPhoneRaw,
            channel_event: "bot_reply_buttons",
            conversation_id: convId,
            status: "error",
            error: e instanceof Error ? e.message : "send_failed",
            payload: {},
          });
        }
      } else if (o.kind === "list") {
        const bodyText = typeof o.bodyText === "string" ? o.bodyText : "";
        const buttonText = typeof o.buttonText === "string" ? o.buttonText : "בחר/י";
        const sectionTitle = typeof o.sectionTitle === "string" ? o.sectionTitle : "אפשרויות";
        const rows = Array.isArray(o.rows)
          ? o.rows.filter((r) => r && typeof (r as any).id === "string" && typeof (r as any).title === "string")
          : [];
        if (rows.length === 0) continue;
        try {
          const { isMetaWhatsAppConfigured } = await import("@/lib/whatsapp/meta");
          if (!isMetaWhatsAppConfigured()) {
            await logWhatsAppOutbound({
              to_phone: toPhoneRaw,
              channel_event: "bot_reply_list",
              conversation_id: convId,
              status: "error",
              error: "Meta not configured",
              payload: { bodyPreview: bodyText.slice(0, 200) },
            });
            continue;
          }
          const result = await sendMetaWhatsAppList({
            toPhoneRaw,
            bodyText: bodyText || "בחירה",
            buttonText,
            sectionTitle,
            rows: rows.map((r) => ({
              id: (r as any).id,
              title: (r as any).title,
              description: typeof (r as any).description === "string" ? (r as any).description : undefined,
            })),
          });
          await logWhatsAppOutbound({
            to_phone: toPhoneRaw,
            channel_event: "bot_reply_list",
            conversation_id: convId,
            status: result.ok ? "sent" : "error",
            error: result.ok ? null : result.error,
            provider_message_id: result.ok ? result.idMessage : null,
            payload: { bodyPreview: bodyText.slice(0, 200), rowIds: rows.map((r: any) => r.id) },
          });
        } catch (e) {
          console.error("whatsapp webhook: send list failed", e);
          await logWhatsAppOutbound({
            to_phone: toPhoneRaw,
            channel_event: "bot_reply_list",
            conversation_id: convId,
            status: "error",
            error: e instanceof Error ? e.message : "send_failed",
            payload: {},
          });
        }
      }
    }
  }

  // Always 200 quickly (Meta expects fast ack). We still persist logs synchronously here (small volume).
  for (const msg of messages) {
    // Find or create conversation by phone
    const { data: conv, error: convErr } = await supabase
      .from("whatsapp_conversations")
      .select("id, unread_count, mode, state, context, inbox_kind")
      .eq("phone", msg.from_phone)
      .maybeSingle();
    if (convErr) {
      console.error("whatsapp webhook: conversation fetch error", convErr);
      continue;
    }

    const isTeam = teamPhoneSet.has(normalizedPhoneKey(msg.from_phone));
    const modeBefore = ((conv as any)?.mode ?? "bot") as "bot" | "human";
    const { mode: conversationMode, inboxKind } = classifyConversationKind({
      isTeam,
      existingMode: modeBefore,
    });

    let conversationId = conv?.id as string | undefined;
    if (!conversationId) {
      const { data: created, error: createErr } = await supabase
        .from("whatsapp_conversations")
        .insert({
          phone: msg.from_phone,
          mode: conversationMode,
          inbox_kind: inboxKind,
          state: "start",
          context: {},
          last_inbound_at: nowIso,
          unread_count: 1,
        })
        .select("id")
        .single();
      if (createErr) {
        console.error("whatsapp webhook: conversation create error", createErr);
        continue;
      }
      conversationId = created.id as string;
    } else {
      // Unread is one "needs attention" unit per conversation (not per inbound message).
      await supabase
        .from("whatsapp_conversations")
        .update({
          mode: conversationMode,
          inbox_kind: inboxKind,
          last_inbound_at: nowIso,
          unread_count: 1,
          updated_at: nowIso,
        })
        .eq("id", conversationId);
    }

    // Insert inbound message (idempotent via unique index)
    const { error: inboundErr } = await supabase.from("whatsapp_inbound_messages").insert({
      provider: "meta",
      provider_message_id: msg.provider_message_id,
      conversation_id: conversationId,
      from_phone: msg.from_phone,
      message_type: msg.message_type,
      text_body: msg.text_body,
      // payload includes all interactive details; used later for bot FSM / admin UI
      payload: msg.payload ?? {},
      status: "received",
      received_at: nowIso,
    });
    if (inboundErr) {
      // Duplicate (already processed) is expected sometimes; keep quiet unless it's not unique violation.
      const message = inboundErr.message ?? "";
      if (!message.toLowerCase().includes("duplicate")) {
        console.error("whatsapp webhook: inbound insert error", inboundErr);
      }
      continue;
    }

    const preview =
      (msg.text_body && msg.text_body.trim().slice(0, 120)) ||
      (msg.message_type === "button" ? "לחיצה על כפתור" : "הודעה חדשה");
    const inboxKindLabel =
      inboxKind === "team" ? "צוות" : inboxKind === "anonymous" ? "אנונימי" : "בוט";
    void import("@/lib/push/send-admin-inbox-push")
      .then(({ sendAdminInboxPush }) =>
        sendAdminInboxPush({
          title: "דואר נכנס WhatsApp",
          body: `סוג: ${inboxKindLabel}\n${preview}`,
          url: "/admin/whatsapp-inbox",
        })
      )
      .catch((e) => console.error("whatsapp webhook: push notify failed", e));

    // Bot handling: only for conversation.mode=bot
    if (conversationMode !== "bot") continue;

    const currentState = ((conv as any)?.state ?? "start") as BotConversationState;
    const currentContext = ((conv as any)?.context ?? {}) as BotContext;

    const fsmResult = await runBotFsm({
      toPhoneRaw: msg.from_phone,
      currentState,
      currentContext,
      inbound: {
        text: msg.text_body,
        buttonId: msg.buttonId,
        listReplyId: msg.listReplyId,
      },
      createDraftFn: async (draft) => {
        try {
          const { data, error } = await supabase.from("question_intake_drafts").insert({
            phone: draft.phone,
            status: "waiting_admin_approval",
            asker_gender: draft.asker_gender,
            asker_age: draft.asker_age,
            title: draft.title,
            content: draft.content,
            response_type: draft.response_type,
            publication_consent: draft.publication_consent,
            delivery_preference: draft.delivery_preference,
            asker_email: draft.asker_email ?? null,
            terms_accepted: draft.terms_accepted,
          }).select("id").single();
          if (error || !data?.id) return { ok: false as const, error: error?.message ?? "insert_failed" };
          return { ok: true as const, draftId: data.id };
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : "insert_failed";
          return { ok: false as const, error: errMsg };
        }
      },
    });

    if (!fsmResult.ok) {
      console.error("WhatsApp bot FSM error:", fsmResult.error);
      continue;
    }

    // Update conversation state/context
    await supabase
      .from("whatsapp_conversations")
      .update({
        state: fsmResult.nextState,
        context: fsmResult.nextContext ?? {},
        updated_at: nowIso,
      })
      .eq("id", conversationId);

    // Send outbound responses via Meta
    await sendOutbound(msg.from_phone, conversationId, fsmResult.outbound as any);
  }

  return NextResponse.json({ ok: true });
}

