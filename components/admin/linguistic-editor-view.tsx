"use client";

import { QuestionDetailsModal } from "@/components/admin/question-details-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { QuestionRow } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/types";
import { getAuthHeaders } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const [selected, setSelected] = useState<QuestionRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSaveSuccess = () => router.refresh();

  const [pdfPending, setPdfPending] = useState<string | null>(null);
  const [sendPending, setSendPending] = useState<string | null>(null);

  const handleCreatePdf = async (questionId: string) => {
    setPdfPending(questionId);
    try {
      const headers = await getAuthHeaders();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90_000);
      const res = await fetch(`/api/questions/${questionId}/pdf`, {
        method: "POST",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "שגיאה ביצירת PDF");
        return;
      }
      const data = (await res.json()) as { pdf_url?: string };
      if (data.pdf_url) {
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
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/questions/${q.id}/send`, { method: "POST", headers });
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
        <p className="text-secondary">אין שאלות בשלב עריכה לשונית או מוכנות לשליחה.</p>
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
                      {q.id.slice(0, 8)}… · {STAGE_LABELS[q.stage]}
                    </p>
                    <p className="mt-1 line-clamp-2 text-start text-sm text-primary" dir="rtl">
                      {truncate(q.content)}
                    </p>
                    {q.proofreader_note && (
                      <p className="mt-2 text-xs text-amber-700">הערת מגיה: {truncate(q.proofreader_note, 60)}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelected(q);
                        setModalOpen(true);
                      }}
                    >
                      ערוך
                    </Button>
                    {q.pdf_url ? (
                      <>
                        <Button variant="outline" size="sm" asChild>
                          <a href={q.pdf_url!} target="_blank" rel="noopener noreferrer">
                            צפה ב-PDF
                          </a>
                        </Button>
                        <Button variant="default" size="sm" className="bg-primary" asChild>
                          <a href={q.pdf_url!} download={`response-${q.id.slice(0, 8)}.pdf`}>
                            הורד PDF
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCreatePdf(q.id)}
                          disabled={pdfPending === q.id}
                        >
                          {pdfPending === q.id ? "מייצר…" : "יצור PDF מחדש"}
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleSendAndArchive(q)}
                          disabled={sendPending === q.id || !q.asker_email?.trim()}
                        >
                          {sendPending === q.id ? "שולח…" : "שלח לשואל וארכב"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleCreatePdf(q.id)}
                        disabled={pdfPending === q.id}
                        className="bg-primary"
                      >
                        {pdfPending === q.id ? "מייצר…" : "יצירת PDF"}
                      </Button>
                    )}
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
      />
    </>
  );
}
