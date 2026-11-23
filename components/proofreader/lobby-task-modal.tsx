"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { RichTextEditor } from "@/components/respondent/rich-text-editor";
import { getRichTextEditorInstanceKey } from "@/lib/rich-editor-instance-key";
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
import { outcomeLabelHe } from "@/lib/dual-proofreaders";
import { useEffect, useRef, useState } from "react";

interface LobbyTaskModalProps {
  question: LobbyQuestion | null;
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionDone: () => void;
  onDraftSaved?: (payload: {
    questionId: string;
    answerId?: string | null;
    responseText: string | null;
  }) => void;
  /** אם true — מגיהה קבועה יכולה לסיים (לא רק מנהל צופה) */
  canComplete?: boolean;
}

export function LobbyTaskModal({
  question,
  userId,
  open,
  onOpenChange,
  onActionDone,
  onDraftSaved,
  canComplete = true,
}: LobbyTaskModalProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [draftSavedToast, setDraftSavedToast] = useState(false);
  const [draftSaveTick, setDraftSaveTick] = useState(0);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
  const [savedAtLeastOnce, setSavedAtLeastOnce] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const alreadyDone = Boolean(question?.my_review);
  const editable = canComplete && !alreadyDone;
  const isDirty = responseText.trim() !== lastSavedSnapshot;
  const otherSlot = question?.dual_progress?.slots.find(
    (s) => s.id && s.id !== userId
  );

  useEffect(() => {
    if (!open || !question) return;
    const t = question.response_text ?? "";
    setResponseText(t);
    setLastSavedSnapshot(t.trim());
    setSavedAtLeastOnce(false);
    setDraftSavedToast(false);
    setError(null);
    setNote("");
    setShowNoteForm(false);
  }, [open, question]);

  useEffect(() => {
    if (showNoteForm && noteRef.current) {
      noteRef.current.focus();
    }
  }, [showNoteForm]);

  useEffect(() => {
    if (!draftSavedToast) return;
    const t = setTimeout(() => setDraftSavedToast(false), 5000);
    return () => clearTimeout(t);
  }, [draftSavedToast, draftSaveTick]);

  const reset = () => {
    setError(null);
    setNote("");
    setShowNoteForm(false);
    setDraftSavedToast(false);
    setLastSavedSnapshot("");
    setSavedAtLeastOnce(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const authHeaders = async () => {
    const supabase = getSupabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;
    if (!token) return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const handleSaveResponse = async () => {
    if (!question || !responseText.trim() || !editable) return;
    setPending(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setPending(false);
      setError("לא מחובר. רענן את העמוד ונסה שוב.");
      return;
    }
    const response = await fetch("/api/proofreader/update", {
      method: "POST",
      headers,
      body: JSON.stringify({
        questionId: question.id,
        answerId: question.answer_id ?? null,
        updates: { response_text: responseText.trim() },
      }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "שגיאה");
      return;
    }
    const snap = responseText.trim();
    setLastSavedSnapshot(snap);
    setSavedAtLeastOnce(true);
    setDraftSavedToast(true);
    setDraftSaveTick((n) => n + 1);
    onDraftSaved?.({
      questionId: question.id,
      answerId: question.answer_id ?? null,
      responseText: snap,
    });
    onActionDone();
  };

  const notifyLinguistic = () => {
    if (!question) return;
    authHeaders().then((headers) => {
      if (!headers) return;
      return fetch("/api/proofreader/notify-linguistic", {
        method: "POST",
        headers,
        body: JSON.stringify({ questionId: question.id }),
      });
    });
  };

  const completeReview = async (outcome: "approved" | "noted") => {
    if (!question || !editable) return;
    if (outcome === "noted" && !note.trim()) {
      setShowNoteForm(true);
      setError("יש לכתוב הערה למנהלת");
      return;
    }
    setPending(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setPending(false);
      setError("לא מחובר. רענן את העמוד ונסה שוב.");
      return;
    }
    const response = await fetch("/api/proofreader/complete-review", {
      method: "POST",
      headers,
      body: JSON.stringify({
        questionId: question.id,
        answerId: question.answer_id ?? null,
        outcome,
        note: note.trim() || null,
        responseText: responseText.trim() || null,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      moved_to_linguistic?: boolean;
    };
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "שגיאה");
      return;
    }
    if (result.moved_to_linguistic) {
      notifyLinguistic();
    }
    onActionDone();
    onOpenChange(false);
  };

  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] w-[95vw] max-w-2xl flex-col gap-0 overflow-hidden p-0 px-0 pt-10 pb-0"
        dir="rtl"
      >
        <DialogHeader className="shrink-0 px-4 sm:px-6">
          <DialogTitle>הגהה משותפת</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 w-full flex-1 overflow-y-auto">
          <div className="space-y-4 px-4 pb-1 text-start sm:px-6">
            <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-sm text-violet-950">
              <p className="font-medium">
                התקדמות הגהה: {question.dual_progress?.completed ?? 0}/2
              </p>
              {otherSlot ? (
                <p className="mt-1 text-xs text-violet-800">
                  {otherSlot.name || "המגיהה השנייה"}:{" "}
                  {otherSlot.review
                    ? `סיימה (${outcomeLabelHe(otherSlot.review.outcome)})`
                    : "טרם סיימה"}
                </p>
              ) : (
                <p className="mt-1 text-xs text-violet-800">
                  טרם הוגדרו שתי המגיהות הקבועות במערכת.
                </p>
              )}
              {otherSlot?.review?.note?.trim() ? (
                <p className="mt-2 whitespace-pre-wrap rounded-lg border border-violet-200 bg-white/80 px-2 py-1.5 text-xs text-slate-800">
                  הערת {otherSlot.name || "המגיהה השנייה"}: {otherSlot.review.note}
                </p>
              ) : null}
              {alreadyDone && question.my_review ? (
                <p className="mt-2 text-xs font-medium text-emerald-800">
                  סיימת את ההגהה שלך ({outcomeLabelHe(question.my_review.outcome)}).
                </p>
              ) : null}
            </div>

            <div>
              {question.title && (
                <p className="mb-1 text-sm font-medium text-slate-800">{question.title}</p>
              )}
              <p className="mb-1 text-xs font-medium text-secondary">תוכן השאלה</p>
              <ScrollArea className="h-48 rounded-xl border border-card-border bg-slate-50 p-3 text-sm text-start">
                <div className="whitespace-pre-wrap" dir="rtl">
                  {question.content}
                </div>
              </ScrollArea>
              <div className="mt-3 flex flex-wrap items-center justify-start gap-4 border-t border-card-border pt-3 text-start text-sm">
                {question.respondent_name?.trim() ? (
                  <span>
                    <span className="text-slate-500">משיב/ה<span dir="ltr">:</span></span>{" "}
                    <span className="text-primary">{question.respondent_name.trim()}</span>
                  </span>
                ) : null}
                {question.asker_gender === "M" || question.asker_gender === "F" ? (
                  <span>
                    <span className="text-slate-500">פונה<span dir="ltr">:</span></span>{" "}
                    <span className="text-primary">
                      {question.asker_gender === "M" ? "בחור" : "בחורה"}
                    </span>
                  </span>
                ) : null}
                {question.asker_age ? (
                  <span>
                    <span className="text-slate-500">גיל<span dir="ltr">:</span></span>{" "}
                    <span className="text-primary">{question.asker_age}</span>
                  </span>
                ) : null}
                {question.response_type ? (
                  <span>
                    <span className="text-slate-500">מסלול<span dir="ltr">:</span></span>{" "}
                    <span className="text-primary">
                      {question.response_type === "short"
                        ? "קצר ולעניין"
                        : question.response_type === "detailed"
                          ? "תשובה מפורטת"
                          : question.response_type}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-secondary">תשובת המשיב/ה</p>
              {editable ? (
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
              ) : (
                <ScrollArea className="h-80 rounded-xl border border-card-border bg-slate-50 p-3 text-sm">
                  <div
                    className="prose prose-sm max-w-none text-start"
                    dangerouslySetInnerHTML={{
                      __html: question.response_text || "—",
                    }}
                  />
                </ScrollArea>
              )}
            </div>

            {showNoteForm && editable && (
              <div>
                <p className="mb-1 text-xs font-medium text-secondary">
                  הערה למנהלת (חובה בנתיב הערה)
                </p>
                <Textarea
                  ref={noteRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
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
          <DialogFooter className="w-full flex-row flex-wrap justify-end gap-2 border-0 p-0 shadow-none sm:justify-end">
            {editable ? (
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
                {!showNoteForm ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowNoteForm(true);
                      setError(null);
                    }}
                    disabled={pending}
                  >
                    הערה למנהלת
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => completeReview("noted")}
                    disabled={pending || !note.trim()}
                  >
                    {pending ? "שולח…" : "שלח הערה וסיים"}
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => completeReview("approved")}
                  disabled={pending}
                >
                  {pending ? "שומר…" : "אשרתי"}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                סגור
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
