"use client";

import { AdminPushSetup } from "@/components/admin/admin-push-setup";
import { AdminNav } from "@/components/admin/admin-nav";
import { InactivityLogout } from "@/components/inactivity-logout";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

import { getDelayedQuestions, type DelayedQuestionItem } from "@/app/admin/actions";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState<boolean | null>(null);
  const [delayedQuestions, setDelayedQuestions] = useState<DelayedQuestionItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) setShowSidebar(false);
        return;
      }
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_admin, is_technical_lead")
        .eq("id", user.id)
        .single();
      if (error && !cancelled) {
        console.warn("[AdminShell] Failed to load profile for sidebar:", error.message);
      }
      if (!cancelled) {
        setShowSidebar(profile?.is_admin === true || profile?.is_technical_lead === true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const items = await getDelayedQuestions();
        if (!cancelled) setDelayedQuestions(items);
      } catch {
        // We keep previous value on error to avoid flicker.
      }
    };

    load();

    // The admin dashboard refreshes its table via `router.refresh()` (and HMR),
    // but `delayedQuestions` lives in this component and was loaded only once.
    // Polling keeps the sidebar status in sync with the table.
    const intervalId = window.setInterval(load, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const closeSidebar = () => setSidebarOpen(false);
  // הצגת הסרגל גם בזמן טעינה (null) — כך שבמעבר בין דפים הסרגל לא נעלם עד שהפרופיל נטען
  const hasSidebar = showSidebar !== false;

  return (
    <div className="flex min-h-screen flex-col bg-background" dir="rtl">
      <InactivityLogout />
      {/* לוגו עגול: רק בדסקטופ — במובייל הלוגו מופיע בתוך הסרגל כשהוא פתוח */}
      <div className="fixed right-0 top-4 z-[35] hidden w-64 justify-center md:flex">
        <Link
          href="/"
          className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-card shadow-md ring-1 ring-border/50 md:h-[4.75rem] md:w-[4.75rem]"
          aria-label="אסק מי פלוס"
        >
          <Image
            src="/brand/logo-full.png"
            alt=""
            width={80}
            height={80}
            className="h-full w-full object-contain p-1.5"
            priority
          />
        </Link>
      </div>
      {hasSidebar && (
        <>
          {/* שורת כותרת במובייל ברוחב המלא — התוכן מתחיל מתחתיה, בלי לצמצם את רוחב כל העמוד */}
          <div
            className={cn(
              "fixed inset-x-0 top-0 z-40 h-14 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden",
              sidebarOpen && "hidden"
            )}
          >
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="absolute start-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted"
              aria-label="פתח תפריט"
            >
              <HamburgerIcon />
            </button>
            <Link
              href="/"
              className="absolute end-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm"
              aria-label="אסק מי פלוס"
            >
              <Image
                src="/brand/logo-full.png"
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-contain object-center p-1"
              />
            </Link>
          </div>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={closeSidebar}
            className={cn(
              "fixed inset-0 z-20 bg-black/50 transition-opacity md:hidden",
              sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          />
          <aside
            className={cn(
              "fixed right-0 top-0 z-[25] flex h-full min-h-dvh w-64 flex-col border-l border-primary/15 bg-[#1a1a35] pt-0 shadow-xl transition-transform duration-200 ease-out md:pt-[5.5rem] md:translate-x-0 md:transition-none",
              sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
            )}
          >
            <div className="relative flex flex-col items-center border-b border-white/10 px-4 pb-4 pt-12 text-center md:px-5 md:pt-2">
              <button
                type="button"
                onClick={closeSidebar}
                className="absolute start-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-[#a8a8c4] hover:bg-white/10 hover:text-white md:hidden"
                aria-label="סגור תפריט"
              >
                <CloseIcon />
              </button>
              <Link
                href="/"
                className="mb-2 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white shadow-md md:hidden"
                aria-label="אסק מי פלוס"
                onClick={closeSidebar}
              >
                <Image
                  src="/brand/logo-full.png"
                  alt=""
                  width={80}
                  height={80}
                  className="h-full w-full object-contain p-1.5"
                />
              </Link>
              <h2 className="text-lg font-bold text-white">אסק מי פלוס</h2>
              <p className="mt-0.5 text-xs text-[#a8a8c4]">ממשק מנהל</p>
            </div>
            <AdminNav delayedQuestions={delayedQuestions} onNavigate={closeSidebar} />
          </aside>
        </>
      )}
      <main
        className={cn(
          "font-sans min-h-0 flex-1 min-w-0 pb-8",
          hasSidebar
            ? // במובייל: רק ריווח עליון לגובה שורת ההמבורגר — הרוחב המלא לתוכן (px-4) כמו קודם
              "px-4 pt-14 md:px-8 md:pt-6 md:pr-64"
            : "px-4 pt-4 md:px-8 md:pt-6"
        )}
      >
        {showSidebar === true && <AdminPushSetup />}
        {showSidebar === false && pathname?.startsWith("/admin") && (
          <div className="mx-auto max-w-6xl px-2 sm:px-4 md:px-6">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-right text-amber-900">
              <p className="font-medium">אין הרשאת מנהל לחשבון זה</p>
              <p className="mt-1 text-sm text-amber-800">
                הסרגל והתפריט של ממשק המנהל מוצגים רק כאשר לחשבון מוגדרות הרשאות מנהל או אחראי טכני בטבלת הפרופילים. אם אתה מנהל המערכת, עדכן את השדה <code className="rounded bg-amber-100 px-1">is_admin</code> ל־true בפרופיל שלך ב־Supabase.
              </p>
            </div>
          </div>
        )}
        <div className="mx-auto w-full max-w-6xl px-2 sm:px-4 md:px-6">{children}</div>
      </main>
    </div>
  );
}
