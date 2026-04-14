"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type TeamProfileOption = {
  id: string;
  full_name_he: string | null;
  phone: string;
};

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
  מנהל: "bg-rose-100 text-rose-800",
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
  const [teamProfiles, setTeamProfiles] = useState<TeamProfileOption[]>([]);
  const [teamProfileId, setTeamProfileId] = useState<string>("");
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

  /** In anonymous-only view, hide starting a new team conversation (team tab / all still show it). */
  const showTeamConversationStarter = filter !== "anonymous";

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
    void (async () => {
      const payload = await apiJson<{ ok: boolean; profiles: TeamProfileOption[] }>(
        "/api/admin/whatsapp-inbox/team-profiles"
      );
      if (!payload.ok) throw new Error("טעינת אנשי צוות נכשלה");
      setTeamProfiles(payload.profiles);
      if (!teamProfileId && payload.profiles[0]) setTeamProfileId(payload.profiles[0]!.id);
    })().catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!canReply) return;
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

  const onStartTeamConversation = async () => {
    if (!teamProfileId) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await apiJson<{ ok: boolean; error?: string; conversationId?: string }>(
        `/api/admin/whatsapp-inbox/start-team-conversation`,
        {
          method: "POST",
          body: JSON.stringify({ profileId: teamProfileId }),
        }
      );
      if (!payload.ok) {
        setError(payload.error ?? "פתיחת שיחה נכשלה");
        return;
      }
      await refreshConversations("team");
      setFilter("team");
      if (payload.conversationId) {
        setSelectedId(payload.conversationId);
        await loadThread(payload.conversationId);
      }
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
          {showTeamConversationStarter ? (
            <>
              <Select value={teamProfileId} onValueChange={setTeamProfileId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="בחר איש צוות" />
                </SelectTrigger>
                <SelectContent>
                  {teamProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {(p.full_name_he ?? "ללא שם")} · {p.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" onClick={onStartTeamConversation} disabled={busy || !teamProfileId}>
                פתח שיחה יזומה לצוות
              </Button>
            </>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
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
                      onClick={() => setSelectedId(c.id)}
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
                        <span className="text-xs text-slate-500">{formatDateTime(c.last_inbound_at)}</span>
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{c.display_title || c.phone}</div>
                          {c.inbox_kind === "team" ? (
                            <div className="space-y-1">
                              <div className="truncate text-[11px] text-slate-500">{c.phone}</div>
                              {c.role_labels.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {c.role_labels.map((role) => (
                                    <span
                                      key={`${c.id}_${role}`}
                                      className={[
                                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                        TEAM_ROLE_BADGE_STYLES[role] ?? "bg-slate-100 text-slate-700",
                                      ].join(" ")}
                                    >
                                      {role}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {c.unread_count > 0 ? (
                          <span className={["inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold", style.badgeBg, style.badgeText].join(" ")}>
                            {c.unread_count}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">נקראו</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-700">
                {selectedConversation ? (
                  <>
                    שיחה: <span className="font-medium">{selectedConversation.display_title || selectedConversation.phone}</span>
                  </>
                ) : (
                  "בחר/י שיחה"
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onMarkRead} disabled={!selectedId || busy}>
                סמן כנקרא
              </Button>
            </div>

            <div className="h-[360px] rounded-lg border border-card-border bg-slate-50">
              <div ref={threadViewportRef} className="h-full overflow-y-auto p-3">
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
                        <div
                          key={row.key}
                          id={`msg_${m.id}`}
                          className={[
                            "rounded-lg border p-2",
                            m.direction === "inbound"
                              ? "bg-white border-slate-200"
                              : selectedKindStyle
                                ? `${selectedKindStyle.outboundBg} ${selectedKindStyle.outboundBorder}`
                                : "bg-sky-50 border-sky-200",
                          ].join(" ")}
                        >
                          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                            <span>{m.direction === "inbound" ? "נכנס" : "יוצא"}</span>
                            <span>{formatDateTime(m.at)}</span>
                          </div>
                          <div className="whitespace-pre-wrap text-sm">{m.text}</div>
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
                disabled={!canReply}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={onSendReply}
                  disabled={busy || !selectedId || !replyText.trim() || !canReply}
                >
                  שלח תשובה
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

