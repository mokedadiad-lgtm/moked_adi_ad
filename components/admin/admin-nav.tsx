"use client";

import type { DelayedQuestionItem } from "@/app/admin/actions";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { STAGE_LABELS } from "@/lib/types";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  needRespondent?: boolean;
  needProofreader?: boolean;
  needLinguistic?: boolean;
};

const navItems: NavItem[] = [
  { href: "/admin", label: "לוח בקרה", icon: HomeIcon, adminOnly: true },
  { href: "/admin/linguistic", label: "עריכה לשונית", icon: EditIcon, needLinguistic: true },
  { href: "/respondent", label: "אזור משיב", icon: RespondentIcon, needRespondent: true },
  { href: "/proofreader", label: "לובי הגהה", icon: LobbyIcon, needProofreader: true },
  { href: "/admin/team", label: "ניהול צוות", icon: UsersIcon, adminOnly: true },
  { href: "/admin/topics", label: "נושאים והגהות", icon: BookIcon, adminOnly: true },
  { href: "/admin/analytics", label: "נתונים ודיאגרמות", icon: ChartIcon, adminOnly: true },
  { href: "/admin/archive", label: "ארכיון", icon: ArchiveIcon, adminOnly: true },
  { href: "/admin/trash", label: "אשפה", icon: TrashIcon, adminOnly: true },
];

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" x2="18" y1="20" y2="10" />
      <line x1="12" x2="12" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function RespondentIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function LobbyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
    </svg>
  );
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

interface AdminNavProps {
  delayedQuestions?: DelayedQuestionItem[];
  onNavigate?: () => void;
}

export function AdminNav({ delayedQuestions = [], onNavigate }: AdminNavProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [nav, setNav] = useState<NavItem[]>(navItems);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, is_technical_lead, is_respondent, is_proofreader, is_linguistic_editor, proofreader_type_id")
        .eq("id", user.id)
        .single();
      const isAdmin = profile?.is_admin === true || profile?.is_technical_lead === true;
      const canRespondent = isAdmin || profile?.is_respondent === true;
      const canProofreader = isAdmin || (profile?.is_proofreader === true && profile?.proofreader_type_id);
      const canLinguistic = isAdmin || profile?.is_linguistic_editor === true;
      const filtered = navItems.filter((item) => {
        if (item.adminOnly) return isAdmin;
        if (item.needRespondent) return canRespondent;
        if (item.needProofreader) return canProofreader;
        if (item.needLinguistic) return canLinguistic;
        return true;
      });
      if (!cancelled) setNav(filtered);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const openDelayedInDashboard = (questionId: string) => {
    onNavigate?.();
    router.push(`/admin?open=${encodeURIComponent(questionId)}`);
  };

  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-3">
      {nav.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-white/15 text-white font-semibold"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            )}
          >
            <item.icon className="shrink-0" />
            {item.label}
          </Link>
        );
      })}
      {delayedQuestions.length > 0 && (
        <div className="mt-4 border-t border-slate-600/60 pt-3">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">עיכובים (5+ ימים)</p>
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {delayedQuestions.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => openDelayedInDashboard(q.id)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-start text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <span className="font-medium">{q.short_id ?? q.id.slice(0, 8)}</span>
                  <span className="line-clamp-1 text-slate-400">{q.title || "—"}</span>
                  <span className="text-[10px] text-amber-400/90">{STAGE_LABELS[q.stage]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto border-t border-slate-600/60 pt-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
        >
          <LogoutIcon className="shrink-0" />
          יציאה
        </button>
      </div>
    </nav>
  );
}
