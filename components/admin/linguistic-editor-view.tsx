"use client";

import { QuestionDetailsModal } from "@/components/admin/question-details-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { QuestionRow } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

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

  const [pdfPending, setPdfPending] = useState<string | null>(null);
  const [sendPending, setSendPending] = useState<string | null>(null);

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

  const handleSendAndArchive = async (q: QuestionRow) => {
    if (!q.asker_email?.trim()) {
      alert("לא הוזן מייל לשואל. לא ניתן לשלוח.");
      return;
    }
    if (!confirm(`לשלוח את התשובה למייל ${q.asker_email} ולעבור לארכיון?`)) return;
    setSendPending(q.id);
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
          <li key={q.id}>
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

      <QuestionDetailsModal
        question={selected}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelected(null);
        }}
        onSaveSuccess={handleSaveSuccess}
        showPdfActions
        onCreatePdf={handleCreatePdf}
        onSendAndArchive={handleSendAndArchive}
        pdfPending={selected ? pdfPending === selected.id : false}
        sendPending={selected ? sendPending === selected.id : false}
      />
    </>
  );
}
