"use client";

import { AdminNav } from "@/components/admin/admin-nav";
import { InactivityLogout } from "@/components/inactivity-logout";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
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
    getDelayedQuestions().then(setDelayedQuestions);
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
    <div className="flex min-h-screen bg-background" dir="rtl">
      <InactivityLogout />
      {hasSidebar && (
        <>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className={cn(
              "fixed start-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition-opacity hover:bg-slate-50 md:hidden",
              sidebarOpen && "pointer-events-none opacity-0"
            )}
            aria-label="פתח תפריט"
          >
            <HamburgerIcon />
          </button>
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
              "fixed start-0 top-0 z-[25] flex h-full w-64 flex-col border-e border-slate-700/80 bg-slate-800 shadow-xl transition-transform duration-200 ease-out md:translate-x-0 md:transition-none",
              sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
            )}
          >
            <div className="flex items-center justify-between border-b border-slate-600/60 p-4 text-start md:block md:p-5">
              <div>
                <h2 className="text-lg font-bold text-white">אסק מי פלוס</h2>
                <p className="mt-0.5 text-xs text-slate-400">ממשק מנהל</p>
              </div>
              <button
                type="button"
                onClick={closeSidebar}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white md:hidden"
                aria-label="סגור תפריט"
              >
                <CloseIcon />
              </button>
            </div>
            <AdminNav delayedQuestions={delayedQuestions} onNavigate={closeSidebar} />
          </aside>
        </>
      )}
      <main
        className={cn(
          "font-sans min-h-screen flex-1 min-w-0 pb-8 pe-4 ps-4 md:pe-8",
          hasSidebar ? "pt-14 md:pt-6 md:ps-[17rem]" : "pt-4 md:pt-6"
        )}
      >
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
