"use client";

import { getProofreaderTypeIdForQuestion } from "@/app/admin/actions";
import { notifyLobbyNewQuestion } from "@/app/actions/notifications";
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
import { useEffect, useState } from "react";

const RESPONSE_LABEL: Record<string, string> = {
  short: "קצר ולעניין",
  detailed: "תשובה מפורטת",
};

interface AnswerModalProps {
  question: RespondentQuestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AnswerModal({
  question,
  open,
  onOpenChange,
  onSuccess,
}: AnswerModalProps) {
  const [responseText, setResponseText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
   const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    if (open && question) setResponseText(question.response_text ?? "");
  }, [open, question]);

  const reset = () => {
    setResponseText("");
    setError(null);
    setDraftSaved(false);
  };

  const saveDraft = async () => {
    if (!question || !responseText.trim()) return;
    const supabase = getSupabaseBrowser();
    if (question.answer_id) {
      await supabase
        .from("question_answers")
        .update({ response_text: responseText.trim(), updated_at: new Date().toISOString() })
        .eq("id", question.answer_id);
    } else {
      await supabase
        .from("questions")
        .update({ response_text: responseText.trim(), updated_at: new Date().toISOString() })
        .eq("id", question.id);
    }
    setDraftSaved(true);
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
      setError(rpcError.message);
      return;
    }
    const result = data as { ok: boolean; error?: string } | null;
    if (result && !result.ok) {
      setError(result.error ?? "שגיאה בשליחה");
      return;
    }
    setDraftSaved(false);
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
              <div className="whitespace-pre-wrap text-start text-sm text-secondary" dir="rtl">
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
                key={question.id}
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
          {draftSaved && !error && (
            <p className="mt-2 text-sm text-emerald-700">
              הטיוטה נשמרה.
            </p>
          )}
          </div>
        </div>

        <DialogFooter className="shrink-0 px-4 pb-4 pt-2 sm:px-6">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            ביטול
          </Button>
          <Button type="button" variant="outline" onClick={saveDraft} disabled={pending}>
            {pending ? "שומר…" : "שמור טיוטה"}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={pending}>
            {pending ? "שולח…" : "סיים והעבר להגהה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
