"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/** חודש ללא פעילות — מחושב כ־30 ימים */
const INACTIVITY_MS = 30 * 24 * 60 * 60 * 1000;
/** בדיקה תקופתית; מספיק לסף של חודש */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"] as const;

/**
 * מתנתק אוטומטית רק אחרי כ־חודש (30 ימים) ללא פעילות בממשק.
 * יש להציב במסכים שדורשים התחברות (לוח בקרה, משיב, מגיה וכו').
 */
export function InactivityLogout() {
  const router = useRouter();
  const lastActivity = useRef<number>(Date.now());

  const checkInactivity = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (Date.now() - lastActivity.current >= INACTIVITY_MS) {
      getSupabaseBrowser().auth.signOut().then(() => {
        fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
        router.replace("/login");
      });
    }
  }, [router]);

  useEffect(() => {
    const onActivity = () => {
      lastActivity.current = Date.now();
    };

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity));
    const intervalId = setInterval(checkInactivity, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
      clearInterval(intervalId);
    };
  }, [checkInactivity]);

  return null;
}
