/**
 * Green-API WhatsApp sending.
 * Env: GREEN_API_ID_INSTANCE, GREEN_API_TOKEN_INSTANCE
 * Docs: https://green-api.com/en/docs/api/sending/SendMessage/
 */

const BASE_URL = "https://api.green-api.com";

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.GREEN_API_ID_INSTANCE && process.env.GREEN_API_TOKEN_INSTANCE
  );
}

/**
 * Normalize phone for Green-API chatId: digits only, 05X -> 9725X, then append @c.us
 */
export function toWhatsAppChatId(phoneNumber: string): string | null {
  const digits = phoneNumber.replace(/\D/g, "");
  if (!digits.length) return null;
  let normalized = digits;
  if (normalized.startsWith("0") && normalized.length >= 9) {
    normalized = "972" + normalized.slice(1);
  } else if (!normalized.startsWith("972") && normalized.length >= 9) {
    normalized = "972" + normalized;
  }
  if (normalized.length < 10) return null;
  return `${normalized}@c.us`;
}

export type SendWhatsAppResult = { ok: true; idMessage?: string } | { ok: false; error: string };

/**
 * Send a text message via Green-API.
 * phoneNumber: Israeli format (05X-XXXXXXX) or international (972...); will be normalized.
 */
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<SendWhatsAppResult> {
  if (!isWhatsAppConfigured()) {
    return { ok: false, error: "GREEN_API_ID_INSTANCE או GREEN_API_TOKEN_INSTANCE חסרים" };
  }
  const chatId = toWhatsAppChatId(phoneNumber);
  if (!chatId) {
    return { ok: false, error: "מספר טלפון לא תקין" };
  }
  const id = process.env.GREEN_API_ID_INSTANCE!;
  const token = process.env.GREEN_API_TOKEN_INSTANCE!;
  const url = `${BASE_URL}/waInstance${id}/sendMessage/${token}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    });
    const data = (await res.json().catch(() => ({}))) as { idMessage?: string; message?: string };
    if (!res.ok) {
      const errMsg = data?.message ?? res.statusText ?? "שגיאה בשליחת הודעת וואטסאפ";
      console.error("Green-API sendMessage:", res.status, errMsg);
      return { ok: false, error: errMsg };
    }
    return { ok: true, idMessage: data.idMessage };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "שגיאת רשת";
    console.error("sendWhatsAppMessage:", e);
    return { ok: false, error: errMsg };
  }
}
