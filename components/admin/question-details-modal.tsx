"use client";

import { PdfViewModal } from "@/components/admin/pdf-view-modal";
import { RichTextEditor } from "@/components/respondent/rich-text-editor";
import { ResponseTextView } from "@/components/response-text-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SignatureRichField } from "@/components/admin/signature-rich-field";
import { sanitizeSignatureHtml } from "@/lib/response-text";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { QuestionRow } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/types";
import { useEffect, useState } from "react";

const GENDER_LABEL: Record<string, string> = { M: "זכר", F: "נקבה" };
const RESPONSE_LABEL: Record<string, string> = {
  short: "קצר ולעניין",
  detailed: "תשובה מפורטת",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPdfGeneratedAt(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
function IconFilePlus({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" x2="12" y1="18" y2="12" />
      <line x1="9" x2="15" y1="15" y2="15" />
    </svg>
  );
}

interface QuestionDetailsModalProps {
  question: QuestionRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveSuccess?: () => void;
  /** כשמופעל, מציג בחלון כפתורי PDF (צפייה, הורדה, יצירה, שליחה) עם אייקונים */
  showPdfActions?: boolean;
  onCreatePdf?: (questionId: string) => void;
  onSendAndArchive?: (question: QuestionRow) => void;
  pdfPending?: boolean;
  sendPending?: boolean;
  /** כשנכון — יש כמה תשובות לשאלה וטרם בוצע מיזוג; מציג כפתור מיזוג וחוסם יצירת PDF */
  needsMerge?: boolean;
  onMerge?: (questionId: string) => void;
  mergePending?: boolean;
  /** כשמועבר — שמירה דרך שרת (עוקף RLS). מומלץ במסך העריכה הלשונית. */
  onSaveResponse?: (
    questionId: string,
    answerId: string | null,
    responseText: string,
    linguisticSignature?: string | null
  ) => Promise<{ ok: boolean; error?: string }>;
  /** אחרי שמירת תשובה/חתימה — לעדכן את האובייקט בהורה (HTML עשיר) בלי להמתין ל־router.refresh */
  onResponseSaved?: (payload: {
    questionId: string;
    answerId: string | null;
    responseText: string;
    linguisticSignature: string | null;
  }) => void;
}

interface ResponseVersion {
  id: string;
  response_text: string;
  created_at: string;
}

export function QuestionDetailsModal({
  question,
  open,
  onOpenChange,
  onSaveSuccess,
  showPdfActions,
  onCreatePdf,
  onSendAndArchive,
  pdfPending,
  sendPending,
  needsMerge,
  onMerge,
  mergePending,
  onSaveResponse,
  onResponseSaved,
}: QuestionDetailsModalProps) {
  const [versions, setVersions] = useState<ResponseVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [initialResponse, setInitialResponse] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [initialSignature, setInitialSignature] = useState("");
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPdfView, setShowPdfView] = useState(false);

  useEffect(() => {
    if (!open || !question?.id) return;
    const supabase = getSupabaseBrowser();
    supabase
      .from("question_response_versions")
      .select("id, response_text, created_at")
      .eq("question_id", question.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setVersions((data ?? []) as ResponseVersion[]));
  }, [open, question?.id]);

  useEffect(() => {
    if (!open) return;
    const supabase = getSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("is_admin, is_technical_lead, is_linguistic_editor").eq("id", user.id).single().then(({ data }) => {
        const p = data as { is_admin?: boolean; is_technical_lead?: boolean; is_linguistic_editor?: boolean } | null;
        setCanEdit(p?.is_admin === true || p?.is_technical_lead === true || (!!onSaveResponse && p?.is_linguistic_editor === true));
      });
    });
  }, [open, onSaveResponse]);

  useEffect(() => {
    if (open && question) {
      const value = question.response_text ?? "";
      setResponseText(value);
      setInitialResponse(value);
      const sig = question.linguistic_signature ?? "";
      setSignatureText(sig);
      setInitialSignature(sig);
      setSaveError(null);
    }
  }, [open, question?.id, question?.response_text, question?.linguistic_signature]);

  /** מחזיר true אם השמירה הצליחה או שלא היו שינויים, false אם אירעה שגיאה */
  const handleSaveResponse = async (): Promise<boolean> => {
    if (!question) return false;
    const nextTrimmed = responseText.trim();
    const initialTrimmed = initialResponse.trim();
    const nextSigTrim = sanitizeSignatureHtml(signatureText).trim();
    const initialSigTrim = sanitizeSignatureHtml(initialSignature).trim();
    if (nextTrimmed === initialTrimmed && nextSigTrim === initialSigTrim) {
      setSaveError(null);
      return true;
    }

    setSavePending(true);
    setSaveError(null);
    if (onSaveResponse) {
      const result = await onSaveResponse(
        question.id,
        question.answer_id ?? null,
        nextTrimmed,
        nextSigTrim || null
      );
      setSavePending(false);
      if (result.ok) {
        setInitialResponse(nextTrimmed);
        setInitialSignature(signatureText);
        onResponseSaved?.({
          questionId: question.id,
          answerId: question.answer_id ?? null,
          responseText: nextTrimmed,
          linguisticSignature: nextSigTrim || null,
        });
        onSaveSuccess?.();
        return true;
      }
      setSaveError(result.error ?? "שגיאה בשמירה");
      return false;
    }
    const supabase = getSupabaseBrowser();
    const { error } = question.answer_id
      ? await supabase
          .from("question_answers")
          .update({ response_text: nextTrimmed || null, updated_at: new Date().toISOString() })
          .eq("id", question.answer_id)
      : await supabase
          .from("questions")
          .update({ response_text: nextTrimmed || null, updated_at: new Date().toISOString() })
          .eq("id", question.id);
    setSavePending(false);
    if (!error) {
      setInitialResponse(nextTrimmed);
      onResponseSaved?.({
        questionId: question.id,
        answerId: question.answer_id ?? null,
        responseText: nextTrimmed,
        linguisticSignature: nextSigTrim || null,
      });
      onSaveSuccess?.();
      return true;
    }
    setSaveError(error.message);
    return false;
  };

  const handleCreatePdfClick = async () => {
    if (!question || !onCreatePdf) return;
    const hasUnsaved =
      responseText.trim() !== initialResponse.trim() ||
      sanitizeSignatureHtml(signatureText).trim() !== sanitizeSignatureHtml(initialSignature).trim();
    if (hasUnsaved && canEdit) {
      const saved = await handleSaveResponse();
      if (!saved) return;
    }
    onCreatePdf(question.id);
  };

  if (!question) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] w-[95vw] max-w-2xl flex-col gap-0 overflow-hidden p-0 px-0 pt-10 pb-0"
        dir="rtl"
      >
        <DialogHeader className="shrink-0 px-4 sm:px-6">
          <DialogTitle>פירוט השאלה</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 w-full flex-1 overflow-y-auto">
          <div className="space-y-4 px-4 pb-1 sm:px-6">
            <div className="space-y-1">
              {question.title && <p className="text-sm font-medium text-slate-800 text-start">{question.title}</p>}
              <p className="text-xs font-medium text-secondary text-start">תוכן השאלה</p>
              <div className="min-h-[5rem] max-h-[400px] overflow-y-auto rounded-xl border border-card-border bg-slate-50 p-3 text-sm text-slate-700">
                <div className="whitespace-pre-wrap text-start" dir="rtl">
                  {question.content}
                </div>
              </div>
            </div>

            {question.stage === "in_linguistic_review" && question.proofreader_note && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm" dir="rtl">
                <p className="text-xs font-semibold text-amber-800 mb-1 text-start">הערת מגיה (החזרה למנהל)</p>
                <p className="whitespace-pre-wrap text-start text-amber-900">{question.proofreader_note}</p>
              </div>
            )}
            {canEdit && needsMerge && (
              <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-right" dir="rtl">
                <p className="text-sm font-semibold text-amber-900 mb-1">יש יותר מתשובה אחת לשאלה זו</p>
                <p className="text-xs text-amber-800 mb-3">נא לבצע מיזוג לפני עריכה לשונית ויצירת PDF. המיזוג מאחד את כל התשובות לתשובה אחת שתופיע בעורך.</p>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-amber-600 text-white hover:bg-amber-700"
                  onClick={() => onMerge?.(question.id)}
                  disabled={mergePending}
                >
                  {mergePending ? "ממזג…" : "מיזוג תשובות"}
                </Button>
              </div>
            )}
            <div dir="rtl">
              <p className="text-xs font-medium text-secondary mb-1 text-start">תשובה (לעריכה לשונית)</p>
              {canEdit ? (
                <>
                  {needsMerge ? (
                    <p className="text-sm text-slate-500 py-2">לאחר מיזוג התשובות תופיע כאן התשובה המאוחדת לעריכה.</p>
                  ) : (
                    <>
                      <div className="rounded-xl border border-card-border bg-slate-50 p-3 text-sm">
                        <RichTextEditor
                          key={question.id}
                          value={responseText}
                          onChange={(v) => { setResponseText(v); setSaveError(null); }}
                          placeholder="ערוך כאן את התשובה."
                          disabled={savePending}
                          className="w-full"
                        />
                      </div>
                      {saveError && (
                        <p className="mt-1 text-sm text-red-600" role="alert">{saveError}</p>
                      )}
                      {onSaveResponse && (
                        <div className="mt-4 space-y-1" dir="rtl">
                          <p className="text-xs font-medium text-secondary text-start">
                            חתימה (ל-PDF, מיושרת לשמאל) — ניתן להדגיש בולד
                          </p>
                          <SignatureRichField
                            key={`${question.id}-sig`}
                            value={signatureText}
                            onChange={(html) => {
                              setSignatureText(html);
                              setSaveError(null);
                            }}
                            placeholder="שם, תפקיד וכו׳ — יוצג בתחתית גוף התשובה ב-PDF, מיושר לשמאל."
                            disabled={savePending}
                            className="w-full"
                          />
                        </div>
                      )}
                      <div className="mt-2 flex flex-col items-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                          onClick={handleSaveResponse}
                          disabled={
                            savePending ||
                            (responseText.trim() === initialResponse.trim() &&
                              sanitizeSignatureHtml(signatureText).trim() ===
                                sanitizeSignatureHtml(initialSignature).trim())
                          }
                        >
                          {savePending ? "שומר…" : "שמור שינויים"}
                        </Button>
                        <p className="max-w-full text-xs text-slate-500 text-start">
                          שומר את גוף התשובה (למעלה) ואת החתימה — בפעולה אחת.
                        </p>
                      </div>
                    </>
                  )}
                </>
              ) : (
                (question.response_text == null || question.response_text === "") ? (
                  <p className="text-secondary text-sm">—</p>
                ) : (
                  <div className="min-h-[2.5rem] max-h-[12rem] overflow-y-auto rounded-xl border border-card-border bg-slate-50 p-3 text-sm">
                    <ResponseTextView value={question.response_text} />
                  </div>
                )
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-card-border bg-slate-50/60 p-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">סטטוס</p>
                <p className="font-medium text-primary">
                  {STAGE_LABELS[question.stage]}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">תאריך יצירה</p>
                <p className="font-medium text-primary">
                  {formatDate(question.created_at)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  {question.asker_gender === "F" ? "גיל השואלת" : "גיל השואל"}
                </p>
                <p className="font-medium text-primary">
                  {question.asker_age ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">מגדר</p>
                <p className="font-medium text-primary">
                  {question.asker_gender
                    ? GENDER_LABEL[question.asker_gender] ?? "—"
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">מסלול נבחר</p>
                <p className="font-medium text-primary">
                  {question.response_type
                    ? RESPONSE_LABEL[question.response_type] ?? "—"
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">נושא / תת־נושא (להגהה)</p>
                <p className="font-medium text-primary">
                  {(question.topic_name_he || question.sub_topic_name_he)
                    ? [question.topic_name_he, question.sub_topic_name_he]
                        .filter(Boolean)
                        .join(" › ")
                    : "—"}
                </p>
              </div>
            </div>

            {canEdit && versions.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowVersions((v) => !v)}
                  className="flex items-center gap-2 rounded-lg border border-card-border bg-slate-50 px-3 py-2 text-sm font-medium text-primary hover:bg-slate-100"
                >
                  {showVersions ? "הסתר" : "הצג"} היסטוריית עריכה ({versions.length} גרסאות)
                </button>
                {showVersions && (
                  <div className="mt-2 space-y-3">
                    {versions.map((v) => (
                      <div
                        key={v.id}
                        className="rounded-xl border border-card-border bg-slate-50/60 p-3 text-sm"
                      >
                        <p className="text-xs text-slate-500 mb-2">
                          {formatDate(v.created_at)}
                        </p>
                        <ScrollArea className="h-24 rounded border border-card-border bg-white p-2 text-start" dir="rtl">
                          <ResponseTextView value={v.response_text} />
                        </ScrollArea>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showPdfActions && question && (
              <div className="rounded-xl border border-card-border bg-slate-50/60 p-3">
                <p className="text-xs font-medium text-slate-600 mb-2">מסמך PDF</p>
                {needsMerge && (
                  <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-right">
                    <p className="text-xs text-amber-800">יש יותר מתשובה אחת. נא לבצע מיזוג (למעלה) לפני עריכה לשונית ויצירת PDF.</p>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {question.pdf_generated_at && (
                    <p className="text-xs text-red-600 font-medium">
                      נוצר לאחרונה: {formatPdfGeneratedAt(question.pdf_generated_at)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 items-center">
                {question.pdf_url ? (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-2 bg-red-600 text-white hover:bg-red-700"
                      onClick={() => setShowPdfView(true)}
                    >
                      <IconEye className="h-4 w-4 shrink-0" />
                      צפייה
                    </Button>
                    <Button variant="default" size="sm" className="gap-2 bg-red-600 text-white hover:bg-red-700" asChild>
                      <a
                        href={`/api/questions/${question.id}/pdf/download?for=archive&cb=${encodeURIComponent(
                          question.pdf_generated_at ?? String(Date.now())
                        )}`}
                        download
                      >
                        <IconDownload className="h-4 w-4 shrink-0" />
                        הורדה
                      </a>
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-2 bg-red-600 text-white hover:bg-red-700"
                      onClick={handleCreatePdfClick}
                      disabled={pdfPending || needsMerge}
                    >
                      <IconFilePlus className="h-4 w-4 shrink-0" />
                      {pdfPending ? "מייצר…" : "יצירת PDF מחדש"}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2 bg-red-600 text-white hover:bg-red-700"
                    onClick={handleCreatePdfClick}
                    disabled={pdfPending || needsMerge}
                  >
                    <IconFilePlus className="h-4 w-4 shrink-0" />
                    {pdfPending ? "מייצר…" : "יצירת PDF"}
                  </Button>
                )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <PdfViewModal
      open={showPdfView}
      onOpenChange={setShowPdfView}
      questionId={question?.id ?? null}
      forParam="archive"
    />
    </>
  );
}
