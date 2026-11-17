"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState, type MouseEvent } from "react";
import { AdminQuestionStageModal } from "@/components/admin/admin-question-stage-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageLoadingSpinner } from "@/components/ui/page-loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProofreaderTypeOption, TopicOption } from "@/app/admin/actions";
import type { QuestionRow, QuestionStage } from "@/lib/types";
import { afterModalClose, cn } from "@/lib/utils";
import { ACTIVE_STAGES, STAGE_LABELS } from "@/lib/types";

function StageIconClock({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function StageIconUser({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function StageIconLobby({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function StageIconEdit({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
function StageIconSend({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}
function StageIconArchive({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function ExcelIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" x2="16" y1="13" y2="13" />
      <line x1="8" x2="16" y1="17" y2="17" />
      <line x1="8" x2="16" y1="21" y2="21" />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChevronIcon({ className, open }: { className?: string; open?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className, "transition-transform", open && "rotate-180")}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const RESPONSE_TYPE_LABEL: Record<string, string> = {
  short: "קצר ולעניין",
  detailed: "תשובה מפורטת",
};

function askerGenderLabel(g: "M" | "F" | null | undefined): string {
  if (g === "M") return "בחור";
  if (g === "F") return "בחורה";
  return "—";
}

function publicationLabel(
  consent: string | null | undefined,
  askerGender: "M" | "F" | null | undefined
): string {
  const male = askerGender === "M";
  if (consent === "publish") return male ? "מסכים לפרסם" : "מסכימה לפרסם";
  if (consent === "blur") return male ? "מסכים בטשטוש נתונים" : "מסכימה בטשטוש נתונים";
  if (consent === "none") return "לא לפרסום";
  if (consent === "not_asked") return "לא נשאל";
  return "—";
}

function formatCreatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function InboxEmptyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

const STAGE_BADGE_CLASS: Record<QuestionStage, string> = {
  waiting_assignment: "bg-pink-100 text-pink-800 border-pink-200/60",
  with_respondent: "bg-sky-100 text-sky-800 border-sky-200/60",
  in_proofreading_lobby: "bg-violet-100 text-violet-800 border-violet-200/60",
  in_linguistic_review: "bg-amber-100 text-amber-900 border-amber-200/60",
  ready_for_sending: "bg-emerald-100 text-emerald-800 border-emerald-200/60",
  pending_manager: "bg-rose-100 text-rose-800 border-rose-200/60",
  sent_archived: "bg-muted text-secondary border-card-border",
};

/** תג ID עדין לפי שלב — רקע רך + טקסט צבעוני ברור */
const STAGE_ID_CHIP_CLASS: Record<QuestionStage, string> = {
  waiting_assignment: "bg-pink-50 text-pink-600 ring-pink-200/70",
  with_respondent: "bg-sky-50 text-sky-600 ring-sky-200/70",
  in_proofreading_lobby: "bg-violet-50 text-violet-600 ring-violet-200/70",
  in_linguistic_review: "bg-amber-50 text-amber-700 ring-amber-200/70",
  ready_for_sending: "bg-emerald-50 text-emerald-600 ring-emerald-200/70",
  pending_manager: "bg-rose-50 text-rose-600 ring-rose-200/70",
  sent_archived: "bg-muted text-secondary ring-card-border",
};

const CARD_STYLES: Record<
  QuestionStage,
  { bg: string; border: string; number: string; label: string; iconBg: string; iconColor: string }
> = {
  waiting_assignment: {
    bg: "bg-pink-50",
    border: "border-pink-200",
    number: "text-pink-900",
    label: "text-pink-900",
    iconBg: "bg-pink-100/90",
    iconColor: "text-pink-600",
  },
  with_respondent: {
    bg: "bg-sky-50",
    border: "border-sky-200",
    number: "text-sky-900",
    label: "text-sky-900",
    iconBg: "bg-sky-100/90",
    iconColor: "text-sky-600",
  },
  in_proofreading_lobby: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    number: "text-violet-900",
    label: "text-violet-900",
    iconBg: "bg-violet-100/90",
    iconColor: "text-violet-600",
  },
  in_linguistic_review: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    number: "text-amber-950",
    label: "text-amber-950",
    iconBg: "bg-amber-100/90",
    iconColor: "text-amber-700",
  },
  ready_for_sending: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    number: "text-emerald-900",
    label: "text-emerald-900",
    iconBg: "bg-emerald-100/90",
    iconColor: "text-emerald-600",
  },
  pending_manager: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    number: "text-rose-900",
    label: "text-rose-900",
    iconBg: "bg-rose-100/90",
    iconColor: "text-rose-600",
  },
  sent_archived: {
    bg: "bg-muted",
    border: "border-card-border",
    number: "text-foreground",
    label: "text-secondary",
    iconBg: "bg-card",
    iconColor: "text-muted-foreground",
  },
};

function StageIcon({ stage, className }: { stage: QuestionStage; className?: string }) {
  const c = className ?? "size-4";
  switch (stage) {
    case "waiting_assignment": return <StageIconClock className={c} />;
    case "with_respondent": return <StageIconUser className={c} />;
    case "in_proofreading_lobby": return <StageIconLobby className={c} />;
    case "in_linguistic_review": return <StageIconEdit className={c} />;
    case "ready_for_sending": return <StageIconSend className={c} />;
    case "pending_manager": return <StageIconClock className={c} />;
    case "sent_archived": return <StageIconArchive className={c} />;
  }
}

interface AdminDashboardProps {
  questions: QuestionRow[];
  topics: TopicOption[];
  proofreaderTypes: ProofreaderTypeOption[];
  initialOpenQuestionId?: string;
  emailCounts?: Record<string, number>;
}

export function AdminDashboard({ questions, topics, proofreaderTypes, initialOpenQuestionId, emailCounts = {} }: AdminDashboardProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<QuestionStage | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [stageModalQuestion, setStageModalQuestion] = useState<QuestionRow | null>(null);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [emailModalEmail, setEmailModalEmail] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailModalList, setEmailModalList] = useState<{ id: string; short_id: string | null; title: string | null; stage: QuestionStage; created_at: string }[]>([]);
  const [emailModalLoading, setEmailModalLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const rowKey = (q: QuestionRow) => q.answer_id ?? q.id;
  const toggleExpand = (key: string, e: MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const activeCount = questions.length;
  const byStage = ACTIVE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = questions.filter((q) => q.stage === stage).length;
      return acc;
    },
    {} as Record<QuestionStage, number>
  );
  const lobbyQuestions = questions.filter((q) => q.stage === "in_proofreading_lobby");
  const byProofreaderType = proofreaderTypes.map((t) => ({
    id: t.id,
    name_he: t.name_he,
    count: lobbyQuestions.filter((q) => q.proofreader_type_id === t.id).length,
  }));
  const byStageFiltered =
    filter === "all"
      ? questions
      : questions.filter((q) => q.stage === filter);
  const q = (searchQuery ?? "").trim().toLowerCase();
  const filtered = q
    ? byStageFiltered.filter(
        (row) =>
          (row.short_id ?? "").toLowerCase().includes(q) ||
          (row.title ?? "").toLowerCase().includes(q) ||
          (row.content ?? "").toLowerCase().includes(q)
      )
    : byStageFiltered;

  const openStageModal = (q: QuestionRow) => {
    setStageModalQuestion(q);
    setStageModalOpen(true);
  };

  // פתיחת מודל שאלה כשנכנסים עם ?open=id (מעיכובים בסרגל)
  useEffect(() => {
    if (!initialOpenQuestionId || !questions.length) return;
    const q = questions.find((x) => x.id === initialOpenQuestionId);
    if (q) {
      setStageModalQuestion(q);
      setStageModalOpen(true);
      setFilter("all");
    }
  }, [initialOpenQuestionId, questions]);

  // רענון אוטומטי כל 2 שניות כשהטאב גלוי (מגיה שתפס תשובה — השם יתעדכן)
  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        router.refresh();
      }
    };
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [router]);

  const openEmailReuseModal = (e: React.MouseEvent, email: string | null | undefined) => {
    e.stopPropagation();
    const em = (email ?? "").trim();
    if (!em) return;
    setEmailModalEmail(em);
    setEmailModalOpen(true);
    setEmailModalLoading(true);
    setEmailModalList([]);
    import("@/app/admin/actions").then(({ getQuestionsByEmail }) => {
      getQuestionsByEmail(em).then((list) => {
        setEmailModalList(list);
        setEmailModalLoading(false);
      });
    });
  };

  const downloadExcel = () => {
    const BOM = "\uFEFF";
    const headers = ["ID שאלה", "כותרת השאלה", "סטטוס", "משיב/ה", "מגיה/ה"];
    const rows = filtered.map((q) => [
      q.short_id ?? q.id.slice(0, 8),
      (q.title ?? "").replace(/"/g, '""'),
      STAGE_LABELS[q.stage],
      q.respondent_name ?? "",
      q.proofreader_name ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\r\n");
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `לוח-בקרה-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 sm:space-y-7">
      <section className="space-y-3" aria-labelledby="dashboard-stage-summary-heading">
        <div className="flex flex-col gap-0.5">
          <h2 id="dashboard-stage-summary-heading" className="text-sm font-semibold tracking-tight text-foreground md:text-base">
            סיכום לפי שלב
          </h2>
          <p className="text-xs text-muted-foreground md:text-sm">לחיצה על כרטיס מסננת את המשימות למטה</p>
        </div>
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-3 sm:gap-2 md:grid-cols-4 md:gap-3 lg:grid-cols-5">
        {ACTIVE_STAGES.map((stage) => {
          const style = CARD_STYLES[stage];
          const isLobby = stage === "in_proofreading_lobby";
          return (
            <button
              key={stage}
              type="button"
              onClick={() => setFilter(stage)}
              className={cn(
                "flex flex-col overflow-hidden rounded-xl border px-1 py-1 shadow-card transition-all duration-200 motion-reduce:transition-none sm:px-2 sm:py-1.5 md:rounded-2xl md:px-3 md:py-3 md:hover:shadow-soft motion-reduce:hover:shadow-card",
                "min-h-0 justify-between gap-0.5 md:gap-1",
                "aspect-[3/2] sm:aspect-[2/1]",
                style.bg,
                style.border,
                filter === stage &&
                  "border-primary/40 ring-2 ring-primary/50 ring-offset-2 ring-offset-background shadow-soft"
              )}
              dir="rtl"
            >
              {/* מובייל: טקסט בשתי שורות מימין, סמליל ומתחתיו מספר בשמאל */}
              <div className="flex w-full items-stretch justify-between gap-1 md:hidden">
                <span className={cn("min-w-0 flex-1 line-clamp-2 text-[10px] leading-tight font-semibold text-right", style.label)}>
                  {STAGE_LABELS[stage]}
                </span>
                <div className="flex shrink-0 flex-col items-center gap-0.5">
                  <span className={cn("rounded p-0.5", style.iconBg, style.iconColor)}>
                    <StageIcon stage={stage} className="size-3.5" />
                  </span>
                  <span className={cn("text-xs font-bold tabular-nums", style.number)}>{byStage[stage] ?? 0}</span>
                </div>
              </div>
              {/* דסקטופ: שורה עליונה תווית+אייקון, תחתונה מספר+קטגוריות */}
              <div className="hidden w-full flex-col gap-0.5 md:flex">
                <div className="flex w-full items-center justify-end gap-1.5">
                  <span className={cn("min-w-0 flex-1 truncate text-base font-semibold text-right", style.label)}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className={cn("shrink-0 rounded p-1.5", style.iconBg, style.iconColor)}>
                    <StageIcon stage={stage} className="size-5" />
                  </span>
                </div>
                <div className="flex w-full flex-col gap-0.5">
                  <div className="flex w-full justify-start">
                    <span className={cn("text-xl font-bold tabular-nums", style.number)}>{byStage[stage] ?? 0}</span>
                  </div>
                  {isLobby && byProofreaderType.length > 0 && (
                    <div className="flex w-full shrink-0 flex-wrap justify-end gap-x-1 gap-y-0 text-[9px] leading-tight text-violet-800/90 md:gap-x-1.5 md:text-[10px]">
                      {byProofreaderType.map(({ id, name_he, count }, i) => (
                        <span key={`${id}-${i}`} className="whitespace-nowrap">
                          {i > 0 && <span className="text-violet-500/70"> · </span>}
                          <span className="font-medium tabular-nums text-violet-900/90">{count}</span>
                          <span className="text-violet-700/80"> {name_he}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="dashboard-task-list-heading">
        <h2 id="dashboard-task-list-heading" className="text-sm font-semibold tracking-tight text-foreground md:text-base">
          רשימת משימות
        </h2>
      <Card className="overflow-hidden shadow-soft md:shadow-soft">
        <CardContent className="p-0">
          <div
            className="flex flex-col gap-3 border-b border-card-border bg-muted/60 px-2 py-2 md:flex-row md:flex-nowrap md:items-center md:justify-between md:gap-3 md:px-4 md:py-3"
            dir="rtl"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {filter === "all" ? (
                <span className="shrink-0 text-xs font-medium text-foreground md:text-sm">משימות</span>
              ) : (
                <>
                  <span className="min-w-0 max-w-full text-xs text-secondary md:shrink-0 md:text-sm">
                    סינון: <span className="font-medium text-foreground">{STAGE_LABELS[filter]}</span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFilter("all")}
                    className="shrink-0 text-xs md:text-sm"
                  >
                    הצג הכל
                  </Button>
                </>
              )}
            </div>
            <div className="flex w-full min-w-0 items-center gap-2 md:w-auto md:max-w-[min(100%,28rem)] md:flex-1 md:justify-end md:gap-3">
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute start-2.5 top-1/2 z-[1] -translate-y-1/2 text-muted-foreground">
                  <SearchIcon className="size-4 shrink-0" />
                </span>
                <Input
                  type="search"
                  placeholder="חיפוש..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full min-w-0 ps-9 text-xs md:h-9 md:text-sm"
                  dir="rtl"
                  aria-label="חיפוש ברשימת המשימות"
                />
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={downloadExcel}
                className="h-8 shrink-0 gap-1 bg-green-600 px-2 text-white hover:bg-green-700 md:h-9 md:px-2.5"
                title="הורד לאקסל"
              >
                <ExcelIcon className="h-4 w-4 md:h-4 md:w-4" />
                <span className="hidden md:inline">הורד לאקסל</span>
              </Button>
            </div>
          </div>
          <div className="[&>div]:max-h-[min(70vh,720px)] [&>div]:overflow-auto [&>div]:rounded-none [&>div]:border-0 [&>div]:bg-transparent">
          <Table>
            <TableHeader
              className={cn(
                "sticky top-0 z-20 !border-0 !border-b !border-[var(--table-header-border)] !bg-[var(--table-header-bg)] shadow-sm",
                "[&_tr]:!bg-[var(--table-header-bg)] [&_tr:hover]:!bg-[var(--table-header-bg)]"
              )}
            >
              <TableRow className="border-0 !bg-[var(--table-header-bg)] odd:!bg-[var(--table-header-bg)] even:!bg-[var(--table-header-bg)] hover:!bg-[var(--table-header-bg)]">
                <TableHead className="w-8 text-center text-xs font-semibold md:text-sm" />
                <TableHead className="text-center text-xs font-semibold md:text-sm">ID שאלה</TableHead>
                <TableHead className="text-xs font-semibold md:text-sm">שאלה</TableHead>
                <TableHead className="text-xs font-semibold md:text-sm">פונה</TableHead>
                <TableHead className="text-xs font-semibold md:text-sm">סטטוס</TableHead>
                <TableHead className="text-xs font-semibold md:text-sm">משיב/ה</TableHead>
                <TableHead className="text-xs font-semibold md:text-sm">מגיה/ה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="border-0 !bg-transparent odd:!bg-transparent even:!bg-transparent hover:!bg-transparent">
                  <TableCell colSpan={7} className="py-14 text-center align-middle">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <InboxEmptyIcon className="size-12 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-secondary">אין שאלות להצגה</p>
                      <p className="max-w-sm text-xs text-muted-foreground">נסו לשנות את הסינון או את מילות החיפוש</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((q) => {
                  const key = rowKey(q);
                  const expanded = expandedIds.has(key);
                  return (
                    <Fragment key={key}>
                  <TableRow
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-primary/[0.07] motion-reduce:transition-none",
                      q.stage === "pending_manager" &&
                        "border-2 border-red-400 !bg-red-50/60 odd:!bg-red-50/60 even:!bg-red-50/60 hover:!bg-red-100/55",
                      expanded && "bg-muted/70"
                    )}
                    onClick={() => openStageModal(q)}
                  >
                    <TableCell className="w-8 px-1 text-center">
                      <button
                        type="button"
                        onClick={(e) => toggleExpand(key, e)}
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-expanded={expanded}
                        aria-label={expanded ? "כווץ פרטים" : "הרחב פרטים"}
                        title={expanded ? "כווץ" : "פרטים נוספים"}
                      >
                        <ChevronIcon className="size-4" open={expanded} />
                      </button>
                    </TableCell>
                    <TableCell className="text-center font-mono text-[11px] md:text-xs">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex rounded-md px-1.5 py-0.5 font-medium tracking-wide ring-1 ring-inset",
                            STAGE_ID_CHIP_CLASS[q.stage]
                          )}
                        >
                          {q.short_id ?? `${q.id.slice(0, 8)}…`}
                        </span>
                        {q.answers_count != null && q.answers_count >= 2 && (
                          <Badge variant="secondary" className="text-[10px] font-normal bg-violet-100 text-violet-800 border-violet-200">
                            {q.answers_count} תשובות
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[280px] md:max-w-[320px]">
                      <div className="flex items-start gap-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground md:text-sm">
                            {q.title || "—"}
                          </p>
                          {(q.topic_name_he || q.sub_topic_name_he) && (
                            <p className="mt-0.5 text-[10px] text-muted-foreground md:text-xs">
                              {[q.topic_name_he, q.sub_topic_name_he].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        {(q.asker_email && (emailCounts[(q.asker_email ?? "").trim().toLowerCase()] ?? 0) > 5) && (
                          <button
                            type="button"
                            onClick={(e) => openEmailReuseModal(e, q.asker_email)}
                            className="shrink-0 rounded p-1 text-amber-600 hover:bg-amber-100 hover:text-amber-700"
                            title={`אימייל זה מופיע ב־${emailCounts[(q.asker_email ?? "").trim().toLowerCase()]} שאלות`}
                          >
                            <AlertTriangleIcon className="size-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {q.asker_gender === "M" || q.asker_gender === "F" ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md border text-[10px] font-medium md:text-xs",
                            q.asker_gender === "M"
                              ? "border-blue-200 bg-blue-50 text-blue-800"
                              : "border-rose-200 bg-rose-50 text-rose-800"
                          )}
                        >
                          {askerGenderLabel(q.asker_gender)}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md border text-[10px] font-medium md:text-xs",
                            STAGE_BADGE_CLASS[q.stage]
                          )}
                        >
                          {STAGE_LABELS[q.stage]}
                        </Badge>
                        {(q.stage === "in_proofreading_lobby" ||
                          (q.dual_proof_completed != null && q.dual_proof_completed > 0)) && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-md border text-[10px] font-medium",
                              (q.dual_proof_completed ?? 0) >= 2
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : (q.dual_proof_completed ?? 0) === 1
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : "border-violet-200 bg-violet-50 text-violet-800"
                            )}
                            title={
                              q.dual_proof_slots
                                ?.map((s) => {
                                  const name = s.name || "מגיהה";
                                  if (!s.review) return `${name}: טרם`;
                                  return `${name}: ${s.review.outcome === "approved" ? "אישור" : "הערה"}`;
                                })
                                .join(" · ") ?? undefined
                            }
                          >
                            הגהה {q.dual_proof_completed ?? 0}/{q.dual_proof_required ?? 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[80px] text-[11px] text-secondary md:text-xs">
                      {q.respondent_name?.trim() || "—"}
                    </TableCell>
                    <TableCell className="min-w-[80px] text-[11px] text-secondary md:text-xs">
                      {q.dual_proof_slots?.some((s) => s.name)
                        ? q.dual_proof_slots
                            .map((s) => {
                              const name = s.name || "—";
                              if (!s.review) return `${name} (ממתין)`;
                              return `${name} (${s.review.outcome === "approved" ? "אישור" : "הערה"})`;
                            })
                            .join(" · ")
                        : q.proofreader_name?.trim() || "—"}
                    </TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow
                      className={cn(
                        "border-0 !bg-muted/80 hover:!bg-muted/80",
                        q.stage === "pending_manager" && "!bg-red-50/40 hover:!bg-red-50/40"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TableCell colSpan={7} className="px-4 py-3 md:px-6">
                        <div className="grid gap-3 text-start text-xs md:grid-cols-3 md:gap-4 md:text-sm">
                          <div>
                            <p className="text-[10px] font-medium text-muted-foreground md:text-xs">פונה</p>
                            <p className="font-medium text-foreground">{askerGenderLabel(q.asker_gender)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-muted-foreground md:text-xs">גיל</p>
                            <p className="font-medium text-foreground">{q.asker_age ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-muted-foreground md:text-xs">מסלול</p>
                            <p className="font-medium text-foreground">
                              {q.response_type
                                ? RESPONSE_TYPE_LABEL[q.response_type] ?? q.response_type
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-muted-foreground md:text-xs">הסכמת פרסום</p>
                            <p className="font-medium text-foreground">
                              {publicationLabel(q.publication_consent, q.asker_gender)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-muted-foreground md:text-xs">אימייל</p>
                            <p className="break-all font-medium text-foreground" dir="ltr">
                              {q.asker_email?.trim() || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-muted-foreground md:text-xs">תאריך פנייה</p>
                            <p className="font-medium text-foreground">{formatCreatedAt(q.created_at)}</p>
                          </div>
                          {q.asker_phone?.trim() ? (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground md:text-xs">וואטסאפ</p>
                              <p className="font-medium text-foreground" dir="ltr">
                                {q.asker_phone.trim()}
                              </p>
                            </div>
                          ) : null}
                          {(q.dual_proof_slots?.length ?? 0) > 0 && (
                            <div className="md:col-span-3 space-y-2 rounded-lg border border-violet-200 bg-violet-50/50 p-2">
                              <p className="text-[10px] font-medium text-violet-800 md:text-xs">
                                שער הגהה כפול: {q.dual_proof_completed ?? 0}/{q.dual_proof_required ?? 2}
                              </p>
                              <ul className="space-y-1.5">
                                {(q.dual_proof_slots ?? []).map((s, i) => (
                                  <li key={s.id ?? `slot-${i}`} className="text-[11px] text-foreground md:text-xs">
                                    <span className="font-medium">{s.name || "מגיהה"}</span>
                                    {": "}
                                    {s.review
                                      ? `${s.review.outcome === "approved" ? "אישור" : "הערה"}${
                                          s.review.note?.trim() ? ` — ${s.review.note.trim()}` : ""
                                        }`
                                      : "טרם סיימה"}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="md:col-span-3">
                            <p className="mb-1 text-[10px] font-medium text-muted-foreground md:text-xs">תוכן השאלה</p>
                            <p className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-xl border border-card-border bg-card p-2 text-[11px] leading-relaxed text-secondary md:text-xs">
                              {q.content?.trim() || "—"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
      </section>

      <AdminQuestionStageModal
        question={stageModalQuestion}
        topics={topics}
        open={stageModalOpen}
        onOpenChange={(open) => {
          setStageModalOpen(open);
          if (!open) {
            afterModalClose(() => setStageModalQuestion(null));
            // מנקה את ?open= מה-URL כדי שהרענון האוטומטי לא יפתח שוב את החלון
            router.replace("/admin");
          }
        }}
        onSuccess={() => router.refresh()}
      />

      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 px-0 pt-10 pb-0" dir="rtl">
          <DialogHeader className="px-4 sm:px-6">
            <DialogTitle>שאלות לפי אימייל</DialogTitle>
          </DialogHeader>
          {emailModalEmail && (
            <p className="px-4 text-sm text-secondary sm:px-6">{emailModalEmail}</p>
          )}
          <div className="min-h-0 w-full flex-1 overflow-y-auto">
            {emailModalLoading ? (
              <div className="flex justify-center px-4 py-8 sm:px-6" role="status" aria-live="polite">
                <span className="sr-only">טוען…</span>
                <PageLoadingSpinner />
              </div>
            ) : (
              <ul className="space-y-2 px-4 py-2 sm:px-6">
                {emailModalList.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`/admin?open=${encodeURIComponent(item.id)}`}
                      className="block rounded-xl border border-card-border px-3 py-2 text-sm hover:bg-muted"
                    >
                      <span className="font-medium">{item.short_id ?? item.id.slice(0, 8)}</span>
                      <span className="text-secondary"> — {item.title || "—"}</span>
                      <span className="mr-2 text-xs text-muted-foreground">{STAGE_LABELS[item.stage]}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="px-4 pb-4 pt-1 text-xs text-muted-foreground sm:px-6">
            לחיצה על שאלה תפתח אותה בלוח הבקרה.{" "}
            {emailModalEmail && (
              <a
                href={`/admin/analytics?email=${encodeURIComponent(emailModalEmail)}`}
                className="text-primary underline hover:no-underline"
              >
                לנתונים מלאים לפי אימייל זה
              </a>
            )}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

