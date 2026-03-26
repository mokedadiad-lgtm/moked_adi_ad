"use client";

import type { DelayedQuestionItem } from "@/app/admin/actions";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { STAGE_LABELS } from "@/lib/types";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type NavSectionId = "main" | "roles" | "admin" | "archive";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section: NavSectionId;
  adminOnly?: boolean;
  needRespondent?: boolean;
  needProofreader?: boolean;
  needLinguistic?: boolean;
};

const SECTION_ORDER: NavSectionId[] = ["main", "roles", "admin", "archive"];

const SECTION_TITLES: Record<NavSectionId, string> = {
  main: "תפעול ושאלות",
  roles: "הגהות, משיבים ועריכה לשונית",
  admin: "ניהול ונתונים",
  archive: "ארכיון ואשפה",
};

const navItems: NavItem[] = [
  { href: "/admin", label: "לוח בקרה", icon: HomeIcon, section: "main", adminOnly: true },
  { href: "/admin/whatsapp-inbox", label: "דואר נכנס וואטסאפ", icon: ChatIcon, section: "main", adminOnly: true },
  { href: "/admin/linguistic", label: "עריכה לשונית", icon: EditIcon, section: "roles", needLinguistic: true },
  { href: "/respondent", label: "אזור משיב", icon: RespondentIcon, section: "roles", needRespondent: true },
  { href: "/proofreader", label: "לובי הגהה", icon: LobbyIcon, section: "roles", needProofreader: true },
  { href: "/admin/team", label: "ניהול צוות", icon: UsersIcon, section: "admin", adminOnly: true },
  { href: "/admin/topics", label: "נושאים והגהות", icon: BookIcon, section: "admin", adminOnly: true },
  { href: "/admin/analytics", label: "נתונים ודיאגרמות", icon: ChartIcon, section: "admin", adminOnly: true },
  { href: "/admin/archive", label: "ארכיון", icon: ArchiveIcon, section: "archive", adminOnly: true },
  { href: "/admin/trash", label: "אשפה", icon: TrashIcon, section: "archive", adminOnly: true },
];

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

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

function ChatIcon({ className }: { className?: string }) {
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
      <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4z" />
      <path d="M8 9h8" />
      <path d="M8 13h6" />
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

function groupNavBySection(items: NavItem[]): [NavSectionId, NavItem[]][] {
  const map = new Map<NavSectionId, NavItem[]>();
  for (const id of SECTION_ORDER) map.set(id, []);
  for (const item of items) {
    map.get(item.section)!.push(item);
  }
  return SECTION_ORDER.filter((id) => (map.get(id) ?? []).length > 0).map((id) => [id, map.get(id)!]);
}

const defaultOpenSections = (): Record<NavSectionId, boolean> => ({
  main: false,
  roles: false,
  admin: false,
  archive: false,
});

export function AdminNav({ delayedQuestions = [], onNavigate }: AdminNavProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [nav, setNav] = useState<NavItem[]>(navItems);
  const [openSections, setOpenSections] = useState<Record<NavSectionId, boolean>>(defaultOpenSections);

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

  useEffect(() => {
    const section = nav.find((i) => i.href === pathname)?.section;
    if (section) {
      setOpenSections((s) => ({ ...s, [section]: true }));
    }
  }, [pathname, nav]);

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

  const sections = groupNavBySection(nav);

  return (
    <nav className="flex flex-1 flex-col gap-2 p-3">
      {sections.map(([sectionId, items]) => {
        const isOpen = openSections[sectionId] === true;
        return (
          <div
            key={sectionId}
            className="rounded-lg border border-slate-200/90 bg-white/80 shadow-sm md:border-white/5 md:bg-black/10 md:shadow-none"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() =>
                setOpenSections((s) => ({
                  ...s,
                  [sectionId]: !isOpen,
                }))
              }
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-start text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 md:text-slate-300 md:hover:bg-white/5"
            >
              <span>{SECTION_TITLES[sectionId]}</span>
              <ChevronDownIcon
                className={cn(
                  "shrink-0 text-slate-500 transition-transform duration-200 md:text-slate-500",
                  isOpen && "rotate-180"
                )}
              />
            </button>
            {isOpen && (
              <div className="flex flex-col gap-0.5 border-t border-slate-200/80 px-1.5 pb-2 pt-1 md:border-white/5">
                {items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/15 font-semibold text-primary md:bg-primary/30 md:text-white"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 md:text-slate-300 md:hover:bg-white/10 md:hover:text-white"
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0 opacity-90" />
                      <span className="leading-snug">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {delayedQuestions.length > 0 && (
        <div className="mt-4 border-t border-slate-200/90 pt-3 md:border-white/15">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-600 md:text-slate-400">
            עיכובים (5+ ימים)
          </p>
          <ul className="scrollbar-sidebar-nav flex max-h-40 flex-col gap-1 overflow-y-auto">
            {delayedQuestions.map((q) => (
              <li key={q.answer_id ? `${q.id}-${q.answer_id}` : q.id}>
                <button
                  type="button"
                  onClick={() => openDelayedInDashboard(q.id)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-start text-xs text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 md:text-slate-300 md:hover:bg-white/10 md:hover:text-white"
                >
                  <span className="font-medium">{q.short_id ?? q.id.slice(0, 8)}</span>
                  <span className="line-clamp-1 text-slate-500 md:text-slate-400">{q.title || "—"}</span>
                  <span className="text-[10px] text-amber-700 md:text-amber-400/90">{STAGE_LABELS[q.stage]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto border-t border-slate-200/90 pt-3 md:border-white/15">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:text-slate-400 md:hover:bg-white/10 md:hover:text-slate-200"
        >
          <LogoutIcon className="shrink-0" />
          יציאה
        </button>
      </div>
    </nav>
  );
}
