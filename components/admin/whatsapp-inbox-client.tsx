"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getQuestionIntakeDraftDetails,
  getWaitingQuestionIntakeDrafts,
  updateQuestionIntakeDraft,
  approveQuestionIntakeDraft,
  discardQuestionIntakeDraft,
  type DraftStatus,
  type QuestionIntakeDraftItem,
  type QuestionIntakeDraftDetails,
} from "@/app/admin/actions";
import { ASKER_AGE_RANGE_LABELS } from "@/lib/asker-age-ranges";

const GENDER_LABEL: Record<string, string> = { M: "זכר", F: "נקבה" };
const RESPONSE_LABEL: Record<string, string> = { short: "קצר ולעניין", detailed: "מורחב" };
const PUB_LABEL: Record<string, string> = {
  publish: "אפשר לפרסם",
  blur: "פרסום בטשטוש",
  none: "ללא פרסום",
};
const DELIVERY_LABEL: Record<string, string> = {
  whatsapp: "וואטסאפ",
  email: "אימייל",
  both: "גם וואטסאפ וגם אימייל",
};

function ageSelectValue(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  if ((ASKER_AGE_RANGE_LABELS as readonly string[]).includes(v)) return v;
  // legacy numeric ages saved before ranges rollout
  if (/^\d{1,3}$/.test(v)) return v;
  return "";
}

function ageSelectLabel(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  if ((ASKER_AGE_RANGE_LABELS as readonly string[]).includes(v)) return `טווח ${v}`;
  if (/^\d{1,3}$/.test(v)) return `גיל (ישן): ${v}`;
  return v;
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function pickInitialDraftId(
  list: QuestionIntakeDraftItem[],
  preferredId: string | null | undefined
): string | null {
  if (preferredId && list.some((d) => d.id === preferredId)) return preferredId;
  return list[0]?.id ?? null;
}

export function WhatsappInboxClient({
  initialDrafts,
  initialSelectedDraftId = null,
}: {
  initialDrafts: QuestionIntakeDraftItem[];
  initialSelectedDraftId?: string | null;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<QuestionIntakeDraftItem[]>(initialDrafts);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    pickInitialDraftId(initialDrafts, initialSelectedDraftId)
  );
  const [mobileView, setMobileView] = useState<"list" | "details">("list");
  const [details, setDetails] = useState<QuestionIntakeDraftDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvePending, setApprovePending] = useState(false);
  const [discardPending, setDiscardPending] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshList = async () => {
    const list = await getWaitingQuestionIntakeDrafts();
    setDrafts(list);
    setSelectedId((prev) => {
      if (prev && list.some((d) => d.id === prev)) return prev;
      return pickInitialDraftId(list, initialSelectedDraftId);
    });
    if (list.length === 0) setDetails(null);
  };

  useEffect(() => {
    if (!initialSelectedDraftId) return;
    if (drafts.some((d) => d.id === initialSelectedDraftId)) {
      setSelectedId(initialSelectedDraftId);
    }
  }, [initialSelectedDraftId, drafts]);

  const loadDetails = async (id: string) => {
    setLoadingDetails(true);
    setError(null);
    try {
      const d = await getQuestionIntakeDraftDetails(id);
      setDetails(d);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    loadDetails(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Poll list lightly so new inbound messages/drafts appear
  useEffect(() => {
    void refreshList();
    const t = setInterval(() => {
      void refreshList();
      if (selectedId) {
        void loadDetails(selectedId);
      }
    }, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selectedDraftTitle = details?.title ?? details?.content_preview ?? "—";

  const contentValue = details?.content ?? "";

  const openDraft = (id: string) => {
    setSelectedId(id);
    setMobileView("details");
  };

  const handleSave = async () => {
    if (!details) return;
    setSaving(true);
    setError(null);
    try {
      const patch = {
        asker_gender: details.asker_gender,
        asker_age: details.asker_age,
        title: details.title,
        content: details.content,
        response_type: details.response_type,
        publication_consent: details.publication_consent,
        delivery_preference: details.delivery_preference,
        asker_email: details.asker_email,
      };
      const res = await updateQuestionIntakeDraft(details.id, patch);
      if (!res.ok) setError(res.error);
      else await loadDetails(details.id);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!details) return;
    setApprovePending(true);
    setError(null);
    try {
      const res = await approveQuestionIntakeDraft(details.id);
      if (!res.ok) setError(res.error);
      else {
        router.refresh();
      }
    } finally {
      setApprovePending(false);
    }
  };

  const executeDiscard = async () => {
    if (!details) return;
    setDiscardPending(true);
    setError(null);
    try {
      const res = await discardQuestionIntakeDraft(details.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/trash");
    } finally {
      setDiscardPending(false);
    }
  };

  const handleDiscard = () => {
    if (!details || discardPending || saving || approvePending) return;
    setDiscardConfirmOpen(true);
  };

  const updateDetailsField = <K extends keyof QuestionIntakeDraftDetails>(key: K, value: QuestionIntakeDraftDetails[K]) => {
    setDetails((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>דואר נכנס וואטסאפ - טיוטות ממתינות לאישור אדמין</CardTitle>
        </CardHeader>
        <CardContent>
          {drafts.length === 0 ? (
            <p className="text-sm text-slate-600">אין טיוטות שממתינות כעת.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
              <div className={`space-y-2 ${mobileView === "details" ? "hidden md:block" : "block"}`}>
                {drafts.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => openDraft(d.id)}
                    className={`w-full rounded-lg border p-3 text-right transition ${
                      selectedId === d.id ? "border-primary bg-primary/5" : "border-card-border hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs text-slate-500">{formatDateTime(d.created_at)}</div>
                    <div className="mt-1 font-medium">{d.title ?? d.content_preview}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      {d.asker_gender ? `מגדר: ${GENDER_LABEL[d.asker_gender] ?? "—"}` : "—"} · גיל: {d.asker_age ?? "—"}
                    </div>
                  </button>
                ))}
              </div>

              <div className={`space-y-3 ${mobileView === "list" ? "hidden md:block" : "block"}`}>
                {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</div>}

                {!details ? (
                  <p className="text-sm text-slate-600">בחר/י טיוטה מהרשימה.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 md:hidden">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-1 px-2"
                        onClick={() => setMobileView("list")}
                        aria-label="חזרה לרשימת טיוטות"
                      >
                        <span aria-hidden className="text-lg font-bold leading-none">‹</span>
                        <span className="text-xs font-medium">חזרה</span>
                      </Button>
                      <div className="min-w-0 flex-1 text-right">
                        <div className="truncate text-sm font-semibold">{selectedDraftTitle}</div>
                        <div className="truncate text-[11px] text-slate-500">מספר טיוטה: {details.id}</div>
                      </div>
                    </div>
                    <div className="hidden md:block">
                      <div className="text-sm font-medium">{selectedDraftTitle}</div>
                      <div className="text-xs text-slate-500">מספר טיוטה: {details.id}</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">מגדר</p>
                        <Select
                          value={details.asker_gender ?? ""}
                          onValueChange={(v) => updateDetailsField("asker_gender", (v as any) ?? null)}
                          disabled={loadingDetails}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="בחר/י" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="M">זכר</SelectItem>
                            <SelectItem value="F">נקבה</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">גיל</p>
                        <Select
                          value={ageSelectValue(details.asker_age)}
                          onValueChange={(v) => updateDetailsField("asker_age", v ? v : null)}
                          disabled={loadingDetails}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="בחר/י טווח גיל" />
                          </SelectTrigger>
                          <SelectContent>
                            {details.asker_age &&
                              (details.asker_age ?? "").trim() &&
                              !(ASKER_AGE_RANGE_LABELS as readonly string[]).includes((details.asker_age ?? "").trim()) &&
                              /^\d{1,3}$/.test((details.asker_age ?? "").trim()) && (
                                <SelectItem value={(details.asker_age ?? "").trim()}>
                                  {ageSelectLabel(details.asker_age)}
                                </SelectItem>
                              )}
                            {ASKER_AGE_RANGE_LABELS.map((label) => (
                              <SelectItem key={label} value={label}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">מסלול מענה</p>
                        <Select
                          value={details.response_type ?? ""}
                          onValueChange={(v) => updateDetailsField("response_type", v as any)}
                          disabled={loadingDetails}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="בחר/י" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="short">קצר ולעניין</SelectItem>
                            <SelectItem value="detailed">מורחב</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">פרסום</p>
                        <Select
                          value={details.publication_consent ?? ""}
                          onValueChange={(v) => updateDetailsField("publication_consent", v as any)}
                          disabled={loadingDetails}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="בחר/י" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="publish">אפשר לפרסם</SelectItem>
                            <SelectItem value="blur">פרסום בטשטוש</SelectItem>
                            <SelectItem value="none">ללא פרסום</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <p className="text-xs text-slate-500">ערוץ קבלת תשובה</p>
                        <Select
                          value={details.delivery_preference ?? ""}
                          onValueChange={(v) => updateDetailsField("delivery_preference", v as any)}
                          disabled={loadingDetails}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="בחר/י" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whatsapp">וואטסאפ</SelectItem>
                            <SelectItem value="email">אימייל</SelectItem>
                            <SelectItem value="both">גם וואטסאפ וגם אימייל</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <p className="text-xs text-slate-500">כותרת</p>
                        <Input
                          value={details.title ?? ""}
                          onChange={(e) => updateDetailsField("title", e.target.value)}
                          disabled={loadingDetails}
                        />
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <p className="text-xs text-slate-500">תוכן השאלה</p>
                        <Textarea
                          value={contentValue}
                          onChange={(e) => updateDetailsField("content", e.target.value)}
                          disabled={loadingDetails}
                          className="min-h-[140px]"
                        />
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <p className="text-xs text-slate-500">אימייל (אם נמסר)</p>
                        <Input
                          value={details.asker_email ?? ""}
                          onChange={(e) => updateDetailsField("asker_email", e.target.value || null)}
                          disabled={loadingDetails}
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium">הודעות נכנסות מאותו מספר (לצורך עריכה)</p>
                        <p className="text-xs text-slate-500">{details.inbound_messages.length} הודעות</p>
                      </div>
                      <ScrollArea className="h-[180px] rounded-xl border border-card-border bg-slate-50 p-3">
                        {details.inbound_messages.length === 0 ? (
                          <p className="text-sm text-slate-600">אין הודעות נוספות לאחר יצירת הטיוטה.</p>
                        ) : (
                          <div className="space-y-3">
                            {details.inbound_messages.map((m) => (
                              <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-2">
                                <div className="text-xs text-slate-500">{formatDateTime(m.received_at)}</div>
                                <div className="mt-1 text-sm whitespace-pre-wrap">{m.text_body ?? "(הודעה לא טקסטואלית)"}</div>
                                <div className="mt-1 text-[10px] text-slate-400 break-all">{m.provider_message_id}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </div>

                    <div className="mt-6 border-t border-slate-200 pt-4">
                      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-end sm:gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => void handleSave()} disabled={saving}>
                          {saving ? "שומר…" : "שמור"}
                        </Button>
                        <Button type="button" size="sm" onClick={() => void handleApprove()} disabled={approvePending}>
                          {approvePending ? "מאשר…" : "אישור"}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={handleDiscard}
                          disabled={discardPending || saving || approvePending}
                        >
                          {discardPending ? "שולך לאשפה…" : "השלך"}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
        <Dialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>להשליך טיוטה לאשפה?</DialogTitle>
              <DialogDescription>
                הפעולה תעביר את הטיוטה לאשפה. ניתן לשחזר אחר כך מדף האשפה.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDiscardConfirmOpen(false)} disabled={discardPending}>
                ביטול
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setDiscardConfirmOpen(false);
                  void executeDiscard();
                }}
                disabled={discardPending}
              >
                השלך לאשפה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}

