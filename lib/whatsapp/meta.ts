const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION ?? "v20.0";

export type MetaSendResult = { ok: true; idMessage?: string } | { ok: false; error: string };
export type MetaMediaKind = "image" | "audio" | "document" | "video";

/** True when outbound WhatsApp via Meta Cloud API can be attempted (env present). */
export function isMetaWhatsAppConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_PHONE_NUMBER_ID);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/**
 * Meta expects E.164 like +9725XXXXXXX
 * Webhook `from` may arrive without leading '+'. We'll normalize digits.
 */
export function normalizeMetaPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // If it's already Israel without +, assume it's 972...
  if (digits.startsWith("972") && digits.length >= 10) return `+${digits}`;
  // If it's local starting with 0 (e.g. 05X...), convert to 972...
  if (digits.startsWith("0") && digits.length >= 9) return `+972${digits.slice(1)}`;
  // Fallback: add '+'
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

function extractSentMessageId(data: {
  messages?: Array<{ id?: string }>;
  idMessage?: string;
}): string | undefined {
  return data.messages?.[0]?.id ?? data.idMessage;
}

async function postJson(path: string, body: unknown): Promise<MetaSendResult> {
  try {
    const accessToken = requireEnv("META_ACCESS_TOKEN");
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}${path}?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      idMessage?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, error: data.error?.message ?? res.statusText };
    }
    return { ok: true, idMessage: extractSentMessageId(data) };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: errMsg };
  }
}

export async function fetchMetaMediaMetadata(mediaId: string): Promise<
  | { ok: true; url: string; mime_type?: string | null; file_size?: number | null; sha256?: string | null }
  | { ok: false; error: string }
> {
  try {
    const accessToken = requireEnv("META_ACCESS_TOKEN");
    const phoneNumberId = requireEnv("META_PHONE_NUMBER_ID");
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(mediaId)}?phone_number_id=${encodeURIComponent(
      phoneNumberId
    )}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json().catch(() => ({}))) as {
      url?: string;
      mime_type?: string;
      file_size?: number;
      sha256?: string;
      error?: { message?: string };
    };
    if (!res.ok || !data.url) {
      return { ok: false, error: data.error?.message ?? res.statusText ?? "media_metadata_failed" };
    }
    return {
      ok: true,
      url: data.url,
      mime_type: data.mime_type ?? null,
      file_size: typeof data.file_size === "number" ? data.file_size : null,
      sha256: data.sha256 ?? null,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "media_metadata_failed" };
  }
}

export async function downloadMetaMedia(url: string): Promise<
  | { ok: true; bytes: Buffer; mimeType: string | null; sizeBytes: number | null }
  | { ok: false; error: string }
> {
  try {
    const accessToken = requireEnv("META_ACCESS_TOKEN");
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: text || res.statusText || "media_download_failed" };
    }
    const arr = await res.arrayBuffer();
    const bytes = Buffer.from(arr);
    const mimeType = res.headers.get("content-type");
    const len = res.headers.get("content-length");
    const sizeBytes = len ? Number(len) || bytes.length : bytes.length;
    return { ok: true, bytes, mimeType, sizeBytes };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "media_download_failed" };
  }
}

export type MetaButton = { id: string; title: string };

export type MetaListRow = { id: string; title: string; description?: string };

/** Meta Graph API: reply button `title` must be at most 20 characters. */
const MAX_REPLY_BUTTON_TITLE_LENGTH = 20;
const MAX_LIST_ROW_TITLE_LENGTH = 24;
const MAX_LIST_ROW_DESC_LENGTH = 72;
const MAX_LIST_SECTION_TITLE_LENGTH = 24;
const MAX_LIST_BUTTON_TEXT_LENGTH = 20;
const MAX_LIST_BODY_TEXT_LENGTH = 1024;

function clipReplyButtonTitle(title: string): string {
  const chars = [...title];
  if (chars.length <= MAX_REPLY_BUTTON_TITLE_LENGTH) return title;
  const clipped = chars.slice(0, MAX_REPLY_BUTTON_TITLE_LENGTH).join("");
  console.warn(
    `[WhatsApp] Button title too long (${chars.length} > ${MAX_REPLY_BUTTON_TITLE_LENGTH}), clipped:`,
    title,
    "→",
    clipped
  );
  return clipped;
}

function clipListText(text: string, maxChars: number): string {
  const chars = [...text];
  if (chars.length <= maxChars) return text;
  const clipped = chars.slice(0, maxChars).join("");
  console.warn(`[WhatsApp] List text too long (${chars.length} > ${maxChars}), clipped:`, text, "→", clipped);
  return clipped;
}

/**
 * Send a text message (free-form, within 24h session window).
 */
export async function sendMetaWhatsAppText(toPhoneRaw: string, text: string): Promise<MetaSendResult> {
  const to = normalizeMetaPhone(toPhoneRaw);
  if (!to) return { ok: false, error: "Invalid phone number" };

  const phoneNumberId = requireEnv("META_PHONE_NUMBER_ID");
  return postJson(`/${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

/**
 * Send an approved template message (business-initiated / outside 24h session).
 * `bodyParameters` map to {{1}}, {{2}}, … in the template body (same order).
 */
export async function sendMetaWhatsAppTemplate(
  toPhoneRaw: string,
  templateName: string,
  languageCode: string,
  bodyParameters: string[],
  buttonDynamicParam?: string
): Promise<MetaSendResult> {
  const to = normalizeMetaPhone(toPhoneRaw);
  if (!to) return { ok: false, error: "Invalid phone number" };

  const phoneNumberId = requireEnv("META_PHONE_NUMBER_ID");
  const components: Array<Record<string, unknown>> = [
    {
      type: "body",
      parameters: bodyParameters.map((text) => ({
        type: "text",
        text,
      })),
    },
  ];

  if (buttonDynamicParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        {
          type: "text",
          text: buttonDynamicParam,
        },
      ],
    });
  }

  return postJson(`/${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  });
}

/**
 * Send interactive "quick reply buttons" (type=button).
 * Works best for inline button taps.
 */
export async function sendMetaWhatsAppButtons(
  toPhoneRaw: string,
  bodyText: string,
  buttons: MetaButton[]
): Promise<MetaSendResult> {
  const to = normalizeMetaPhone(toPhoneRaw);
  if (!to) return { ok: false, error: "Invalid phone number" };

  const phoneNumberId = requireEnv("META_PHONE_NUMBER_ID");

  // WhatsApp interactive button limit: typically up to 3 quick replies
  const safeButtons = buttons.slice(0, 3);
  return postJson(`/${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: clipListText(bodyText, MAX_LIST_BODY_TEXT_LENGTH) },
      action: {
        buttons: safeButtons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: clipReplyButtonTitle(b.title) },
        })),
      },
    },
  });
}

/**
 * Send interactive list message (type=list).
 * Useful for more than 3 discrete choices (WhatsApp quick-reply buttons max ~3).
 */
export async function sendMetaWhatsAppList(params: {
  toPhoneRaw: string;
  bodyText: string;
  buttonText: string;
  sectionTitle: string;
  rows: MetaListRow[];
}): Promise<MetaSendResult> {
  const to = normalizeMetaPhone(params.toPhoneRaw);
  if (!to) return { ok: false, error: "Invalid phone number" };

  const phoneNumberId = requireEnv("META_PHONE_NUMBER_ID");

  const safeRows = params.rows.slice(0, 10).map((r) => ({
    id: r.id,
    title: clipListText(r.title, MAX_LIST_ROW_TITLE_LENGTH),
    ...(r.description ? { description: clipListText(r.description, MAX_LIST_ROW_DESC_LENGTH) } : {}),
  }));

  return postJson(`/${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: clipListText(params.bodyText, MAX_LIST_BODY_TEXT_LENGTH) },
      action: {
        button: clipListText(params.buttonText, MAX_LIST_BUTTON_TEXT_LENGTH),
        sections: [
          {
            title: clipListText(params.sectionTitle, MAX_LIST_SECTION_TITLE_LENGTH),
            rows: safeRows,
          },
        ],
      },
    },
  });
}

export async function sendMetaWhatsAppMediaByLink(params: {
  toPhoneRaw: string;
  kind: MetaMediaKind;
  link: string;
  caption?: string;
  filename?: string;
}): Promise<MetaSendResult> {
  const to = normalizeMetaPhone(params.toPhoneRaw);
  if (!to) return { ok: false, error: "Invalid phone number" };
  const phoneNumberId = requireEnv("META_PHONE_NUMBER_ID");

  if (params.kind === "image") {
    return postJson(`/${phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: {
        link: params.link,
        ...(params.caption?.trim() ? { caption: params.caption.trim() } : {}),
      },
    });
  }
  if (params.kind === "audio") {
    return postJson(`/${phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "audio",
      audio: { link: params.link },
    });
  }
  if (params.kind === "video") {
    return postJson(`/${phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "video",
      video: {
        link: params.link,
        ...(params.caption?.trim() ? { caption: params.caption.trim() } : {}),
      },
    });
  }
  return postJson(`/${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "document",
    document: {
      link: params.link,
      ...(params.filename?.trim() ? { filename: params.filename.trim() } : {}),
      ...(params.caption?.trim() ? { caption: params.caption.trim() } : {}),
    },
  });
}

