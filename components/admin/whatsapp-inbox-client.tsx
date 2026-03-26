"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function WhatsappInboxClient({ initialDrafts }: { initialDrafts: QuestionIntakeDraftItem[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<QuestionIntakeDraftItem[]>(initialDrafts);
  const [selectedId, setSelectedId] = useState<string | null>(initialDrafts[0]?.id ?? null);
  const [details, setDetails] = useState<QuestionIntakeDraftDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvePending, setApprovePending] = useState(false);
  const [discardPending, setDiscardPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshList = async () => {
    const list = await getWaitingQuestionIntakeDrafts();
    setDrafts(list);
    if (!selectedId && list.length > 0) setSelectedId(list[0]!.id);
  };

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

  const handleDiscard = async () => {
    if (!details) return;
    const ok = window.confirm("להשליך את הטיוטה לאשפה?");
    if (!ok) return;
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
            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
              <div className="space-y-2">
                {drafts.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedId(d.id)}
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

              <div className="space-y-3">
                {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</div>}

                {!details ? (
                  <p className="text-sm text-slate-600">בחר/י טיוטה מהרשימה.</p>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{selectedDraftTitle}</div>
                        <div className="text-xs text-slate-500">מספר טיוטה: {details.id}</div>
                      </div>
                      <div className="flex gap-2">
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
                          onClick={() => void handleDiscard()}
                          disabled={discardPending || saving || approvePending}
                          className="hidden sm:inline-flex"
                        >
                          {discardPending ? "שולך לאשפה…" : "השלך"}
                        </Button>
                      </div>
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
                        <Input
                          type="number"
                          value={details.asker_age ?? ""}
                          onChange={(e) => updateDetailsField("asker_age", e.target.value ? Number(e.target.value) : null)}
                          disabled={loadingDetails}
                        />
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
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

