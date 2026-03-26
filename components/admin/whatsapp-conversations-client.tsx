"use client";

import { useEffect, useMemo, useState } from "react";
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
  unread_count: number;
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
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamProfiles, setTeamProfiles] = useState<TeamProfileOption[]>([]);
  const [teamProfileId, setTeamProfileId] = useState<string>("");

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const selectedKind: InboxKind | null = selectedConversation?.inbox_kind ?? null;
  const selectedKindStyle = selectedKind ? KIND_STYLES[selectedKind] : null;

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

  const loadThread = async (conversationId: string | null) => {
    if (!conversationId) {
      setThread([]);
      return;
    }
    const payload = await apiJson<{ ok: boolean; thread: InboxThreadItem[] }>(
      `/api/admin/whatsapp-inbox/thread?conversationId=${encodeURIComponent(conversationId)}`
    );
    if (!payload.ok) throw new Error("טעינת שיחה נכשלה");
    setThread(payload.thread);
  };

  useEffect(() => {
    void refreshConversations(filter).catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    void loadThread(selectedId).catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const t = setInterval(() => {
      void refreshConversations(filter).catch(() => {});
      if (selectedId) void loadThread(selectedId).catch(() => {});
    }, 7000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedId]);

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
                        <div className="text-sm font-medium">{c.phone}</div>
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
                    שיחה: <span className="font-medium">{selectedConversation.phone}</span>
                  </>
                ) : (
                  "בחר/י שיחה"
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onMarkRead} disabled={!selectedId || busy}>
                סמן כנקרא
              </Button>
            </div>

            <ScrollArea className="h-[280px] rounded-lg border border-card-border bg-slate-50 p-3">
              {thread.length === 0 ? (
                <p className="text-sm text-slate-600">אין הודעות להצגה.</p>
              ) : (
                <div className="space-y-2">
                  {thread.map((m) => (
                    <div
                      key={m.id}
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
                  ))}
                </div>
              )}
            </ScrollArea>

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

