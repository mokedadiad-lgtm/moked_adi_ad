"use client";

import { notifyLinguisticNewQuestion } from "@/app/actions/notifications";
import { RichTextEditor } from "@/components/respondent/rich-text-editor";
import { ResponseTextView } from "@/components/response-text-view";
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
}

export function LobbyTaskModal({
  question,
  userId,
  open,
  onOpenChange,
  onActionDone,
}: LobbyTaskModalProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [showReturnNote, setShowReturnNote] = useState(false);
  const [responseText, setResponseText] = useState("");
  const returnNoteRef = useRef<HTMLTextAreaElement>(null);

  const isMine = question && userId && question.assigned_proofreader_id === userId;
  const initialResponse = question?.response_text ?? "";
  const hasResponseChanges = responseText.trim() !== initialResponse.trim();

  useEffect(() => {
    if (open && question) setResponseText(question.response_text ?? "");
  }, [open, question?.id, question?.response_text]);

  useEffect(() => {
    if (showReturnNote && returnNoteRef.current) {
      returnNoteRef.current.focus();
    }
  }, [showReturnNote]);

  const reset = () => {
    setError(null);
    setReturnNote("");
    setShowReturnNote(false);
  };

  const handleSaveResponse = () => {
    if (!responseText.trim()) return;
    runUpdate({ response_text: responseText.trim() });
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
            <ScrollArea className="h-24 rounded-xl border border-card-border bg-slate-50 p-3 text-sm text-start">
              <div className="whitespace-pre-wrap" dir="rtl">{question.content}</div>
            </ScrollArea>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-secondary">תשובת המשיב/ה</p>
            {isMine ? (
              <>
                <div className="rounded-xl border border-card-border bg-slate-50 p-3 text-sm">
                  <RichTextEditor
                    key={question.id}
                    value={responseText}
                    onChange={setResponseText}
                    placeholder="ערוך כאן את התשובה (כותרות, מודגש, הערות שוליים)."
                    disabled={pending}
                    className="w-full"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="bg-green-600 text-white hover:bg-green-700"
                  onClick={handleSaveResponse}
                  disabled={pending || !hasResponseChanges}
                >
                  {pending ? "שומר…" : "שמור טיוטה"}
                </Button>
              </>
            ) : (
              <ScrollArea className="h-80 rounded-xl border border-card-border bg-slate-50 p-3 text-sm">
                <ResponseTextView value={question.response_text} />
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

        <DialogFooter className="shrink-0 flex-wrap gap-2 px-4 pb-4 pt-2 sm:px-6">
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
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            סגור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
