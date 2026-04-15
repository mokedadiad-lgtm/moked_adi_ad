import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { MetaSendResult } from "./meta";
import {
  isMetaWhatsAppConfigured,
  sendMetaWhatsAppMediaByLink,
  sendMetaWhatsAppTemplate,
  sendMetaWhatsAppText,
  type MetaMediaKind,
} from "./meta";
import type { WhatsAppInitiatedTemplateKey } from "./templateConfig";
import { getWhatsAppTemplateLanguageCode, getWhatsAppTemplateName } from "./templateConfig";

/**
 * Audit log for WhatsApp sends. The table supports a future retry worker; today we use direct Graph API calls + logging.
 */
export async function logWhatsAppOutbound(params: {
  to_phone: string;
  channel_event: string;
  conversation_id?: string | null;
  idempotency_key?: string | null;
  payload?: Record<string, unknown>;
  provider_message_id?: string | null;
  status: "sent" | "error";
  error?: string | null;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("whatsapp_outbound_messages").insert({
      provider: "meta",
      to_phone: params.to_phone,
      channel_event: params.channel_event,
      conversation_id: params.conversation_id ?? null,
      idempotency_key: params.idempotency_key ?? null,
      payload: (params.payload ?? {}) as object,
      provider_message_id: params.provider_message_id ?? null,
      status: params.status,
      error: params.error ?? null,
      retry_count: 0,
      last_attempt_at: new Date().toISOString(),
    });
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (!msg.includes("duplicate") && !msg.includes("unique")) {
        console.error("logWhatsAppOutbound insert:", error);
      }
    }
  } catch (e) {
    console.error("logWhatsAppOutbound:", e);
  }
}

/**
 * Send a text message via Meta and persist a row in `whatsapp_outbound_messages` (sent/error).
 */
export async function sendMetaWhatsAppTextWithLog(
  toPhoneRaw: string,
  text: string,
  opts: {
    channel_event: string;
    conversation_id?: string | null;
    idempotency_key?: string | null;
  }
): Promise<MetaSendResult> {
  if (!isMetaWhatsAppConfigured()) {
    await logWhatsAppOutbound({
      to_phone: toPhoneRaw,
      channel_event: opts.channel_event,
      conversation_id: opts.conversation_id,
      idempotency_key: opts.idempotency_key,
      payload: { kind: "text", preview: text.slice(0, 400) },
      status: "error",
      error: "Meta WhatsApp not configured (META_ACCESS_TOKEN / META_PHONE_NUMBER_ID)",
    });
    return { ok: false, error: "Meta WhatsApp not configured" };
  }

  const result = await sendMetaWhatsAppText(toPhoneRaw, text);
  await logWhatsAppOutbound({
    to_phone: toPhoneRaw,
    channel_event: opts.channel_event,
    conversation_id: opts.conversation_id,
    idempotency_key: opts.idempotency_key,
    payload: { kind: "text", preview: text.slice(0, 400) },
    provider_message_id: result.ok ? result.idMessage : null,
    status: result.ok ? "sent" : "error",
    error: result.ok ? null : result.error,
  });
  return result;
}

/**
 * Send a template message via Meta and persist a row in `whatsapp_outbound_messages`.
 */
export async function sendMetaWhatsAppTemplateWithLog(
  toPhoneRaw: string,
  opts: {
    channel_event: string;
    conversation_id?: string | null;
    idempotency_key?: string | null;
    templateName: string;
    languageCode: string;
    bodyParameters: string[];
    buttonDynamicParam?: string;
    /** Shown in admin inbox / logs — approximates what the user sees (body vars or fallback copy). */
    displayPreview?: string;
  }
): Promise<MetaSendResult> {
  const paramLines = opts.bodyParameters.map((p) => p.trim()).filter(Boolean);
  const previewForLog =
    opts.displayPreview?.trim() ||
    (paramLines.length > 0 ? paramLines.join("\n") : undefined);

  const templatePayload = {
    kind: "template" as const,
    templateName: opts.templateName,
    ...(previewForLog ? { preview: previewForLog.slice(0, 2000) } : {}),
    bodyParamsPreview: opts.bodyParameters.map((p) => p.slice(0, 120)),
    buttonDynamicParamPreview: opts.buttonDynamicParam?.slice(0, 200) ?? null,
  };

  if (!isMetaWhatsAppConfigured()) {
    await logWhatsAppOutbound({
      to_phone: toPhoneRaw,
      channel_event: opts.channel_event,
      conversation_id: opts.conversation_id,
      idempotency_key: opts.idempotency_key,
      payload: templatePayload,
      status: "error",
      error: "Meta WhatsApp not configured (META_ACCESS_TOKEN / META_PHONE_NUMBER_ID)",
    });
    return { ok: false, error: "Meta WhatsApp not configured" };
  }

  const result = await sendMetaWhatsAppTemplate(
    toPhoneRaw,
    opts.templateName,
    opts.languageCode,
    opts.bodyParameters,
    opts.buttonDynamicParam
  );
  await logWhatsAppOutbound({
    to_phone: toPhoneRaw,
    channel_event: opts.channel_event,
    conversation_id: opts.conversation_id,
    idempotency_key: opts.idempotency_key,
    payload: templatePayload,
    provider_message_id: result.ok ? result.idMessage : null,
    status: result.ok ? "sent" : "error",
    error: result.ok ? null : result.error,
  });
  return result;
}

export async function sendMetaWhatsAppMediaWithLog(
  toPhoneRaw: string,
  opts: {
    channel_event: string;
    conversation_id?: string | null;
    idempotency_key?: string | null;
    kind: MetaMediaKind;
    link: string;
    caption?: string;
    filename?: string;
    storagePath?: string | null;
    mimeType?: string | null;
  }
): Promise<MetaSendResult> {
  const payloadForLog = {
    kind: "media",
    media_kind: opts.kind,
    link_preview: opts.link.slice(0, 300),
    caption: opts.caption?.slice(0, 300) ?? null,
    filename: opts.filename?.slice(0, 200) ?? null,
    storage_path: opts.storagePath ?? null,
    mime_type: opts.mimeType ?? null,
  };

  if (!isMetaWhatsAppConfigured()) {
    await logWhatsAppOutbound({
      to_phone: toPhoneRaw,
      channel_event: opts.channel_event,
      conversation_id: opts.conversation_id,
      idempotency_key: opts.idempotency_key,
      payload: payloadForLog,
      status: "error",
      error: "Meta WhatsApp not configured (META_ACCESS_TOKEN / META_PHONE_NUMBER_ID)",
    });
    return { ok: false, error: "Meta WhatsApp not configured" };
  }

  const result = await sendMetaWhatsAppMediaByLink({
    toPhoneRaw,
    kind: opts.kind,
    link: opts.link,
    caption: opts.caption,
    filename: opts.filename,
  });

  await logWhatsAppOutbound({
    to_phone: toPhoneRaw,
    channel_event: opts.channel_event,
    conversation_id: opts.conversation_id,
    idempotency_key: opts.idempotency_key,
    payload: payloadForLog,
    provider_message_id: result.ok ? result.idMessage : null,
    status: result.ok ? "sent" : "error",
    error: result.ok ? null : result.error,
  });

  return result;
}

/**
 * If `WHATSAPP_TEMPLATE_*` is set for this channel, sends an approved template; otherwise free-form text.
 */
export async function sendMetaWhatsAppInitiatedWithLog(
  toPhoneRaw: string,
  opts: {
    templateKey: WhatsAppInitiatedTemplateKey;
    channel_event: string;
    conversation_id?: string | null;
    idempotency_key?: string | null;
    bodyParameters: string[];
    buttonDynamicParam?: string;
    legacyText: string;
  }
): Promise<MetaSendResult> {
  const templateName = getWhatsAppTemplateName(opts.templateKey);
  if (templateName) {
    const paramLines = opts.bodyParameters.map((p) => p.trim()).filter(Boolean);
    const displayPreview = paramLines.length > 0 ? paramLines.join("\n") : opts.legacyText;
    return sendMetaWhatsAppTemplateWithLog(toPhoneRaw, {
      channel_event: opts.channel_event,
      conversation_id: opts.conversation_id,
      idempotency_key: opts.idempotency_key,
      templateName,
      languageCode: getWhatsAppTemplateLanguageCode(),
      bodyParameters: opts.bodyParameters,
      buttonDynamicParam: opts.buttonDynamicParam,
      displayPreview,
    });
  }
  return sendMetaWhatsAppTextWithLog(toPhoneRaw, opts.legacyText, {
    channel_event: opts.channel_event,
    conversation_id: opts.conversation_id,
    idempotency_key: opts.idempotency_key,
  });
}
