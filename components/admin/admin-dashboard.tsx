"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RespondentOption } from "@/app/admin/actions";
import { AdminQuestionStageModal } from "@/components/admin/admin-question-stage-modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TopicOption } from "@/app/admin/actions";
import type { QuestionRow, QuestionStage } from "@/lib/types";
import { ACTIVE_STAGES, STAGE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

function truncateSummary(text: string, maxLen = 80): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
}

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

const STAGE_BADGE_CLASS: Record<QuestionStage, string> = {
  waiting_assignment: "bg-amber-100 text-amber-800 border-amber-200/60",
  with_respondent: "bg-blue-100 text-blue-800 border-blue-200/60",
  in_proofreading_lobby: "bg-violet-100 text-violet-800 border-violet-200/60",
  in_linguistic_review: "bg-orange-100 text-orange-800 border-orange-200/60",
  ready_for_sending: "bg-emerald-100 text-emerald-800 border-emerald-200/60",
  sent_archived: "bg-slate-100 text-slate-700 border-slate-200/60",
};

const CARD_STYLES: Record<
  QuestionStage,
  { bg: string; border: string; number: string; label: string; iconBg: string }
> = {
  waiting_assignment: {
    bg: "bg-amber-200/90",
    border: "border-amber-500",
    number: "text-amber-900",
    label: "text-amber-900",
    iconBg: "bg-amber-400/90 text-white",
  },
  with_respondent: {
    bg: "bg-blue-200/90",
    border: "border-blue-500",
    number: "text-blue-900",
    label: "text-blue-900",
    iconBg: "bg-blue-500/90 text-white",
  },
  in_proofreading_lobby: {
    bg: "bg-violet-200/90",
    border: "border-violet-500",
    number: "text-violet-900",
    label: "text-violet-900",
    iconBg: "bg-violet-500/90 text-white",
  },
  in_linguistic_review: {
    bg: "bg-orange-200/90",
    border: "border-orange-500",
    number: "text-orange-900",
    label: "text-orange-900",
    iconBg: "bg-orange-500/90 text-white",
  },
  ready_for_sending: {
    bg: "bg-emerald-200/90",
    border: "border-emerald-500",
    number: "text-emerald-900",
    label: "text-emerald-900",
    iconBg: "bg-emerald-500/90 text-white",
  },
  sent_archived: {
    bg: "bg-slate-200/90",
    border: "border-slate-500",
    number: "text-slate-800",
    label: "text-slate-700",
    iconBg: "bg-slate-500/80 text-white",
  },
};

function StageIcon({ stage }: { stage: QuestionStage }) {
  switch (stage) {
    case "waiting_assignment": return <StageIconClock className="size-6" />;
    case "with_respondent": return <StageIconUser className="size-6" />;
    case "in_proofreading_lobby": return <StageIconLobby className="size-6" />;
    case "in_linguistic_review": return <StageIconEdit className="size-6" />;
    case "ready_for_sending": return <StageIconSend className="size-6" />;
    case "sent_archived": return <StageIconArchive className="size-6" />;
  }
}

interface AdminDashboardProps {
  questions: QuestionRow[];
  respondents: RespondentOption[];
  topics: TopicOption[];
}

export function AdminDashboard({ questions, respondents, topics }: AdminDashboardProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<QuestionStage | "all">("all");
  const [stageModalQuestion, setStageModalQuestion] = useState<QuestionRow | null>(null);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const activeCount = questions.length;
  const byStage = ACTIVE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = questions.filter((q) => q.stage === stage).length;
      return acc;
    },
    {} as Record<QuestionStage, number>
  );
  const filtered =
    filter === "all"
      ? questions
      : questions.filter((q) => q.stage === filter);

  const openStageModal = (q: QuestionRow) => {
    setStageModalQuestion(q);
    setStageModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-xl border-2 border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 text-start shadow-sm transition-all hover:border-primary/40 hover:shadow-md",
            filter === "all" && "border-primary ring-2 ring-primary/20"
          )}
        >
          <div className="flex items-center gap-2 justify-start">
            <span className="rounded-lg bg-slate-500/80 p-2 text-white">
              <StageIconArchive className="size-6" />
            </span>
            <p className="text-start text-xs font-semibold uppercase tracking-wide text-slate-600">כל המשימות הפעילות</p>
          </div>
          <p className="mt-2 text-start text-2xl font-bold text-slate-800">{activeCount}</p>
        </button>
        {ACTIVE_STAGES.map((stage) => {
          const style = CARD_STYLES[stage];
          return (
            <button
              key={stage}
              type="button"
              onClick={() => setFilter(stage)}
              className={cn(
                "rounded-xl border-2 p-4 text-start shadow-sm transition-all hover:shadow-md",
                style.bg,
                style.border,
                filter === stage && "ring-2 ring-offset-2 ring-primary/50"
              )}
            >
              <div className="flex items-center justify-start gap-2">
                <span className={cn("rounded-lg p-2", style.iconBg)}>
                  <StageIcon stage={stage} />
                </span>
                <p className={cn("text-xs font-semibold uppercase tracking-wide", style.label)}>
                  {STAGE_LABELS[stage]}
                </p>
              </div>
              <p className={cn("mt-2 text-2xl font-bold", style.number)}>
                {byStage[stage] ?? 0}
              </p>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden rounded-xl border border-slate-200/80 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-slate-50/80">
                <TableHead className="font-semibold">ID שאלה</TableHead>
                <TableHead className="font-semibold">נושא / תקציר</TableHead>
                <TableHead className="font-semibold">סטטוס</TableHead>
                <TableHead className="font-semibold">משיב/ה</TableHead>
                <TableHead className="font-semibold">מגיה/ה</TableHead>
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
                    key={q.id}
                    className="cursor-pointer transition-colors hover:bg-primary/5"
                    onClick={() => openStageModal(q)}
                  >
                    <TableCell className="font-mono text-xs text-secondary">
                      {q.id.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <div>
                        <span className="line-clamp-2 text-sm" title={q.content}>
                          {truncateSummary(q.content)}
                        </span>
                        {(q.topic_name_he || q.sub_topic_name_he) && (
                          <p className="mt-1 text-xs text-slate-500">
                            {[q.topic_name_he, q.sub_topic_name_he].filter(Boolean).join(" › ")}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-md border font-medium",
                          STAGE_BADGE_CLASS[q.stage]
                        )}
                      >
                        {STAGE_LABELS[q.stage]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-secondary">
                      {q.respondent_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-secondary">
                      {q.proofreader_name ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AdminQuestionStageModal
        question={stageModalQuestion}
        respondents={respondents}
        topics={topics}
        open={stageModalOpen}
        onOpenChange={(open) => {
          setStageModalOpen(open);
          if (!open) setStageModalQuestion(null);
        }}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}

