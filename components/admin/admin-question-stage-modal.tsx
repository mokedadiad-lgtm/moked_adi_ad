"use client";

import {
  assignQuestion,
  createSubTopic,
  createTopic,
  deleteQuestion,
  getProofreaderTypes,
  getRespondentsWithEligibility,
  getTopicsWithSubTopics,
  updateQuestionStage,
} from "@/app/admin/actions";
import { getAuthHeaders } from "@/lib/supabase/client";
import type { RespondentWithEligibility, TopicOption } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuestionRow, QuestionStage } from "@/lib/types";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/types";
import { PdfViewModal } from "@/components/admin/pdf-view-modal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** צבעי מסגרת וחלון לפי סטטוס (כמו הריבועים בלוח הבקרה) */
const MODAL_FRAME: Record<QuestionStage, { border: string; bg: string; title: string }> = {
  waiting_assignment: { border: "border-pink-500", bg: "bg-pink-50/30", title: "text-pink-600" },
  with_respondent: { border: "border-blue-500", bg: "bg-blue-50/30", title: "text-blue-600" },
  in_proofreading_lobby: { border: "border-violet-500", bg: "bg-violet-50/30", title: "text-violet-600" },
  in_linguistic_review: { border: "border-orange-500", bg: "bg-orange-50/30", title: "text-orange-600" },
  ready_for_sending: { border: "border-emerald-500", bg: "bg-emerald-50/30", title: "text-emerald-600" },
  pending_manager: { border: "border-red-500", bg: "bg-red-50/30", title: "text-red-600" },
  sent_archived: { border: "border-slate-500", bg: "bg-slate-50/30", title: "text-slate-600" },
};

function BellIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

/** צבעי פריטים ברשימת הסטטוס */
const STAGE_ITEM_CLASS: Record<QuestionStage, string> = {
  waiting_assignment: "text-pink-800 focus:bg-pink-100 data-[highlighted]:bg-pink-100",
  with_respondent: "text-blue-800 focus:bg-blue-100 data-[highlighted]:bg-blue-100",
  in_proofreading_lobby: "text-violet-800 focus:bg-violet-100 data-[highlighted]:bg-violet-100",
  in_linguistic_review: "text-orange-800 focus:bg-orange-100 data-[highlighted]:bg-orange-100",
  ready_for_sending: "text-emerald-800 focus:bg-emerald-100 data-[highlighted]:bg-emerald-100",
  pending_manager: "text-red-800 focus:bg-red-100 data-[highlighted]:bg-red-100",
  sent_archived: "text-slate-800 focus:bg-slate-100 data-[highlighted]:bg-slate-100",
};

interface AdminQuestionStageModalProps {
  question: QuestionRow | null;
  topics: TopicOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AdminQuestionStageModal({
  question,
  topics: initialTopics,
  open,
  onOpenChange,
  onSuccess,
}: AdminQuestionStageModalProps) {
  const router = useRouter();
  const [selectedStage, setSelectedStage] = useState<QuestionStage>("waiting_assignment");
  const [stagePending, setStagePending] = useState(false);
  const [topicsList, setTopicsList] = useState<TopicOption[]>(initialTopics);
  const [topicId, setTopicId] = useState("");
  const [subTopicId, setSubTopicId] = useState("");
  const [respondentId, setRespondentId] = useState("");
  const [respondentsWithEligibility, setRespondentsWithEligibility] = useState<RespondentWithEligibility[]>([]);
  const [assignPending, setAssignPending] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [addTopicOpen, setAddTopicOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicTypeId, setNewTopicTypeId] = useState("");
  const [proofreaderTypes, setProofreaderTypes] = useState<{ id: string; name_he: string }[]>([]);
  const [addTopicPending, setAddTopicPending] = useState(false);
  const [addSubTopicOpen, setAddSubTopicOpen] = useState(false);
  const [newSubTopicName, setNewSubTopicName] = useState("");
  const [addSubTopicPending, setAddSubTopicPending] = useState(false);
  const [reminderPending, setReminderPending] = useState<"respondent" | "proofreader" | null>(null);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [changeStatusModalOpen, setChangeStatusModalOpen] = useState(false);
  const [showPdfView, setShowPdfView] = useState(false);
  const [feedback, setFeedback] = useState<{
    title: string;
    message: string;
    tone: "success" | "error";
  } | null>(null);

  const selectedTopic = topicsList.find((t) => t.id === topicId);
  const subTopics = selectedTopic?.sub_topics ?? [];

  useEffect(() => {
    if (question && open) {
      setSelectedStage(question.stage);
      setTopicId(question.topic_id ?? "");
      setSubTopicId(question.sub_topic_id ?? "");
    }
  }, [question?.id, open, question?.stage, question?.topic_id, question?.sub_topic_id]);

  useEffect(() => {
    if (open) setTopicsList(initialTopics);
  }, [open, initialTopics]);

  useEffect(() => {
    if (!open) setChangeStatusModalOpen(false);
  }, [open]);

  const loadEligibility = useCallback(async () => {
    if (!question?.id || !open) return;
    const list = await getRespondentsWithEligibility(question.id, topicId || undefined);
    setRespondentsWithEligibility(list);
  }, [question?.id, open, topicId]);

  useEffect(() => {
    if (open && question?.stage === "waiting_assignment") loadEligibility();
  }, [open, question?.stage, loadEligibility]);

  const sortedRespondents = [...respondentsWithEligibility].sort((a, b) => (a.eligible === b.eligible ? 0 : a.eligible ? -1 : 1));

  const loadProofreaderTypes = async () => {
    const list = await getProofreaderTypes();
    setProofreaderTypes(list);
    if (list.length && !newTopicTypeId) setNewTopicTypeId(list[0].id);
  };

  const handleUpdateStage = async (): Promise<boolean> => {
    if (!question || selectedStage === question.stage) return false;
    setStagePending(true);
    const result = await updateQuestionStage(question.id, selectedStage);
    setStagePending(false);
    if (result.ok) {
      onSuccess?.();
      router.refresh();
      onOpenChange(false);
      return true;
    }
    setFeedback({
      title: "שגיאה בעדכון סטטוס",
      message: result.error ?? "אירעה שגיאה בעדכון הסטטוס.",
      tone: "error",
    });
    return false;
  };

  const handleAddTopic = async () => {
    if (!newTopicName.trim() || !newTopicTypeId) return;
    setAddTopicPending(true);
    setAssignError(null);
    const result = await createTopic({
      name_he: newTopicName.trim(),
      proofreader_type_id: newTopicTypeId,
    });
    setAddTopicPending(false);
    if (result.ok) {
      const updated = await getTopicsWithSubTopics();
      setTopicsList(updated);
      setTopicId(result.id);
      setSubTopicId("");
      setNewTopicName("");
      setAddTopicOpen(false);
      router.refresh();
    } else setAssignError(result.error);
  };

  const handleAddSubTopic = async () => {
    if (!newSubTopicName.trim() || !topicId) return;
    setAddSubTopicPending(true);
    setAssignError(null);
    const result = await createSubTopic({ topic_id: topicId, name_he: newSubTopicName.trim() });
    setAddSubTopicPending(false);
    if (result.ok) {
      const updated = await getTopicsWithSubTopics();
      setTopicsList(updated);
      setSubTopicId(result.id);
      setNewSubTopicName("");
      setAddSubTopicOpen(false);
      router.refresh();
    } else setAssignError(result.error);
  };

  const handleAssign = async () => {
    if (!question || !respondentId) return;
    setAssignPending(true);
    setAssignError(null);
    const result = await assignQuestion(
      question.id,
      respondentId,
      topicId || undefined,
      subTopicId || undefined
    );
    setAssignPending(false);
    if (result.ok) {
      onSuccess?.();
      router.refresh();
      onOpenChange(false);
    } else setAssignError(result.error ?? "שגיאה");
  };

  const handleReminderRespondent = async () => {
    if (!question) return;
    setReminderPending("respondent");
    const res = await fetch("/api/admin/reminder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "respondent", questionId: question.id }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({} as any));
    const result = (data ?? { ok: false, error: "שגיאה בשליחת הבקשה" }) as { ok: boolean; error?: string };
    setReminderPending(null);
    if (result.ok) {
      setFeedback({
        title: "תזכורת נשלחה",
        message: "תזכורת למשיב/ה נשלחה בהצלחה.",
        tone: "success",
      });
      router.refresh();
    } else {
      setFeedback({
        title: "שגיאה בשליחת תזכורת",
        message: result.error ?? "אירעה שגיאה בשליחת התזכורת.",
        tone: "error",
      });
    }
  };

  const handleReminderProofreaders = async () => {
    if (!question) return;
    setReminderPending("proofreader");
    const res = await fetch("/api/admin/reminder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "proofreader", questionId: question.id }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({} as any));
    const result = (data ?? { ok: false, error: "שגיאה בשליחת הבקשה" }) as { ok: boolean; error?: string };
    setReminderPending(null);
    if (result.ok) {
      setFeedback({
        title: "תזכורת נשלחה",
        message: "תזכורת למגיהים נשלחה בהצלחה.",
        tone: "success",
      });
      router.refresh();
    } else {
      setFeedback({
        title: "שגיאה בשליחת תזכורת",
        message: result.error ?? "אירעה שגיאה בשליחת התזכורת.",
        tone: "error",
      });
    }
  };

  const handleSendAndArchive = async () => {
    if (!question) return;
    setSendPending(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/questions/${question.id}/send`, { method: "POST", headers });
      const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFeedback({
            title: "שגיאה בשליחה",
            message: data?.error ?? "אירעה שגיאה בשליחת התשובה.",
            tone: "error",
          });
        } else {
        setSendConfirmOpen(false);
        onSuccess?.();
        router.refresh();
        onOpenChange(false);
      }
    } catch {
        setFeedback({
          title: "שגיאה בחיבור לשרת",
          message: "לא ניתן היה להתחבר לשרת. נא לנסות שוב.",
          tone: "error",
        });
    } finally {
      setSendPending(false);
    }
  };

  const handleDelete = async () => {
    if (!question) return;
    setDeletePending(true);
    const result = await deleteQuestion(question.id);
    setDeletePending(false);
    setDeleteConfirmOpen(false);
    if (result.ok) {
      onSuccess?.();
      onOpenChange(false);
      router.refresh();
    } else {
      setFeedback({
        title: "שגיאה בהעברה לאשפה",
        message: result.error ?? "אירעה שגיאה בהעברת השאלה לאשפה.",
        tone: "error",
      });
    }
  };

  if (!question) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "max-h-[85vh] w-[95vw] max-w-xl border-2 p-0 px-3 sm:pl-6 sm:pr-6 flex flex-col",
            question && (MODAL_FRAME[question.stage].border + " bg-slate-100")
          )}
          dir="rtl"
        >
          <div className="flex max-h-[85vh] flex-col overflow-y-auto overflow-x-hidden">
          {/* כותרת: ID בלבד (גוון לפי סטטוס) — רקע מקצה לקצה */}
          <DialogHeader className="shrink-0 border-b border-slate-200/80 px-2 py-2 sm:ps-4 sm:pe-3">
            <DialogTitle className={cn("text-right text-base font-semibold", MODAL_FRAME[question.stage].title)}>
              משימה {question.short_id ?? question.id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>

          {/* חלק עליון: כותרת + השאלה (עם גלילה) */}
          <div className="shrink-0 border-b border-slate-200 px-2 py-1.5 sm:ps-4 sm:pe-3">
            {question.title && (
              <p className="mb-1 text-right text-sm font-medium text-slate-700">{question.title}</p>
            )}
            <p className="mb-1 text-right text-xs font-medium text-slate-500">השאלה</p>
            <div className="rounded border border-slate-200 bg-white p-1.5">
              <div className="whitespace-pre-wrap text-right text-xs text-slate-800" dir="rtl">
                {question.content}
              </div>
            </div>
          </div>

          {/* אמצע: תוכן לפי סטטוס */}
            <div className="space-y-3 p-3 px-2 sm:ps-4 sm:pe-3">
              {question.stage === "waiting_assignment" && (
                <div className="space-y-4 text-right">
                  {/* שורה: נושא + הוסף נושא */}
                  <div className="flex flex-row flex-wrap items-end justify-start gap-2 sm:gap-3" dir="rtl">
                    <div className="space-y-1 min-w-0 flex-1">
                      <Label className="block text-right">נושא</Label>
                      <Select
                        value={topicId || "__none__"}
                        onValueChange={(v) => {
                          setTopicId(v === "__none__" ? "" : v);
                          setSubTopicId("");
                          loadEligibility();
                        }}
                      >
                        <SelectTrigger className="w-full min-w-0 sm:min-w-[140px] text-right">
                          <SelectValue placeholder="בחר/י נושא" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">ללא נושא</SelectItem>
                          {topicsList.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name_he}
                              {t.proofreader_type_name_he ? ` (${t.proofreader_type_name_he})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="default" size="sm" className="shrink-0 bg-primary" onClick={() => { setAddTopicOpen(true); loadProofreaderTypes(); }}>
                      הוסף נושא
                    </Button>
                  </div>
                  {/* שורה: תת-נושא + הוסף תת-נושא */}
                  <div className="flex flex-row flex-wrap items-end justify-start gap-2 sm:gap-3" dir="rtl">
                    <div className="space-y-1 min-w-0 flex-1">
                      <Label className="block text-right">תת-נושא</Label>
                      <Select value={subTopicId || "__none__"} onValueChange={(v) => setSubTopicId(v === "__none__" ? "" : v)}>
                        <SelectTrigger className="w-full min-w-0 sm:min-w-[140px] text-right">
                          <SelectValue placeholder="תת-נושא" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">ללא</SelectItem>
                          {subTopics.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name_he}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="default" size="sm" className="shrink-0 bg-primary" onClick={() => setAddSubTopicOpen(true)} disabled={!topicId}>
                      הוסף תת-נושא
                    </Button>
                  </div>
                  {/* בחירת משיב + כפתור אישור באותה שורה, כפתור בגובה השדה */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-end text-right" dir="rtl">
                    <div className="space-y-1 min-w-0 flex-1 w-full sm:w-auto">
                      <Label className="text-right">בחירת משיב/ה</Label>
                      {sortedRespondents.length === 0 ? (
                        <p className="text-sm text-pink-700">אין משיבים במערכת</p>
                      ) : (
                        <Select value={respondentId} onValueChange={setRespondentId}>
                          <SelectTrigger className="h-10 w-full min-w-0 text-right">
                            <SelectValue placeholder="בחר/י משיב/ה" />
                          </SelectTrigger>
                          <SelectContent>
                            {sortedRespondents.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                <span className={cn(r.eligible ? "text-green-700" : "text-red-700")}>
                                  {r.full_name_he || `משיב (${r.id.slice(0, 8)}…)`}
                                  {!r.eligible && r.reason && ` (${r.reason})`}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <Button variant="default" size="sm" className="h-10 w-full sm:w-auto shrink-0 bg-green-600 text-white hover:bg-green-700" onClick={handleAssign} disabled={assignPending || !respondentId || sortedRespondents.length === 0} title="אישור ושליחה למשיב">
                      {assignPending ? "שולח…" : <><span className="sm:hidden">שליחה למשיב</span><span className="hidden sm:inline">אישור ושליחה למשיב</span></>}
                    </Button>
                  </div>
                  {assignError && <p className="text-sm text-red-600">{assignError}</p>}
                </div>
              )}

              {question.stage === "with_respondent" && (
                <div className="space-y-3 text-center">
                  <p className="text-sm font-medium text-slate-700">שם המשיב/ה{"\u200E"}: {question.respondent_name ?? "—"}</p>
                  <div className="flex flex-col items-center gap-2">
                    <Button variant="default" size="sm" className="bg-primary" asChild title="גישה לשאלה">
                      <Link href={`/respondent?open=${question.id}`}>גישה לשאלה</Link>
                    </Button>
                    <Button variant="default" size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={handleReminderRespondent} disabled={reminderPending !== null} title="שליחת תזכורת למשיב">
                      <BellIcon className="me-1.5 size-4 shrink-0" />
                      {reminderPending === "respondent" ? "שולח…" : <><span className="sm:hidden">תזכורת</span><span className="hidden sm:inline">שליחת תזכורת למשיב</span></>}
                    </Button>
                  </div>
                </div>
              )}

              {question.stage === "in_proofreading_lobby" && (
                <div className="space-y-3 text-center">
                  <p className="text-sm font-medium text-slate-700">שם המגיה/ה{"\u200E"}: {question.proofreader_name ?? "—"}</p>
                  <div className="flex flex-col items-center gap-2">
                    <Button variant="default" size="sm" className="bg-primary" asChild title="גישה לשאלה">
                      <Link href={`/proofreader?open=${question.id}`}>גישה לשאלה</Link>
                    </Button>
                    <Button variant="default" size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={handleReminderProofreaders} disabled={reminderPending !== null} title="שליחת תזכורת למגיהים">
                      <BellIcon className="me-1.5 size-4 shrink-0" />
                      {reminderPending === "proofreader" ? "שולח…" : <><span className="sm:hidden">תזכורת</span><span className="hidden sm:inline">שליחת תזכורת למגיהים</span></>}
                    </Button>
                  </div>
                </div>
              )}

              {question.stage === "in_linguistic_review" && (
                <div className="flex justify-center text-right">
                  <Button variant="default" size="sm" className="bg-primary" asChild title="גישה לשאלה">
                    <Link href={`/admin/linguistic?open=${question.id}`}>גישה לשאלה</Link>
                  </Button>
                </div>
              )}

              {question.stage === "pending_manager" && (
                <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/50 p-4 text-right" dir="rtl">
                  <p className="text-sm font-semibold text-red-800">בהמתנה אצל מנהל המערכת</p>
                  {question.proofreader_note?.trim() ? (
                    <>
                      <p className="text-xs font-medium text-slate-600">הערת המגיה/ה<span dir="ltr">:</span></p>
                      <p className="whitespace-pre-wrap text-sm text-slate-800">{question.proofreader_note}</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-600">המגיה/ה החזיר/ה את השאלה למנהל ללא הערה<span dir="ltr">.</span></p>
                  )}
                  <p className="text-xs text-slate-500">ניתן להחליף סטטוס בתחתית החלון (למשל להעברת השאלה לעריכה לשונית)<span dir="ltr">.</span></p>
                </div>
              )}

              {question.stage === "ready_for_sending" && (
                <div className="flex flex-wrap justify-center gap-2 text-right">
                  {question.pdf_url ? (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-primary"
                        onClick={() => setShowPdfView(true)}
                        title="צפייה במסמך PDF"
                      >
                        צפייה ב-PDF
                      </Button>
                      <Button variant="default" size="sm" className="bg-primary" onClick={() => setSendConfirmOpen(true)} disabled={sendPending} title="אישור ושליחה לשואל וארכוב">
                        {sendPending ? "שולח…" : "אישור ושליחה"}
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-amber-700">יש ליצור PDF קודם (מעמוד עריכה לשונית)</p>
                  )}
                </div>
              )}

              {question.stage === "sent_archived" && (
                <p className="text-right text-sm text-slate-600">השאלה נשלחה ואורכבה{"\u200E"}.</p>
              )}
            </div>

          {/* תחתית: במובייל — כפתור "להחלפת הסטטוס" + פח; במסך גדול — בחירה + עדכן + פח */}
          <DialogFooter className="shrink-0 flex flex-row flex-wrap gap-2 border-t border-slate-200 ps-2 pe-2 py-2 sm:flex-nowrap sm:items-center sm:justify-between sm:ps-4 sm:pe-3">
            {/* מובייל: כפתור לפתיחת חלון החלפת סטטוס */}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 min-w-0 sm:hidden border-slate-300"
              onClick={() => setChangeStatusModalOpen(true)}
            >
              להחלפת הסטטוס
            </Button>
            {/* דסקטופ: שדה + בחירה + עדכן סטטוס */}
            <div className="hidden flex-col gap-2 sm:flex sm:flex-row sm:flex-1 sm:flex-nowrap sm:items-center">
              <Label className="shrink-0 text-right text-xs text-slate-600">החלפת סטטוס</Label>
              <Select value={selectedStage} onValueChange={(v) => setSelectedStage(v as QuestionStage)}>
                <SelectTrigger className="min-w-0 w-full sm:min-w-[160px] text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_ORDER.map((s) => (
                    <SelectItem key={s} value={s} className={cn("text-right", STAGE_ITEM_CLASS[s])}>
                      {STAGE_LABELS[s]}
                      {s === question.stage && " (נוכחי)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="default"
                className="bg-primary shrink-0 w-full sm:w-auto"
                onClick={() => handleUpdateStage()}
                disabled={stagePending || selectedStage === question.stage}
              >
                {stagePending ? "מעדכן…" : "עדכן סטטוס"}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label="השלך לאשפה"
              title="השלך לאשפה"
            >
              <TrashIcon className="size-5" />
            </button>
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* חלון משוב קטן, מעוצב בסגנון המערכת ובמרכז המסך */}
      <Dialog open={!!feedback} onOpenChange={(next) => !next && setFeedback(null)}>
        <DialogContent
          className="max-w-sm rounded-2xl border border-card-border bg-card px-5 py-4 text-right shadow-soft"
          dir="rtl"
        >
          <DialogHeader className="pb-1 text-center">
            <DialogTitle
              className={cn(
                "text-base font-semibold text-center",
                feedback?.tone === "success" ? "text-emerald-700" : "text-red-700"
              )}
            >
              {feedback?.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-secondary text-center">{feedback?.message}</p>
          <DialogFooter className="mt-4 flex w-full justify-center">
            <Button
              type="button"
              size="sm"
              onClick={() => setFeedback(null)}
              className="bg-emerald-600 text-white hover:bg-emerald-700 mx-auto"
            >
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* חלון הוספת נושא (עם קטגוריה = סוג הגהה) */}
      <Dialog open={addTopicOpen} onOpenChange={setAddTopicOpen}>
        <DialogContent className="max-w-sm bg-slate-100 text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוסף נושא</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-right">שם הנושא</Label>
              <Input value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} placeholder="שם הנושא" className="text-right" />
            </div>
            <div className="space-y-1">
              <Label className="text-right">קטגוריה (סוג הגהה רלוונטי)</Label>
              <Select value={newTopicTypeId} onValueChange={setNewTopicTypeId}>
                <SelectTrigger className="w-full text-right">
                  <SelectValue placeholder="בחר/י סוג" />
                </SelectTrigger>
                <SelectContent>
                  {proofreaderTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>{pt.name_he}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => setAddTopicOpen(false)}>ביטול</Button>
            <Button variant="default" className="bg-primary" onClick={handleAddTopic} disabled={addTopicPending || !newTopicName.trim() || !newTopicTypeId}>
              {addTopicPending ? "שומר…" : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* חלון הוספת תת-נושא */}
      <Dialog open={addSubTopicOpen} onOpenChange={setAddSubTopicOpen}>
        <DialogContent className="max-w-sm bg-slate-100 text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוסף תת-נושא</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-right">שם תת-הנושא</Label>
            <Input value={newSubTopicName} onChange={(e) => setNewSubTopicName(e.target.value)} placeholder="שם תת-נושא" className="text-right" />
          </div>
          <DialogFooter className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => setAddSubTopicOpen(false)}>ביטול</Button>
            <Button variant="default" className="bg-primary" onClick={handleAddSubTopic} disabled={addSubTopicPending || !newSubTopicName.trim()}>
              {addSubTopicPending ? "שומר…" : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* חלון אישור שליחה וארכוב */}
      <Dialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <DialogContent className="max-w-sm bg-slate-100 text-center" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-center">אישור שליחה וארכוב</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 text-center">
            לאשר שליחת התשובה לשואל וארכוב השאלה במערכת?
          </p>
          <DialogFooter className="flex w-full justify-center gap-2 sm:justify-center">
            <Button variant="outline" className="border-red-600 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setSendConfirmOpen(false)}>ביטול</Button>
            <Button variant="default" className="bg-green-600 text-white hover:bg-green-700" onClick={handleSendAndArchive} disabled={sendPending}>
              {sendPending ? "שולח…" : "אישור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* חלון אישור השלכה לאשפה */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm bg-slate-100 text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>השלכה לאשפה</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            להעביר את השאלה לאשפה? ניתן לשחזר ממנה בלשונית אשפה.
          </p>
          <DialogFooter className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>ביטול</Button>
            <Button variant="default" className="bg-red-600 text-white hover:bg-red-700" onClick={handleDelete} disabled={deletePending}>
              {deletePending ? "מעביר…" : "אישור השלכה לאשפה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* חלון החלפת סטטוס (מובייל) */}
      <Dialog open={changeStatusModalOpen} onOpenChange={setChangeStatusModalOpen}>
        <DialogContent className="w-[95vw] max-w-sm bg-slate-100 text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>החלפת סטטוס</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-right text-slate-600">בחר/י סטטוס חדש</Label>
              <Select value={selectedStage} onValueChange={(v) => setSelectedStage(v as QuestionStage)}>
                <SelectTrigger className="w-full text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_ORDER.map((s) => (
                    <SelectItem key={s} value={s} className={cn("text-right", STAGE_ITEM_CLASS[s])}>
                      {STAGE_LABELS[s]}
                      {question && s === question.stage && " (נוכחי)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => setChangeStatusModalOpen(false)}>ביטול</Button>
            <Button
              variant="default"
              className="bg-primary"
              disabled={stagePending || (question && selectedStage === question.stage)}
              onClick={async () => {
                const ok = await handleUpdateStage();
                if (ok) setChangeStatusModalOpen(false);
              }}
            >
              {stagePending ? "מעדכן…" : "עדכן סטטוס"}
            </Button>
          </DialogFooter>
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
