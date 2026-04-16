"use client";

import { notifyLinguisticNewQuestion } from "@/app/actions/notifications";
import { RichTextEditor } from "@/components/respondent/rich-text-editor";
import { ResponseTextView } from "@/components/response-text-view";
import { getRichTextEditorInstanceKey } from "@/lib/rich-editor-instance-key";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { LobbyQuestion } from "@/components/proofreader/proofreader-dashboard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";

interface LobbyTaskModalProps {
  question: LobbyQuestion | null;
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionDone: () => void;
  /** אחרי שמירת response_text — לעדכן מיידית את הרשימה בלי להמתין לרענון רשת */
  onDraftSaved?: (payload: {
    questionId: string;
    answerId?: string | null;
    responseText: string | null;
  }) => void;
}

export function LobbyTaskModal({
  question,
  userId,
  open,
  onOpenChange,
  onActionDone,
  onDraftSaved,
}: LobbyTaskModalProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [showReturnNote, setShowReturnNote] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [draftSavedToast, setDraftSavedToast] = useState(false);
  const [draftSaveTick, setDraftSaveTick] = useState(0);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
  const [savedAtLeastOnce, setSavedAtLeastOnce] = useState(false);
  const returnNoteRef = useRef<HTMLTextAreaElement>(null);

  const isMine = question && userId && question.assigned_proofreader_id === userId;
  const isDirty = responseText.trim() !== lastSavedSnapshot;

  useEffect(() => {
    if (!open || !question) return;
    const t = question.response_text ?? "";
    setResponseText(t);
    setLastSavedSnapshot(t.trim());
    setSavedAtLeastOnce(false);
    setDraftSavedToast(false);
    setError(null);
  }, [open, question?.id, question?.response_text]);

  useEffect(() => {
    if (!open || !question || !isMine) return;
    // When the proofreader claims a task, ensure editor state is hydrated
    // from the latest stored rich HTML (including headings/footnotes).
    setResponseText(question.response_text ?? "");
  }, [open, isMine, question?.answer_id, question?.id, question?.response_text]);

  useEffect(() => {
    if (showReturnNote && returnNoteRef.current) {
      returnNoteRef.current.focus();
    }
  }, [showReturnNote]);

  useEffect(() => {
    if (!draftSavedToast) return;
    const t = setTimeout(() => setDraftSavedToast(false), 5000);
    return () => clearTimeout(t);
  }, [draftSavedToast, draftSaveTick]);

  const reset = () => {
    setError(null);
    setReturnNote("");
    setShowReturnNote(false);
    setDraftSavedToast(false);
    setLastSavedSnapshot("");
    setSavedAtLeastOnce(false);
  };

  const handleSaveResponse = () => {
    if (!responseText.trim()) return;
    runUpdate({ response_text: responseText.trim() }, () => {
      const snap = responseText.trim();
      setLastSavedSnapshot(snap);
      setSavedAtLeastOnce(true);
      setDraftSavedToast(true);
      setDraftSaveTick((n) => n + 1);
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const runUpdate = async (
    updates: Record<string, unknown>,
    onSuccess?: () => void
  ) => {
    if (!question) return;
    setPending(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const payload = { ...updates, updated_at: new Date().toISOString() };
    const { error: e } = question.answer_id
      ? await supabase.from("question_answers").update(payload).eq("id", question.answer_id)
      : await supabase.from("questions").update(payload).eq("id", question.id);
    setPending(false);
    if (e) {
      setError(e.message);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "response_text")) {
      onDraftSaved?.({
        questionId: question.id,
        answerId: question.answer_id ?? null,
        responseText: (updates.response_text as string | null) ?? null,
      });
    }
    onSuccess?.();
    onActionDone();
  };

  const handleClaim = () => runUpdate({ assigned_proofreader_id: userId });

  const handleRelease = () =>
    runUpdate(
      { assigned_proofreader_id: null, response_text: responseText.trim() || null },
      () => onOpenChange(false)
    );

  const notifyLinguistic = () => {
    if (question) {
      notifyLinguisticNewQuestion(question.id).then((r) => {
        if (!r?.ok) console.warn("[עריכה לשונית] שליחת מייל לעורכים:", r?.error ?? "שגיאה");
      }).catch((e) => console.error("[עריכה לשונית] שגיאה בשליחת מייל:", e));
    }
  };

  const handleDoneToLinguistic = () =>
    runUpdate(
      {
        stage: "in_linguistic_review",
        proofreader_note: null,
        response_text: responseText.trim() || null,
      },
      () => {
        notifyLinguistic();
        onOpenChange(false);
      }
    );

  const handleReturnToAdmin = () => {
    if (showReturnNote) {
      runUpdate(
        {
          stage: "pending_manager",
          assigned_proofreader_id: null,
          proofreader_note: returnNote.trim() || null,
          response_text: responseText.trim() || null,
        },
        () => onOpenChange(false)
      );
      return;
    }
    setShowReturnNote(true);
  };

  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] w-[95vw] max-w-2xl flex-col gap-0 overflow-hidden p-0 px-0 pt-10 pb-0"
        dir="rtl"
      >
        <DialogHeader className="shrink-0 px-4 sm:px-6">
          <DialogTitle>{isMine ? "משימה שלי" : "משימה בתור"}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 w-full flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 pb-1 text-start sm:px-6">
          <div>
            {question.title && <p className="mb-1 text-sm font-medium text-slate-800">{question.title}</p>}
            <p className="mb-1 text-xs font-medium text-secondary">תוכן השאלה</p>
            <ScrollArea className="h-48 rounded-xl border border-card-border bg-slate-50 p-3 text-sm text-start">
              <div className="whitespace-pre-wrap" dir="rtl">{question.content}</div>
            </ScrollArea>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-secondary">תשובת המשיב/ה</p>
            {isMine ? (
              <>
                <div className="rounded-xl border border-card-border bg-slate-50 p-3 text-sm">
                  <RichTextEditor
                    key={getRichTextEditorInstanceKey(question.id, question.answer_id)}
                    value={responseText}
                    onChange={setResponseText}
                    placeholder="ערוך כאן את התשובה (כותרות, מודגש, הערות שוליים)."
                    disabled={pending}
                    className="w-full"
                  />
                </div>
              </>
            ) : (
              <ScrollArea className="h-80 rounded-xl border border-card-border bg-slate-50 p-3 text-sm">
                <ResponseTextView value={question.response_text} variant="compact" />
              </ScrollArea>
            )}
          </div>

          {showReturnNote && (
            <div>
              <p className="text-xs font-medium text-secondary mb-1">הערה למנהל (אופציונלי)</p>
              <Textarea
                ref={returnNoteRef}
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                placeholder="למשל: צריך הבהרה לגבי..."
                className="min-h-[80px] text-start"
                disabled={pending}
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
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
          {!isMine ? (
            <Button
              type="button"
              onClick={handleClaim}
              disabled={pending || !userId}
            >
              {pending ? "שומר…" : "תפוס משימה"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveResponse}
                disabled={pending || !responseText.trim() || (!isDirty && savedAtLeastOnce)}
                className={
                  !isDirty && savedAtLeastOnce
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-50 hover:text-emerald-900"
                    : undefined
                }
              >
                {pending
                  ? "שומר…"
                  : !isDirty && savedAtLeastOnce
                    ? "הטיוטה נשמרה"
                    : "שמור טיוטה"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleRelease}
                disabled={pending}
              >
                שחרר (החזר לתור)
              </Button>
              {!showReturnNote ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReturnToAdmin}
                  disabled={pending}
                >
                  החזר למנהל (עם הערה)
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleReturnToAdmin}
                  disabled={pending}
                >
                  {pending ? "שולח…" : "שלח למנהל"}
                </Button>
              )}
              <Button
                type="button"
                onClick={handleDoneToLinguistic}
                disabled={pending}
              >
                {pending ? "שומר…" : "סיים והעבר לעריכה לשונית"}
              </Button>
            </>
          )}
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
