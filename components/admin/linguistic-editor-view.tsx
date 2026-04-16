"use client";

import { saveLinguisticResponse } from "@/app/admin/actions";
import { QuestionDetailsModal } from "@/components/admin/question-details-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { QuestionRow } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { afterModalClose, cn } from "@/lib/utils";

function truncate(text: string, max = 80): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max) + "…";
}

interface LinguisticEditorViewProps {
  questions: QuestionRow[];
}

export function LinguisticEditorView({ questions }: LinguisticEditorViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openQuestionId = searchParams.get("open");
  const openedFromLink = useRef(false);
  const [selected, setSelected] = useState<QuestionRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSaveSuccess = () => router.refresh();

  // קישור עם ?open=QUESTION_ID — לפתוח ישירות את חלון השאלה
  useEffect(() => {
    if (openedFromLink.current || !openQuestionId || questions.length === 0) return;
    const q = questions.find((x) => x.id === openQuestionId);
    if (q) {
      openedFromLink.current = true;
      setSelected(q);
      setModalOpen(true);
      router.replace("/admin/linguistic", { scroll: false });
    }
  }, [questions, openQuestionId, router]);

  // אחרי רענון — לעדכן את השאלה הנבחרת מהשרת. לא לדרוס pdf_url אם בשרת עדיין אין (cache) ויש לנו מקומית.
  useEffect(() => {
    if (!selected?.id || questions.length === 0) return;
    const updated = questions.find((q) => q.id === selected.id);
    if (!updated || updated === selected) return;
    if (selected.pdf_url && !updated.pdf_url) {
      setSelected((prev) => (prev?.id === updated.id ? { ...updated, pdf_url: prev.pdf_url, pdf_generated_at: prev.pdf_generated_at ?? null } : prev));
      return;
    }
    setSelected(updated);
  }, [questions, selected?.id]);

  const [pdfPending, setPdfPending] = useState<string | null>(null);
  const [mergePending, setMergePending] = useState<string | null>(null);
  const [sendPending, setSendPending] = useState<string | null>(null);
  const [sendConfirmQuestion, setSendConfirmQuestion] = useState<QuestionRow | null>(null);

  const handleCreatePdf = async (questionId: string) => {
    setPdfPending(questionId);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90_000);
      const res = await fetch(`/api/questions/${questionId}/pdf`, {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "שגיאה ביצירת PDF");
        return;
      }
      const data = (await res.json()) as { pdf_url?: string; pdf_generated_at?: string };
      if (data.pdf_url) {
        setSelected((prev) =>
          prev?.id === questionId
            ? { ...prev, pdf_url: data.pdf_url!, pdf_generated_at: data.pdf_generated_at ?? null }
            : prev
        );
        router.refresh();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        alert("יצירת ה-PDF לוקחת זמן. נסה שוב או חכה עוד רגע.");
      } else {
        alert("שגיאה בחיבור לשרת. וודא שהשרת רץ ונסה שוב.");
      }
    } finally {
      setPdfPending(null);
    }
  };

  const handleMerge = async (questionId: string) => {
    setMergePending(questionId);
    try {
      const res = await fetch(`/api/questions/${questionId}/merge`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "שגיאה במיזוג תשובות");
        return;
      }
      router.refresh();
      if (selected?.id === questionId) {
        setSelected((prev) => prev ? { ...prev, answers_merged_at: new Date().toISOString(), answers_count: prev.answers_count ?? 0 } : null);
      }
    } catch {
      alert("שגיאה בחיבור לשרת. נסה שוב.");
    } finally {
      setMergePending(null);
    }
  };

  const handleSendAndArchive = (q: QuestionRow) => {
    if (!q.asker_email?.trim()) {
      alert("לא הוזן מייל לשואל. לא ניתן לשלוח.");
      return;
    }
    setSendConfirmQuestion(q);
  };

  const doSendAndArchive = async () => {
    const q = sendConfirmQuestion;
    if (!q) return;
    setSendPending(q.id);
    setSendConfirmQuestion(null);
    try {
      const res = await fetch(`/api/questions/${q.id}/send`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "שגיאה בשליחה");
        return;
      }
      router.refresh();
    } catch {
      alert("שגיאה בחיבור לשרת. נסה שוב.");
    } finally {
      setSendPending(null);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-12 text-start">
        <p className="text-secondary">אין שאלות בשלב עריכה לשונית או מוכנות לשליחה{"\u200E"}.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-4">
        {questions.map((q) => (
          <li key={q.answer_id ?? q.id}>
            <Card
              className={cn(
                "overflow-hidden transition-shadow hover:shadow-md",
                (q.stage === "in_linguistic_review" && q.proofreader_note) && "border-amber-300/60"
              )}
            >
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => {
                      setSelected(q);
                      setModalOpen(true);
                    }}
                  >
                    <p className="text-xs text-secondary">
                      {q.short_id ?? `${q.id.slice(0, 8)}…`} · {STAGE_LABELS[q.stage]}
                    </p>
                    {q.title && (
                      <p className="mt-1 text-sm font-medium text-slate-800" dir="rtl">{q.title}</p>
                    )}
                    <p className={cn("line-clamp-2 text-start text-sm text-primary", q.title && "mt-0.5")} dir="rtl">
                      {truncate(q.content)}
                    </p>
                    {q.proofreader_note && (
                      <p className="mt-2 text-xs text-amber-700">הערת מגיה{"\u200E"}: {truncate(q.proofreader_note, 60)}</p>
                    )}
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-primary"
                      onClick={() => {
                        setSelected(q);
                        setModalOpen(true);
                      }}
                    >
                      ערוך
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {/* חלון אישור שליחה וארכוב (סגנון מערכת) */}
      <Dialog open={!!sendConfirmQuestion} onOpenChange={(open) => !open && setSendConfirmQuestion(null)}>
        <DialogContent className="max-w-sm rounded-2xl border border-card-border bg-card px-5 py-4 text-center shadow-soft" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-center">אישור שליחה וארכוב</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 text-center">
            {sendConfirmQuestion && (
              <>לשלוח את התשובה למייל {sendConfirmQuestion.asker_email} ולעבור לארכיון?</>
            )}
          </p>
          <DialogFooter className="flex justify-center gap-2 mt-4">
            <Button variant="outline" onClick={() => setSendConfirmQuestion(null)}>ביטול</Button>
            <Button variant="default" className="bg-green-600 text-white hover:bg-green-700" onClick={doSendAndArchive} disabled={!!sendPending}>
              {sendPending ? "שולח…" : "אישור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuestionDetailsModal
        question={selected}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) afterModalClose(() => setSelected(null));
        }}
        onSaveSuccess={handleSaveSuccess}
        onResponseSaved={(payload) => {
          setSelected((prev) =>
            prev && prev.id === payload.questionId
              ? {
                  ...prev,
                  response_text: payload.responseText,
                  linguistic_signature: payload.linguisticSignature,
                }
              : prev
          );
        }}
        onSaveResponse={async (questionId, answerId, responseText, linguisticSignature) => {
          const r = await saveLinguisticResponse(questionId, answerId, responseText, linguisticSignature);
          return r.ok ? { ok: true } : { ok: false, error: r.error };
        }}
        showPdfActions
        onCreatePdf={handleCreatePdf}
        onSendAndArchive={handleSendAndArchive}
        pdfPending={selected ? pdfPending === selected.id : false}
        sendPending={selected ? sendPending === selected.id : false}
        needsMerge={selected ? (selected.answers_count ?? 0) >= 2 && !selected.answers_merged_at : false}
        onMerge={handleMerge}
        mergePending={selected ? mergePending === selected.id : false}
      />
    </>
  );
}
