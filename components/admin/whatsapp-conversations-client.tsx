"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

type InboxKind = "bot_intake" | "anonymous" | "team";
type InboxFilter = "all" | InboxKind;
type WhatsAppConversationMode = "bot" | "human";

type InboxConversationItem = {
  id: string;
  phone: string;
  mode: WhatsAppConversationMode;
  inbox_kind: InboxKind;
  display_name: string | null;
  role_labels: string[];
  display_title: string;
  unread_count: number;
  unread_anchor_at: string | null;
  is_outside_24h_window: boolean;
  seconds_since_last_inbound: number | null;
  is_opening_template_configured: boolean;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
};

type InboxThreadItem = {
  id: string;
  direction: "inbound" | "outbound";
  at: string;
  text: string;
  message_type: string | null;
  channel_event: string | null;
  status: string | null;
};

type ThreadRenderRow =
  | { kind: "date"; key: string; label: string }
  | { kind: "unread"; key: string; label: string }
  | { kind: "message"; key: string; message: InboxThreadItem };

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
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

function toDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const msgDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((dayStart - msgDayStart) / (24 * 60 * 60 * 1000));
  if (diff === 0) return "היום";
  if (diff === 1) return "אתמול";
  return date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const FILTER_LABEL: Record<InboxFilter, string> = {
  all: "הכל",
  bot_intake: "בוט",
  anonymous: "אנונימי",
  team: "צוות",
};

const KIND_LABEL: Record<InboxKind, string> = {
  bot_intake: "בוט",
  anonymous: "אנונימי",
  team: "צוות",
};

const KIND_STYLES: Record<
  InboxKind,
  {
    dot: string;
    badgeBg: string;
    badgeText: string;
    border: string;
    selectedBg: string;
    selectedBorder: string;
    outboundBg: string;
    outboundBorder: string;
  }
> = {
  bot_intake: {
    dot: "bg-sky-600",
    badgeBg: "bg-sky-100",
    badgeText: "text-sky-800",
    border: "border-sky-200",
    selectedBg: "bg-sky-50/80",
    selectedBorder: "border-sky-300",
    outboundBg: "bg-sky-50",
    outboundBorder: "border-sky-200",
  },
  anonymous: {
    dot: "bg-fuchsia-600",
    badgeBg: "bg-fuchsia-100",
    badgeText: "text-fuchsia-800",
    border: "border-fuchsia-200",
    selectedBg: "bg-fuchsia-50/70",
    selectedBorder: "border-fuchsia-300",
    outboundBg: "bg-fuchsia-50",
    outboundBorder: "border-fuchsia-200",
  },
  team: {
    dot: "bg-emerald-600",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
    border: "border-emerald-200",
    selectedBg: "bg-emerald-50/70",
    selectedBorder: "border-emerald-300",
    outboundBg: "bg-emerald-50",
    outboundBorder: "border-emerald-200",
  },
};

const TEAM_ROLE_BADGE_STYLES: Record<string, string> = {
  "מנהל מערכת": "bg-rose-100 text-rose-800",
  "אחראי טכני": "bg-amber-100 text-amber-800",
  משיב: "bg-blue-100 text-blue-800",
  מגיה: "bg-violet-100 text-violet-800",
  "עורך לשוני": "bg-emerald-100 text-emerald-800",
};

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "content-type": "application/json",
    },
  });
  const data = (await res.json()) as T;
  if (!res.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`);
  return data;
}

export function WhatsappConversationsClient({
  initialConversations,
}: {
  initialConversations: InboxConversationItem[];
}) {
  const [filter, setFilter] = useState<InboxFilter>("all");
  const nonBotInitial = initialConversations.filter((c) => c.inbox_kind !== "bot_intake");
  const [conversations, setConversations] = useState<InboxConversationItem[]>(nonBotInitial);
  const [selectedId, setSelectedId] = useState<string | null>(nonBotInitial[0]?.id ?? null);
  const [thread, setThread] = useState<InboxThreadItem[]>([]);
  const [threadHasMore, setThreadHasMore] = useState(false);
  const [threadNextBeforeAt, setThreadNextBeforeAt] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const threadViewportRef = useRef<HTMLDivElement | null>(null);
  const firstUnreadMessageIdRef = useRef<string | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const selectedKind: InboxKind | null = selectedConversation?.inbox_kind ?? null;
  const selectedKindStyle = selectedKind ? KIND_STYLES[selectedKind] : null;
  const unreadAnchorAt = selectedConversation?.unread_anchor_at ?? null;

  const firstUnreadMessageId = useMemo(() => {
    if (!unreadAnchorAt) return null;
    const hit = thread.find((m) => m.direction === "inbound" && m.at >= unreadAnchorAt);
    return hit?.id ?? null;
  }, [thread, unreadAnchorAt]);

  const threadRows = useMemo<ThreadRenderRow[]>(() => {
    const rows: ThreadRenderRow[] = [];
    let lastDateLabel = "";
    for (const m of thread) {
      const dateLabel = toDateLabel(m.at);
      if (dateLabel !== lastDateLabel) {
        rows.push({ kind: "date", key: `date_${m.id}`, label: dateLabel });
        lastDateLabel = dateLabel;
      }
      if (firstUnreadMessageId && m.id === firstUnreadMessageId) {
        rows.push({ kind: "unread", key: `unread_${m.id}`, label: "הודעות חדשות" });
      }
      rows.push({ kind: "message", key: m.id, message: m });
    }
    return rows;
  }, [thread, firstUnreadMessageId]);

  const canReply =
    selectedConversation?.inbox_kind === "anonymous" || selectedConversation?.inbox_kind === "team";
  const isOutside24h = selectedConversation?.is_outside_24h_window === true;
  const canSendFreeText = canReply && !isOutside24h;

  const refreshConversations = async (nextFilter: InboxFilter = filter) => {
    const payload = await apiJson<{ ok: boolean; conversations: InboxConversationItem[] }>(
      `/api/admin/whatsapp-inbox/conversations?filter=${encodeURIComponent(nextFilter)}`
    );
    if (!payload.ok) throw new Error("טעינת שיחות נכשלה");
    const nonBot = payload.conversations.filter((c) => c.inbox_kind !== "bot_intake");
    setConversations(nonBot);
    if (!nonBot.find((r) => r.id === selectedId)) {
      setSelectedId(nonBot[0]?.id ?? null);
    }
    return nonBot;
  };

  const loadThread = async (conversationId: string | null, opts?: { prepend?: boolean; beforeAt?: string | null }) => {
    if (!conversationId) {
      setThread([]);
      setThreadHasMore(false);
      setThreadNextBeforeAt(null);
      return;
    }
    const params = new URLSearchParams({ conversationId });
    if (opts?.beforeAt) params.set("beforeAt", opts.beforeAt);
    params.set("limit", "60");
    const payload = await apiJson<{ ok: boolean; thread: InboxThreadItem[]; hasMore: boolean; nextBeforeAt: string | null }>(
      `/api/admin/whatsapp-inbox/thread?${params.toString()}`
    );
    if (!payload.ok) throw new Error("טעינת שיחה נכשלה");
    setThread((prev) => (opts?.prepend ? [...payload.thread, ...prev] : payload.thread));
    setThreadHasMore(payload.hasMore);
    setThreadNextBeforeAt(payload.nextBeforeAt);
  };

  useEffect(() => {
    void refreshConversations(filter).catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    setInitialScrollDone(false);
    firstUnreadMessageIdRef.current = null;
    setThreadLoading(true);
    void loadThread(selectedId)
      .catch((e) => setError((e as Error).message))
      .finally(() => setThreadLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const t = setInterval(() => {
      void refreshConversations(filter).catch(() => {});
      if (selectedId) {
        const vp = threadViewportRef.current;
        const nearBottom = !!vp && vp.scrollHeight - (vp.scrollTop + vp.clientHeight) < 72;
        const prevBottomGap = vp ? vp.scrollHeight - vp.scrollTop : 0;
        void loadThread(selectedId)
          .then(() => {
            const cur = threadViewportRef.current;
            if (!cur) return;
            if (nearBottom) {
              cur.scrollTop = cur.scrollHeight;
            } else {
              cur.scrollTop = cur.scrollHeight - prevBottomGap;
            }
          })
          .catch(() => {});
      }
    }, 7000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedId, thread.length]);

  useEffect(() => {
    if (!selectedId) setThread([]);
  }, [selectedId]);

  useEffect(() => {
    if (firstUnreadMessageId) firstUnreadMessageIdRef.current = firstUnreadMessageId;
  }, [firstUnreadMessageId]);

  useEffect(() => {
    if (initialScrollDone || thread.length === 0) return;
    const vp = threadViewportRef.current;
    if (!vp) return;
    const unreadId = firstUnreadMessageIdRef.current;
    if (unreadId) {
      const el = document.getElementById(`msg_${unreadId}`);
      if (el) {
        const top = el.offsetTop - 56;
        vp.scrollTop = Math.max(0, top);
        setInitialScrollDone(true);
        return;
      }
    }
    vp.scrollTop = vp.scrollHeight;
    setInitialScrollDone(true);
  }, [thread, initialScrollDone]);

  const onMarkRead = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await apiJson<{ ok: boolean }>(`/api/admin/whatsapp-inbox/mark-read`, {
        method: "POST",
        body: JSON.stringify({ conversationId: selectedId }),
      });
      if (!payload.ok) setError("סימון כנקרא נכשל");
      await refreshConversations(filter);
    } finally {
      setBusy(false);
    }
  };

  const onSendReply = async () => {
    if (!selectedId) return;
    if (!canSendFreeText) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await apiJson<{ ok: boolean; error?: string }>(`/api/admin/whatsapp-inbox/reply`, {
        method: "POST",
        body: JSON.stringify({ conversationId: selectedId, text: replyText }),
      });
      if (!payload.ok) {
        setError(payload.error ?? "שליחת הודעה נכשלה");
        return;
      }
      setReplyText("");
      await loadThread(selectedId);
      await refreshConversations(filter);
    } finally {
      setBusy(false);
    }
  };

  const onSendOpeningTemplate = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await apiJson<{ ok: boolean; error?: string }>(
        `/api/admin/whatsapp-inbox/send-opening-template`,
        { method: "POST", body: JSON.stringify({ conversationId: selectedId }) }
      );
      if (!payload.ok) {
        setError(payload.error ?? "שליחת הודעת פתיחה נכשלה");
        return;
      }
      await loadThread(selectedId);
      await refreshConversations(filter);
    } finally {
      setBusy(false);
    }
  };

  const onLoadOlder = async () => {
    if (!selectedId || !threadHasMore || !threadNextBeforeAt) return;
    const vp = threadViewportRef.current;
    const prevHeight = vp?.scrollHeight ?? 0;
    setThreadLoading(true);
    try {
      await loadThread(selectedId, { prepend: true, beforeAt: threadNextBeforeAt });
      const cur = threadViewportRef.current;
      if (cur) {
        const newHeight = cur.scrollHeight;
        cur.scrollTop = newHeight - prevHeight + cur.scrollTop;
      }
    } finally {
      setThreadLoading(false);
    }
  };

  const openConversation = async (conversationId: string) => {
    setMobileView("chat");
    setInitialScrollDone(false);
    firstUnreadMessageIdRef.current = null;

    if (selectedId === conversationId) {
      setThreadLoading(true);
      try {
        await loadThread(conversationId);
      } finally {
        setThreadLoading(false);
      }
      return;
    }

    setSelectedId(conversationId);
  };

  const executeClearHistory = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await apiJson<{ ok: boolean; error?: string }>(
        "/api/admin/whatsapp-inbox/clear-history",
        { method: "POST", body: JSON.stringify({ conversationId: selectedId }) }
      );
      if (!payload.ok) {
        setError(payload.error ?? "מחיקת היסטוריה נכשלה");
        return;
      }
      setThread([]);
      await refreshConversations(filter);
      await loadThread(selectedId);
    } finally {
      setBusy(false);
    }
  };

  const onClearHistory = () => {
    if (!selectedId || busy) return;
    setClearConfirmOpen(true);
  };

  const executeDeleteConversation = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const deletingId = selectedId;
      const payload = await apiJson<{ ok: boolean; error?: string }>(
        "/api/admin/whatsapp-inbox/delete-conversation",
        { method: "POST", body: JSON.stringify({ conversationId: deletingId }) }
      );
      if (!payload.ok) {
        setError(payload.error ?? "מחיקת שיחה נכשלה");
        return;
      }
      const next = await refreshConversations(filter);
      const nextId = next[0]?.id ?? null;
      setSelectedId(nextId);
      if (!nextId) {
        setThread([]);
        setMobileView("list");
      }
    } finally {
      setBusy(false);
    }
  };

  const onDeleteConversation = () => {
    if (!selectedId || busy) return;
    setDeleteConfirmOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp Inbox - שיחות (אנונימי / צוות)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-900">{error}</div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {(["all", "anonymous", "team"] as InboxFilter[]).map((f) => (
              <Button
                key={f}
                type="button"
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {FILTER_LABEL[f]}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 overflow-x-hidden md:grid-cols-[320px_1fr]">
          <motion.div
            key={`list_${mobileView}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className={`min-w-0 ${mobileView === "chat" ? "hidden md:block" : "block"}`}
          >
          <div className="relative">
          <ScrollArea className="h-[420px] rounded-lg border border-card-border p-2">
            <div className="space-y-2">
              {conversations.length === 0 ? (
                <p className="text-sm text-slate-600">אין שיחות להצגה.</p>
              ) : (
                conversations.map((c) => {
                  const style = KIND_STYLES[c.inbox_kind];
                  const isSelected = selectedId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => void openConversation(c.id)}
                      className={[
                        "w-full rounded-lg border p-3 text-right transition hover:shadow-sm",
                        isSelected ? "" : "hover:bg-slate-50",
                        isSelected ? `${style.selectedBorder} ${style.selectedBg}` : style.border,
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} aria-hidden />
                          <span className="text-xs font-semibold text-slate-700">{KIND_LABEL[c.inbox_kind]}</span>
                        </div>
                      </div>

                      <div className="mt-1 flex flex-row-reverse items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 text-right">
                          <div dir="ltr" className="flex min-w-0 items-baseline justify-end gap-1">
                            {c.inbox_kind === "team" ? (
                              <span dir="ltr" className="shrink-0 text-[11px] font-normal text-slate-500">({c.phone})</span>
                            ) : null}
                            <span className="truncate text-right text-base font-bold" dir="rtl">
                              {c.inbox_kind === "team" ? (c.display_title || c.phone).split(" · ")[0] : c.display_title || c.phone}
                            </span>
                          </div>
                          {c.inbox_kind === "team" ? (
                            <div className="mt-1 flex items-center gap-2">
                              <span className="shrink-0 text-xs text-slate-500">{formatDateTime(c.last_inbound_at)}</span>
                              <div className="ms-auto flex flex-wrap items-center gap-1">
                                  {c.role_labels.length > 0
                                    ? c.role_labels.map((role) => (
                                        <span
                                          key={`${c.id}_${role}`}
                                          className={[
                                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                            TEAM_ROLE_BADGE_STYLES[role] ?? "bg-slate-100 text-slate-700",
                                          ].join(" ")}
                                        >
                                          {role}
                                        </span>
                                      ))
                                    : null}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">{formatDateTime(c.last_inbound_at)}</div>
                          )}
                        </div>
                        {c.unread_count > 0 ? (
                          <span className={["inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold", style.badgeBg, style.badgeText].join(" ")}>
                            {c.unread_count}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[11px] text-slate-400">נקראו</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
          </div>
          </motion.div>

          <motion.div
            key={`chat_${selectedId ?? "none"}_${mobileView}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className={`min-w-0 space-y-3 ${mobileView === "list" ? "hidden md:block" : "block"}`}
          >
            <div className="space-y-2">
              <div className="w-full text-base font-semibold text-slate-800">
                {selectedConversation ? (
                  <>
                    שיחה: <span className="font-medium">{selectedConversation.display_title || selectedConversation.phone}</span>
                  </>
                ) : (
                  "בחר/י שיחה"
                )}
              </div>
              <div className="flex items-center justify-between md:hidden">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setMobileView("list")}
                  aria-label="חזרה לרשימה"
                >
                  <span aria-hidden className="text-lg font-bold leading-none">‹</span>
                </Button>
                <details className="relative">
                  <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700">
                    <span className="text-lg leading-none">⋮</span>
                  </summary>
                  <div className="absolute left-0 z-20 mt-2 w-44 rounded-md border border-slate-200 bg-white p-2 shadow-md">
                    <div className="grid grid-cols-1 gap-2">
                      {isOutside24h ? (
                        <Button type="button" variant="outline" size="sm" className="justify-start" onClick={onSendOpeningTemplate} disabled={!selectedId || busy}>
                          שלח הודעת פתיחה יזומה
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" size="sm" className="justify-start" onClick={onMarkRead} disabled={!selectedId || busy}>
                        סמן כנקרא
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="justify-start" onClick={onClearHistory} disabled={!selectedId || busy}>
                        נקה היסטוריה
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="justify-start border-red-300 text-red-700 hover:bg-red-50"
                        onClick={onDeleteConversation}
                        disabled={!selectedId || busy}
                      >
                        מחק איש קשר
                      </Button>
                    </div>
                  </div>
                </details>
              </div>
              <div className="hidden items-center gap-2 md:flex">
                {isOutside24h ? (
                  <Button type="button" variant="default" size="sm" className="whitespace-nowrap" onClick={onSendOpeningTemplate} disabled={busy || !selectedId}>
                    שלח הודעת פתיחה יזומה
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" className="whitespace-nowrap" onClick={onMarkRead} disabled={!selectedId || busy}>
                  סמן כנקרא
                </Button>
                <Button type="button" variant="outline" size="sm" className="whitespace-nowrap" onClick={onClearHistory} disabled={!selectedId || busy}>
                  נקה היסטוריה
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="whitespace-nowrap border-red-300 text-red-700 hover:bg-red-50"
                  onClick={onDeleteConversation}
                  disabled={!selectedId || busy}
                >
                  מחק איש קשר
                </Button>
              </div>
            </div>

            <div className="h-[360px] min-w-0 rounded-lg border border-card-border bg-slate-50">
              <div ref={threadViewportRef} className="h-full overflow-x-hidden overflow-y-auto p-3">
                <div className="space-y-2">
                  {threadHasMore ? (
                    <div className="flex justify-center">
                      <Button type="button" variant="outline" size="sm" onClick={onLoadOlder} disabled={threadLoading}>
                        טען הודעות קודמות
                      </Button>
                    </div>
                  ) : null}
                  {thread.length === 0 ? (
                    <p className="text-sm text-slate-600">אין הודעות להצגה.</p>
                  ) : (
                    threadRows.map((row) => {
                      if (row.kind === "date") {
                        return (
                          <div key={row.key} className="flex justify-center py-1">
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-700">{row.label}</span>
                          </div>
                        );
                      }
                      if (row.kind === "unread") {
                        return (
                          <div key={row.key} className="flex items-center gap-2 py-1 text-[11px] text-fuchsia-700">
                            <div className="h-px flex-1 bg-fuchsia-200" />
                            <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 font-semibold">{row.label}</span>
                            <div className="h-px flex-1 bg-fuchsia-200" />
                          </div>
                        );
                      }
                      const m = row.message;
                      return (
                        <div key={row.key} id={`msg_${m.id}`} className={`flex ${m.direction === "inbound" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={[
                              "w-fit max-w-[85%] rounded-lg border p-2",
                              m.direction === "inbound"
                                ? "bg-white border-slate-200"
                                : selectedKindStyle
                                  ? "bg-emerald-50 border-emerald-200"
                                  : "bg-emerald-50 border-emerald-200",
                            ].join(" ")}
                          >
                            <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                              <span>{m.direction === "inbound" ? "נכנס" : "יוצא"}</span>
                              <span>{formatDateTime(m.at)}</span>
                            </div>
                            <div className="whitespace-pre-wrap break-words text-sm">{m.text}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-[90px]"
                placeholder="כתוב/כתבי תשובה לפונה..."
                disabled={!canSendFreeText}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={onSendReply}
                  disabled={busy || !selectedId || !replyText.trim() || !canSendFreeText}
                >
                  שלח תשובה
                </Button>
              </div>
            </div>
          </motion.div>
        </div>

        <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>למחוק היסטוריית שיחה?</DialogTitle>
              <DialogDescription>
                הפעולה תמחק את כל ההודעות בשיחה זו ולא ניתן יהיה לשחזר אותן.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setClearConfirmOpen(false)} disabled={busy}>
                ביטול
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setClearConfirmOpen(false);
                  void executeClearHistory();
                }}
                disabled={busy || !selectedId}
              >
                מחק היסטוריה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>למחוק איש קשר?</DialogTitle>
              <DialogDescription>
                הפעולה תמחק את איש הקשר מהרשימה ואת היסטוריית השיחה, ולא ניתן יהיה לשחזר.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={busy}>
                ביטול
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  void executeDeleteConversation();
                }}
                disabled={busy || !selectedId}
              >
                מחק איש קשר
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

