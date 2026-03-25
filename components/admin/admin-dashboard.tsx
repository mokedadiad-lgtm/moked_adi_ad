"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { afterModalClose } from "@/lib/utils";
import { ACTIVE_STAGES, STAGE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

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

const STAGE_BADGE_CLASS: Record<QuestionStage, string> = {
  waiting_assignment: "bg-pink-100 text-pink-800 border-pink-200/60",
  with_respondent: "bg-blue-100 text-blue-800 border-blue-200/60",
  in_proofreading_lobby: "bg-violet-100 text-violet-800 border-violet-200/60",
  in_linguistic_review: "bg-orange-100 text-orange-800 border-orange-200/60",
  ready_for_sending: "bg-emerald-100 text-emerald-800 border-emerald-200/60",
  pending_manager: "bg-red-100 text-red-800 border-red-200/60",
  sent_archived: "bg-slate-100 text-slate-700 border-slate-200/60",
};

const CARD_STYLES: Record<
  QuestionStage,
  { bg: string; border: string; number: string; label: string; iconBg: string; iconColor: string }
> = {
  waiting_assignment: {
    bg: "bg-pink-50/90",
    border: "border-pink-400",
    number: "text-pink-900",
    label: "text-pink-900",
    iconBg: "bg-pink-100",
    iconColor: "text-pink-500",
  },
  with_respondent: {
    bg: "bg-blue-50/90",
    border: "border-blue-400",
    number: "text-blue-900",
    label: "text-blue-900",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-500",
  },
  in_proofreading_lobby: {
    bg: "bg-violet-50/90",
    border: "border-violet-400",
    number: "text-violet-900",
    label: "text-violet-900",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-500",
  },
  in_linguistic_review: {
    bg: "bg-orange-50/90",
    border: "border-orange-400",
    number: "text-orange-900",
    label: "text-orange-900",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-500",
  },
  ready_for_sending: {
    bg: "bg-emerald-50/90",
    border: "border-emerald-400",
    number: "text-emerald-900",
    label: "text-emerald-900",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-500",
  },
  pending_manager: {
    bg: "bg-red-50/90",
    border: "border-red-400",
    number: "text-red-900",
    label: "text-red-900",
    iconBg: "bg-red-100",
    iconColor: "text-red-500",
  },
  sent_archived: {
    bg: "bg-slate-50/90",
    border: "border-slate-400",
    number: "text-slate-800",
    label: "text-slate-700",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
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
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-1 sm:grid-cols-3 sm:gap-1.5 md:grid-cols-4 md:gap-3 lg:grid-cols-5">
        {ACTIVE_STAGES.map((stage) => {
          const style = CARD_STYLES[stage];
          const isLobby = stage === "in_proofreading_lobby";
          return (
            <button
              key={stage}
              type="button"
              onClick={() => setFilter(stage)}
              className={cn(
                "flex flex-col overflow-hidden rounded-lg border-2 px-1 py-1 shadow-sm transition-all hover:shadow sm:px-2 sm:py-1.5 md:px-3 md:py-3",
                "min-h-0 justify-between gap-0.5 md:gap-1",
                "aspect-[3/2] sm:aspect-[2/1]",
                style.bg,
                style.border,
                filter === stage && "ring-2 ring-offset-1 ring-primary/50"
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

      <Card className="overflow-hidden rounded-xl border border-slate-200/80 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-nowrap items-center justify-between gap-2 border-b border-slate-200/80 px-2 py-1.5 md:px-3 md:py-2" dir="rtl">
            <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-start gap-2">
              {filter === "all" ? (
                <span className="shrink-0 text-xs font-medium text-slate-800 md:text-sm">משימות:</span>
              ) : (
                <>
                  <span className="shrink-0 text-xs text-slate-600 md:text-sm">
                    סינון: <span className="font-medium text-slate-800">{STAGE_LABELS[filter]}</span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFilter("all")}
                    className="shrink-0 text-xs md:text-sm bg-slate-100 hover:bg-slate-200 border-slate-300"
                  >
                    הצג הכל
                  </Button>
                </>
              )}
            </div>
            <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
              <Input
                type="search"
                placeholder="חיפוש..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-20 border-slate-300 text-xs md:h-9 md:w-36 md:text-sm"
                dir="rtl"
              />
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
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-slate-50/80">
                <TableHead className="text-xs font-semibold md:text-sm">ID שאלה</TableHead>
                <TableHead className="text-xs font-semibold md:text-sm">שאלה</TableHead>
                <TableHead className="text-xs font-semibold md:text-sm">סטטוס</TableHead>
                <TableHead className="text-xs font-semibold md:text-sm">משיב/ה</TableHead>
                <TableHead className="text-xs font-semibold md:text-sm">מגיה/ה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-secondary">
                    אין שאלות להצגה
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((q) => (
                  <TableRow
                    key={q.answer_id ?? q.id}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-primary/5",
                      q.stage === "pending_manager" && "border-2 border-red-400 bg-red-50/50"
                    )}
                    onClick={() => openStageModal(q)}
                  >
                    <TableCell className="font-mono text-[11px] text-secondary md:text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{q.short_id ?? `${q.id.slice(0, 8)}…`}</span>
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
                          <p className="text-xs font-medium text-slate-800 md:text-sm">
                            {q.title || "—"}
                          </p>
                          {(q.topic_name_he || q.sub_topic_name_he) && (
                            <p className="mt-0.5 text-[10px] text-slate-500 md:text-xs">
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
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-md border text-[10px] font-medium md:text-xs",
                          STAGE_BADGE_CLASS[q.stage]
                        )}
                      >
                        {STAGE_LABELS[q.stage]}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-[80px] text-[11px] text-secondary md:text-xs">
                      {q.respondent_name?.trim() || "—"}
                    </TableCell>
                    <TableCell className="min-w-[80px] text-[11px] text-secondary md:text-xs">
                      {q.proofreader_name?.trim() || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

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
            <p className="px-4 text-sm text-slate-600 sm:px-6">{emailModalEmail}</p>
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
                      className="block rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium">{item.short_id ?? item.id.slice(0, 8)}</span>
                      <span className="text-slate-600"> — {item.title || "—"}</span>
                      <span className="mr-2 text-xs text-slate-400">{STAGE_LABELS[item.stage]}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="px-4 pb-4 pt-1 text-xs text-slate-500 sm:px-6">
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

