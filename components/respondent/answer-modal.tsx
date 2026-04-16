"use client";

import { getProofreaderTypeIdForQuestion } from "@/app/admin/actions";
import { notifyLobbyNewQuestion, reportRespondentFlowErrorToAdmins } from "@/app/actions/notifications";
import type { RespondentQuestion } from "@/components/respondent/respondent-dashboard";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/respondent/rich-text-editor";
import { getRichTextEditorInstanceKey } from "@/lib/rich-editor-instance-key";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

const RESPONSE_LABEL: Record<string, string> = {
  short: "קצר ולעניין",
  detailed: "תשובה מפורטת",
};
const GENERIC_RESPONDENT_ERROR = "אירעה תקלה זמנית. צוות המערכת עודכן.";

interface AnswerModalProps {
  question: RespondentQuestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onDraftSaved?: (payload: { questionId: string; answerId?: string | null; responseText: string }) => void;
}

export function AnswerModal({
  question,
  open,
  onOpenChange,
  onSuccess,
  onDraftSaved,
}: AnswerModalProps) {
  const [responseText, setResponseText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** הודעה קצרה מעל הכפתורים (נראית בלי גלילה), נעלמת אחרי 5 שניות */
  const [draftSavedToast, setDraftSavedToast] = useState(false);
  /** מקפיץ את ה־useEffect של הסתרה אחרי 5 שניות בכל שמירת טיוטה (גם כשכבר מוצגת הודעה) */
  const [draftSaveTick, setDraftSaveTick] = useState(0);
  /** תוכן כפי שנשמר לאחרונה (אחרי שמירה מוצלחת או טעינה מהשרת) */
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
  /** האם בוצעה שמירת טיוטה מוצלחת במסגרת פתיחת המודל (למצב כפתור "הטיוטה נשמרה") */
  const [savedAtLeastOnce, setSavedAtLeastOnce] = useState(false);

  /** רק פתיחת מודל / מעבר לשאלה אחרת — לא כש־response_text מתעדכן אחרי שמירת טיוטה (אותו id) */
  useEffect(() => {
    if (!open || !question) return;
    const t = question.response_text ?? "";
    setResponseText(t);
    setLastSavedSnapshot(t.trim());
    setSavedAtLeastOnce(false);
    setDraftSavedToast(false);
    setError(null);
  }, [open, question?.id, question?.answer_id]);

  useEffect(() => {
    if (!draftSavedToast) return;
    const t = setTimeout(() => setDraftSavedToast(false), 5000);
    return () => clearTimeout(t);
  }, [draftSavedToast, draftSaveTick]);

  const isDirty = useMemo(
    () => responseText.trim() !== lastSavedSnapshot,
    [responseText, lastSavedSnapshot]
  );

  const reset = () => {
    setResponseText("");
    setError(null);
    setDraftSavedToast(false);
    setLastSavedSnapshot("");
    setSavedAtLeastOnce(false);
  };

  const saveDraft = async () => {
    if (!question || !responseText.trim()) return;
    const supabase = getSupabaseBrowser();
    const payload = { response_text: responseText.trim(), updated_at: new Date().toISOString() };
    const { error: saveError } = question.answer_id
      ? await supabase.from("question_answers").update(payload).eq("id", question.answer_id)
      : await supabase.from("questions").update(payload).eq("id", question.id);
    if (saveError) {
      void reportRespondentFlowErrorToAdmins({
        context: "שמירת טיוטה (משיב)",
        questionId: question.id,
        answerId: question.answer_id ?? null,
        technicalDetail: saveError.message,
      });
      setError(GENERIC_RESPONDENT_ERROR);
      return;
    }
    const snap = responseText.trim();
    setLastSavedSnapshot(snap);
    setSavedAtLeastOnce(true);
    setDraftSavedToast(true);
    setDraftSaveTick((n) => n + 1);
    setError(null);
    onDraftSaved?.({ questionId: question.id, answerId: question.answer_id ?? null, responseText: snap });
  };

  const handleOpenChange = async (next: boolean) => {
    if (!next) {
      await saveDraft();
      reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!question) return;
    const trimmed = responseText.replace(/<[^>]*>/g, "").trim();
    if (!trimmed || trimmed.length === 0) {
      setError("נא להזין תשובה.");
      return;
    }
    setPending(true);
    setError(null);
    const proofreaderTypeId = question.proofreader_type_id ?? (await getProofreaderTypeIdForQuestion(question.id));
    const supabase = getSupabaseBrowser();
    const rpcParams: { p_question_id: string; p_response_text: string; p_proofreader_type_id: string | null; p_answer_id?: string } = {
      p_question_id: question.id,
      p_response_text: responseText.trim(),
      p_proofreader_type_id: proofreaderTypeId,
    };
    if (question.answer_id) rpcParams.p_answer_id = question.answer_id;
    const { data, error: rpcError } = await supabase.rpc("submit_respondent_response", rpcParams);

    setPending(false);
    if (rpcError) {
      void reportRespondentFlowErrorToAdmins({
        context: "שליחת תשובה להגהה (RPC)",
        questionId: question.id,
        answerId: question.answer_id ?? null,
        technicalDetail: rpcError.message,
      });
      setError(GENERIC_RESPONDENT_ERROR);
      return;
    }
    const result = data as { ok: boolean; error?: string } | null;
    if (result && !result.ok) {
      void reportRespondentFlowErrorToAdmins({
        context: "שליחת תשובה להגהה (תשובת RPC)",
        questionId: question.id,
        answerId: question.answer_id ?? null,
        technicalDetail: result.error ?? JSON.stringify(result),
      });
      setError(GENERIC_RESPONDENT_ERROR);
      return;
    }
    setDraftSavedToast(false);
    onOpenChange(false);
    onSuccess();
    reset();
    notifyLobbyNewQuestion(question.id).catch(() => {});
    fetch("/api/revalidate", { method: "POST", body: JSON.stringify({ path: "/admin" }) }).catch(() => {});
  };

  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 px-0 pt-10 pb-0"
        dir="rtl"
      >
        <DialogHeader className="shrink-0 px-4 sm:px-6">
          <DialogTitle>כתיבת תשובה</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 w-full flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 px-4 pb-1 sm:px-6">
            {/* שאלה + כל הפרטים ברשימה אחת בצד ימין */}
            <div className="rounded-xl border border-card-border bg-slate-50/80 p-4 text-start">
              {question.title && <p className="mb-2 text-sm font-semibold text-slate-800">{question.title}</p>}
              <p className="mb-3 text-sm font-semibold text-primary">השאלה</p>
              <div
                className="min-h-[10rem] max-h-[20rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-card-border bg-white p-3 text-start text-sm text-secondary"
                dir="rtl"
              >
                {question.content}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-start gap-6 border-t border-card-border pt-3 text-start text-sm">
                {question.asker_age && (
                  <span>
                    <span className="text-slate-500">גיל<span dir="ltr">:</span></span>{" "}
                    <span className="text-primary">{question.asker_age}</span>
                  </span>
                )}
                {question.response_type && (
                  <span>
                    <span className="text-slate-500">מסלול<span dir="ltr">:</span></span>{" "}
                    <span className="text-primary">
                      {RESPONSE_LABEL[question.response_type]}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* שדה תשובה גדול עם עורך עשיר */}
            <div className="flex flex-col gap-2 text-start">
              <p className="text-sm font-semibold text-primary">תשובתך</p>
              <RichTextEditor
                key={getRichTextEditorInstanceKey(question.id, question.answer_id)}
                value={responseText}
                onChange={setResponseText}
                placeholder="כתוב/י כאן את התשובה. אפשר להשתמש במודגש, כותרות והערות שוליים."
                disabled={pending}
                className="w-full"
              />
            </div>

          {error && (
            <p
              className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-4 pb-4 pt-3 sm:px-6">
          {draftSavedToast && !error && (
            <p
              className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-center text-sm font-semibold text-emerald-900 shadow-sm"
              role="status"
              aria-live="polite"
            >
              הטיוטה נשמרה.
            </p>
          )}
        <DialogFooter className="w-full flex-row flex-wrap justify-end sm:justify-end gap-2 border-0 p-0 shadow-none">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            ביטול
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={saveDraft}
            disabled={
              pending ||
              !responseText.trim() ||
              (!isDirty && savedAtLeastOnce)
            }
            className={cn(
              !isDirty &&
                savedAtLeastOnce &&
                "border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-50 hover:text-emerald-900"
            )}
          >
            {pending
              ? "שומר…"
              : !isDirty && savedAtLeastOnce
                ? "הטיוטה נשמרה"
                : "שמור טיוטה"}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={pending}>
            {pending ? "שולח…" : "סיים והעבר להגהה"}
          </Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
