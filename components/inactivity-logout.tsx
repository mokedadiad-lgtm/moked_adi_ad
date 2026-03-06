"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const INACTIVITY_MS = 60 * 60 * 1000; // שעה
const CHECK_INTERVAL_MS = 60 * 1000; // בדיקה כל דקה

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"] as const;

/**
 * מתנתק אוטומטית אחרי שעה של חוסר פעילות.
 * יש להציב במסכים שדורשים התחברות (לוח בקרה, משיב, הגהה).
 */
export function InactivityLogout() {
  const router = useRouter();
  const lastActivity = useRef<number>(Date.now());

  const checkInactivity = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (Date.now() - lastActivity.current >= INACTIVITY_MS) {
      getSupabaseBrowser().auth.signOut().then(() => {
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
