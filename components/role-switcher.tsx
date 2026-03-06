"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ScreenId = "admin" | "respondent" | "proofreader" | "linguistic";

const SCREENS: { id: ScreenId; href: string; label: string }[] = [
  { id: "admin", href: "/admin", label: "לוח בקרה" },
  { id: "respondent", href: "/respondent", label: "אזור משיב/ה" },
  { id: "proofreader", href: "/proofreader", label: "לובי הגהה" },
  { id: "linguistic", href: "/admin/linguistic", label: "עריכה לשונית" },
];

function useAllowedScreens(): { allowed: ScreenId[] | null; hasSidebar: boolean } {
  const [state, setState] = useState<{ allowed: ScreenId[] | null; hasSidebar: boolean }>({
    allowed: null,
    hasSidebar: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) setState({ allowed: [], hasSidebar: false });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, is_technical_lead, is_respondent, is_proofreader, is_linguistic_editor, proofreader_type_id")
        .eq("id", user.id)
        .single();

      const isAdmin = profile?.is_admin === true || profile?.is_technical_lead === true;
      const isRespondent = profile?.is_respondent === true;
      const canProofread = isAdmin || (profile?.is_proofreader === true && profile?.proofreader_type_id);
      const canLinguistic = isAdmin || profile?.is_linguistic_editor === true;

      const ids: ScreenId[] = [];
      if (isAdmin) ids.push("admin");
      if (isRespondent || isAdmin) ids.push("respondent");
      if (canProofread) ids.push("proofreader");
      if (canLinguistic) ids.push("linguistic");
      if (!cancelled) setState({ allowed: ids, hasSidebar: isAdmin });
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}

/** מחזיר true אם למשתמש יש סרגל (מנהל/אחראי טכני). לשימוש בהסתרת כפתור התנתקות וכו'. */
export function useHasSidebar(): boolean {
  const { hasSidebar } = useAllowedScreens();
  return hasSidebar;
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** כפתור ניווט אחד — בלחיצה נפתחת רשימה לבחירת דף. במובייל: "ניווט באפליקציה", במסך גדול: "ניווט באתר". */
export function RoleSwitcher({ className }: { className?: string }) {
  const pathname = usePathname();
  const { allowed, hasSidebar } = useAllowedScreens();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  if (hasSidebar || allowed === null || allowed.length < 2) return null;

  const currentId: ScreenId | null =
    pathname === "/admin" || pathname?.startsWith("/admin/")
      ? pathname === "/admin/linguistic"
        ? "linguistic"
        : "admin"
      : pathname === "/respondent"
        ? "respondent"
        : pathname === "/proofreader"
          ? "proofreader"
          : null;

  const others = SCREENS.filter((s) => s.id !== currentId && allowed.includes(s.id));
  if (others.length === 0) return null;

  return (
    <div className={cn("relative", className)} dir="rtl" ref={containerRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        className="gap-1.5"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="md:hidden">ניווט באפליקציה</span>
        <span className="hidden md:inline">ניווט באתר</span>
        <ChevronDownIcon className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <div
          className="absolute end-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="menu"
        >
          {others.map((screen) => (
            <Link
              key={screen.id}
              href={screen.href}
              className="block px-4 py-2 text-right text-sm text-slate-800 hover:bg-slate-100"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              {screen.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
