"use client";

import { updateQuestionStage } from "@/app/admin/actions";
import { PdfViewModal } from "@/components/admin/pdf-view-modal";
import { QuestionDetailsModal } from "@/components/admin/question-details-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { QuestionRow, QuestionStage } from "@/lib/types";
import { ACTIVE_STAGES, STAGE_LABELS } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { afterModalClose, cn } from "@/lib/utils";

function IconEye({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconDownload({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const STAGE_BADGE_CLASS = "bg-slate-100 text-slate-700 border-slate-200/60";
const PDF_BUTTON_CLASS = "border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-400";

interface ArchiveTableProps {
  questions: QuestionRow[];
}

export function ArchiveTable({ questions }: ArchiveTableProps) {
  const router = useRouter();
  const [detailQuestion, setDetailQuestion] = useState<QuestionRow | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [viewPdfQuestionId, setViewPdfQuestionId] = useState<string | null>(null);
  const [returnModalQuestion, setReturnModalQuestion] = useState<QuestionRow | null>(null);
  const [returnSelectedStage, setReturnSelectedStage] = useState<QuestionStage | "">("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleRowClick = (q: QuestionRow) => {
    setDetailQuestion(q);
    setDetailModalOpen(true);
  };

  const handleOpenReturnModal = (e: React.MouseEvent, q: QuestionRow) => {
    e.stopPropagation();
    setReturnModalQuestion(q);
    setReturnSelectedStage("");
  };

  const handleReturnToActive = async () => {
    if (!returnModalQuestion || !returnSelectedStage || returnSelectedStage === "sent_archived") return;
    setPendingId(returnModalQuestion.id);
    const result = await updateQuestionStage(returnModalQuestion.id, returnSelectedStage as QuestionStage);
    setPendingId(null);
    if (result.ok) {
      setReturnModalQuestion(null);
      setReturnSelectedStage("");
      router.refresh();
    } else alert(result.error);
  };

  return (
    <>
    <Card className="overflow-hidden rounded-2xl">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>ID שאלה</TableHead>
              <TableHead>נושא | תת נושא</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>תאריך סיום טיפול</TableHead>
              <TableHead>PDF</TableHead>
              <TableHead>החזרה לסטטוס פעיל</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.length === 0 ? (
              <TableRow className="border-0 !bg-transparent odd:!bg-transparent even:!bg-transparent hover:!bg-transparent">
                <TableCell colSpan={6} className="py-8 text-center text-secondary">
                  אין שאלות בארכיון
                </TableCell>
              </TableRow>
            ) : (
              questions.map((q) => {
                const pdfDownloadUrl = `/api/questions/${q.id}/pdf/download?for=archive`;
                const topicSub = [q.topic_name_he, q.sub_topic_name_he].filter(Boolean).join(" | ") || "—";
                return (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer hover:bg-slate-100/70 motion-reduce:transition-none"
                    onClick={() => handleRowClick(q)}
                  >
                    <TableCell className="font-mono text-xs text-secondary" onClick={(e) => e.stopPropagation()}>
                      {q.short_id ?? `${q.id.slice(0, 8)}…`}
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <p className="text-sm font-medium text-slate-800">{q.title || "—"}</p>
                      <p className="text-xs text-slate-600">{topicSub}</p>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Badge
                        variant="outline"
                        className={cn("rounded-md border font-medium", STAGE_BADGE_CLASS)}
                      >
                        {STAGE_LABELS[q.stage]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-secondary" onClick={(e) => e.stopPropagation()}>
                      {q.sent_at ? formatDate(q.sent_at) : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-nowrap items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className={cn("shrink-0", PDF_BUTTON_CLASS)}
                          onClick={(e) => { e.stopPropagation(); setViewPdfQuestionId(q.id); }}
                          title="צפייה ב-PDF"
                        >
                          <IconEye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={cn("shrink-0", PDF_BUTTON_CLASS)}
                          asChild
                        >
                          <a href={pdfDownloadUrl} download title="הורדת PDF">
                            <IconDownload className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleOpenReturnModal(e, q)}
                      >
                        החזרה לסטטוס פעיל
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>

    <QuestionDetailsModal
      question={detailQuestion}
      open={detailModalOpen}
      onOpenChange={(open) => {
        setDetailModalOpen(open);
        if (!open) afterModalClose(() => setDetailQuestion(null));
      }}
      showPdfActions
    />

    <PdfViewModal
      open={!!viewPdfQuestionId}
      onOpenChange={(open) => !open && setViewPdfQuestionId(null)}
      questionId={viewPdfQuestionId}
      forParam="archive"
    />

    <Dialog open={!!returnModalQuestion} onOpenChange={(open) => !open && setReturnModalQuestion(null)}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>החזרה לסטטוס פעיל</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-secondary text-start">
          בחר/י את הסטטוס שאליו להחזיר את השאלה:
        </p>
        <Select
          value={returnSelectedStage}
          onValueChange={(v) => setReturnSelectedStage(v as QuestionStage)}
        >
          <SelectTrigger className="min-w-[180px] text-right w-full">
            <SelectValue placeholder="בחר/י סטטוס" />
          </SelectTrigger>
          <SelectContent>
            {ACTIVE_STAGES.map((s) => (
              <SelectItem key={s} value={s} className="text-right">
                {STAGE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setReturnModalQuestion(null)}>
            ביטול
          </Button>
          <Button
            onClick={handleReturnToActive}
            disabled={!returnSelectedStage || returnSelectedStage === "sent_archived" || !!(returnModalQuestion && pendingId === returnModalQuestion.id)}
          >
            {returnModalQuestion && pendingId === returnModalQuestion.id ? "מעדכן…" : "החזר לפעיל"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
