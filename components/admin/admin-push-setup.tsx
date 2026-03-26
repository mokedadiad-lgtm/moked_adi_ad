"use client";

import { Button } from "@/components/ui/button";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type UiState =
  | "loading"
  | "server_off"
  | "unsupported"
  | "denied"
  | "idle"
  | "subscribed"
  | "error";

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowser();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function AdminPushSetup() {
  const [ui, setUi] = useState<UiState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  /** ISO — עד מתי השתקה זמנית פעילה (רק כשיש מנוי) */
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const [mutedForever, setMutedForever] = useState(false);

  const loadMuteStatus = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setMutedUntil(null);
      setMutedForever(false);
      return;
    }
    const res = await fetch("/api/push/mute", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      setMutedUntil(null);
      setMutedForever(false);
      return;
    }
    const j = (await res.json()) as { mutedUntil?: string | null; mutedForever?: boolean };
    setMutedUntil(j.mutedUntil ?? null);
    setMutedForever(j.mutedForever === true);
  }, []);

  const refresh = useCallback(async () => {
    setErrorMsg(null);
    try {
      const res = await fetch("/api/push/vapid-key");
      const j = (await res.json()) as { configured?: boolean; publicKey?: string | null };
      if (!j.configured || !j.publicKey) {
        setUi("server_off");
        setMutedUntil(null);
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setUi("unsupported");
        setMutedUntil(null);
        return;
      }
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        setUi("denied");
        setMutedUntil(null);
        return;
      }
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setUi("subscribed");
        await loadMuteStatus();
      } else {
        setUi("idle");
        setMutedUntil(null);
        setMutedForever(false);
      }
    } catch {
      setUi("error");
      setErrorMsg("טעינת מצב התראות נכשלה");
    }
  }, [loadMuteStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const testNotification = async () => {
    setTestBusy(true);
    setTestMsg(null);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMsg("לא מחובר");
        return;
      }
      const res = await fetch("/api/push/test-inbox", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || j.ok !== true) {
        setErrorMsg(j.error ?? "טסט התראה נכשל");
        return;
      }
      setTestMsg("טסט נשלח (אם יש מנוי פעיל, אמורה להגיע הודעה למכשיר).");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "שגיאת טסט התראה");
    } finally {
      setTestBusy(false);
    }
  };

  const subscribe = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/push/vapid-key");
      const j = (await res.json()) as { configured?: boolean; publicKey?: string | null };
      if (!j.configured || !j.publicKey) {
        setUi("server_off");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setUi("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(j.publicKey) as BufferSource,
        }));

      const supabase = getSupabaseBrowser();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setErrorMsg("לא מחובר");
        setUi("error");
        return;
      }

      const save = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!save.ok) {
        const err = (await save.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(err.error ?? "שמירת המנוי נכשלה");
        setUi("error");
        return;
      }
      setUi("subscribed");
      await loadMuteStatus();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "שגיאה");
      setUi("error");
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const supabase = getSupabaseBrowser();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
        await sub.unsubscribe();
        const t2 = await getAccessToken();
        if (t2) {
          await fetch("/api/push/mute", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${t2}` },
            body: JSON.stringify({ clear: true }),
          });
        }
      }
      setMutedUntil(null);
      setMutedForever(false);
      setUi("idle");
    } catch {
      setErrorMsg("ביטול המנוי נכשל");
      setUi("error");
    } finally {
      setBusy(false);
    }
  };

  const setMuteHours = async (hours: 1 | 4 | 8 | 24) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMsg("לא מחובר");
        return;
      }
      const res = await fetch("/api/push/mute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ hours }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        mutedUntil?: string | null;
        mutedForever?: boolean;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setErrorMsg(j.error ?? "השתקה נכשלה");
        return;
      }
      setMutedUntil(j.mutedUntil ?? null);
      setMutedForever(j.mutedForever === true);
    } catch {
      setErrorMsg("השתקה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  const setMuteForever = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMsg("לא מחובר");
        return;
      }
      const res = await fetch("/api/push/mute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ forever: true }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        mutedForever?: boolean;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setErrorMsg(j.error ?? "השתקה נכשלה");
        return;
      }
      setMutedUntil(null);
      setMutedForever(true);
    } catch {
      setErrorMsg("השתקה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  const clearMute = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMsg("לא מחובר");
        return;
      }
      const res = await fetch("/api/push/mute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clear: true }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErrorMsg(j.error ?? "ביטול השתקה נכשל");
        return;
      }
      setMutedUntil(null);
    } catch {
      setErrorMsg("ביטול השתקה נכשל");
    } finally {
      setBusy(false);
    }
  };

  const timeMutedLabel =
    !mutedForever &&
    mutedUntil &&
    new Date(mutedUntil) > new Date() &&
    new Date(mutedUntil).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });

  const isPushMuted = mutedForever || Boolean(timeMutedLabel);

  if (ui === "loading") {
    return (
      <div className="mb-4 rounded-xl border border-border bg-card p-3 text-sm text-secondary" role="status">
        טוען הגדרות התראות…
      </div>
    );
  }

  if (ui === "server_off") {
    return (
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-right text-sm text-amber-950">
        <p className="font-medium">התראות דחיפה לא הוגדרו בשרת</p>
        <p className="mt-1 text-amber-900/90">
          צריך להגדיר מפתחות VAPID (ראה <code className="rounded bg-amber-100 px-1">.env.example</code> ו־DEPLOY).
        </p>
      </div>
    );
  }

  if (ui === "unsupported") {
    return (
      <div className="mb-4 rounded-xl border border-border bg-slate-50 p-4 text-right text-sm text-secondary">
        הדפדפן/המכשיר לא תומך בהתראות דחיפה (Web Push).
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mb-4 rounded-xl border p-4 text-right",
        ui === "denied" ? "border-amber-300 bg-amber-50/90" : "border-primary/20 bg-card"
      )}
    >
      <h3 className="text-base font-semibold text-foreground">התראות על דואר נכנס WhatsApp</h3>
      <p className="mt-1 text-sm text-secondary">
        קבלו התראה בטלפון כשמגיעה הודעה וואטסאפ למערכת. ההפעלה נעשית דרך הדפדפן (לא דורש אפליקציה נפרדת).
      </p>

      <details className="mt-3 rounded-lg border border-border bg-background/60 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-foreground">איך מפעילים התראות בטלפון?</summary>
        <ul className="mt-2 list-disc space-y-2 pr-5 text-secondary">
          <li>
            <strong className="text-foreground">אייפון (Safari):</strong> הוסיפו את האתר למסך הבית (שיתוף → הוסף למסך הבית).
            פתחו את האפליקציה מהאייקון. אם אין בקשה להתראות — לכו להגדרות → התראות → &quot;אסק מי פלוס&quot; ואפשרו.
          </li>
          <li>
            <strong className="text-foreground">אנדרואיד (Chrome):</strong> הוסיפו למסך הבית אם תרצו, ואז בהגדרות האתר או בהגדרות
            התראות של Chrome אפשרו התראות עבור האתר.
          </li>
          <li>התראות עובדות ב־HTTPS (כולל האתר בפרודקשן). בלוקל-הוסט אפשר לבדוק בכרום.</li>
        </ul>
      </details>

      {ui === "denied" && (
        <p className="mt-3 rounded-lg bg-amber-100/80 p-2 text-sm text-amber-950">
          ההתראות חסומות בדפדפן. פתחו את הגדרות האתר או את הגדרות התראות במכשיר והפעילו מחדש.
        </p>
      )}

      {errorMsg && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {errorMsg}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {ui === "subscribed" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {isPushMuted ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-950">
                  {mutedForever
                    ? "מושתק (תמיד — עד שתבטלו)"
                    : `מושתק זמנית עד ${timeMutedLabel}`}
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                  התראות פעילות
                </span>
              )}
              {isPushMuted ? (
                <Button type="button" variant="default" size="sm" onClick={() => void clearMute()} disabled={busy}>
                  {busy ? "מעדכן…" : "חזרה להתראות"}
                </Button>
              ) : (
                <>
                  <span className="text-xs text-secondary">השתקה זמנית:</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void setMuteHours(1)} disabled={busy}>
                    שעה
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void setMuteHours(4)} disabled={busy}>
                    4 שעות
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void setMuteHours(8)} disabled={busy}>
                    8 שעות
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void setMuteHours(24)} disabled={busy}>
                    24 שעות
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void setMuteForever()} disabled={busy}>
                    תמיד
                  </Button>
                </>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => void unsubscribe()} disabled={busy}>
                {busy ? "מבטל…" : "בטל התראות לגמרי"}
              </Button>
            </div>
            <p className="text-xs text-secondary">
              «תמיד» משתיק עד שתלחצו «חזרה להתראות». השתקה לפי שעות נגמרת אוטומטית. המנוי נשאר — אין צורך להפעיל מחדש.
            </p>
          </>
        ) : (
          <>
            <Button type="button" size="sm" onClick={() => void subscribe()} disabled={busy || ui === "denied"}>
              {busy ? "מפעיל…" : "הפעל התראות דחיפה"}
            </Button>
            {ui === "denied" && (
              <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
                בדוק שוב אחרי שינוי בהגדרות
              </Button>
            )}
          </>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void testNotification()}
          disabled={testBusy || ui !== "subscribed"}
        >
          {testBusy ? "שולח טסט…" : "טסט התראות"}
        </Button>
        {testMsg ? <p className="text-xs text-secondary">{testMsg}</p> : null}
      </div>
    </div>
  );
}
