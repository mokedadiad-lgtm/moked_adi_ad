const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION ?? "v20.0";

type MetaSendResult = { ok: true; idMessage?: string } | { ok: false; error: string };

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

async function postJson(path: string, body: unknown): Promise<MetaSendResult> {
  try {
    const accessToken = requireEnv("META_ACCESS_TOKEN");
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}${path}?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { idMessage?: string; error?: { message?: string } };
    if (!res.ok) {
      return { ok: false, error: data.error?.message ?? res.statusText };
    }
    // Meta usually returns `messages` response with an id.
    return { ok: true, idMessage: data.idMessage };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: errMsg };
  }
}

export type MetaButton = { id: string; title: string };

/** Meta Graph API: reply button `title` must be at most 20 characters. */
const MAX_REPLY_BUTTON_TITLE_LENGTH = 20;

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
      body: { text: bodyText },
      action: {
        buttons: safeButtons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: clipReplyButtonTitle(b.title) },
        })),
      },
    },
  });
}

