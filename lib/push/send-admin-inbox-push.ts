import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getVapidSubject, isPushConfigured } from "./config";

export type InboxPushPayload = {
  title?: string;
  body?: string;
  url?: string;
};

function configureWebPush(): boolean {
  if (!isPushConfigured()) return false;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY!.trim();
  webpush.setVapidDetails(getVapidSubject(), publicKey, privateKey);
  return true;
}

/**
 * שולח התראת דחיפה לכל המנויים של מנהלים/אחראי טכני — אחרי הודעת WhatsApp נכנסת.
 */
export async function sendAdminInboxPush(payload: InboxPushPayload = {}): Promise<void> {
  if (!configureWebPush()) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase.from("push_subscriptions").select(`
      id,
      endpoint,
      p256dh,
      auth,
      profiles ( is_admin, is_technical_lead, push_notifications_muted_until, push_notifications_muted_forever )
    `);

  if (error) {
    console.error("[sendAdminInboxPush] query failed", error);
    return;
  }

  type Row = {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    profiles: {
      is_admin?: boolean | null;
      is_technical_lead?: boolean | null;
      push_notifications_muted_until?: string | null;
      push_notifications_muted_forever?: boolean | null;
    } | null;
  };

  const now = Date.now();
  const list = ((rows ?? []) as Row[]).filter((r) => {
    const raw = r.profiles;
    const p = Array.isArray(raw) ? raw[0] : raw;
    if (!(p?.is_admin === true || p?.is_technical_lead === true)) return false;
    if (p.push_notifications_muted_forever === true) return false;
    const muted = p.push_notifications_muted_until;
    if (muted && new Date(muted).getTime() > now) return false;
    return true;
  });

  if (list.length === 0) return;

  const body = JSON.stringify({
    title: payload.title ?? "דואר נכנס WhatsApp",
    body: payload.body ?? "התקבלה הודעה חדשה",
    url: payload.url ?? "/admin/whatsapp-inbox",
  });

  const subscription = (row: (typeof list)[0]) =>
    ({
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    }) as webpush.PushSubscription;

  await Promise.allSettled(
    list.map(async (row) => {
      try {
        await webpush.sendNotification(subscription(row), body, {
          TTL: 120,
          urgency: "high",
        });
      } catch (e: unknown) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", row.id);
        } else {
          console.error("[sendAdminInboxPush] send failed", row.id, e);
        }
      }
    })
  );
}
