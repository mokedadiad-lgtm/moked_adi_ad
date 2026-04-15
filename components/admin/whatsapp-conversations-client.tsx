"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

type InboxKind = "bot_intake" | "anonymous" | "team";
type InboxFilter = "all" | InboxKind;
type WhatsAppConversationMode = "bot" | "human";

type InboxConversationItem = {
  id: string;
  phone: string;
  formatted_phone: string;
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
  media_type: "image" | "audio" | "document" | "video" | null;
  media_url: string | null;
  mime_type: string | null;
  file_name: string | null;
  caption: string | null;
  channel_event: string | null;
  status: string | null;
};

type ThreadRenderRow =
  | { kind: "date"; key: string; label: string }
  | { kind: "unread"; key: string; label: string }
  | { kind: "message"; key: string; message: InboxThreadItem };

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m21.44 11.05-8.49 8.49a5.5 5.5 0 0 1-7.78-7.78l8.49-8.48a3.5 3.5 0 1 1 4.95 4.95l-8.5 8.49a1.5 1.5 0 0 1-2.12-2.12l8.49-8.48" />
    </svg>
  );
}

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

function ThreadMediaBlock({
  message,
  onOpenImage,
}: {
  message: InboxThreadItem;
  onOpenImage: (messageId: string) => void;
}) {
  if (!message.media_type) return null;
  if (!message.media_url) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        המדיה התקבלה אך לא זמינה כרגע להצגה.
      </div>
    );
  }
  if (message.media_type === "image") {
    return (
      <button
        type="button"
        onClick={() => onOpenImage(message.id)}
        className="block"
      >
        <img
          src={message.media_url}
          alt={message.caption || "תמונה"}
          className="max-h-64 max-w-full rounded-md border border-slate-200 object-contain"
        />
      </button>
    );
  }
  if (message.media_type === "audio") {
    return <audio controls src={message.media_url} className="w-full min-w-[220px]" preload="metadata" />;
  }
  if (message.media_type === "video") {
    return (
      <video controls className="max-h-80 w-full rounded-md border border-slate-200 bg-black">
        <source src={message.media_url} type={message.mime_type || "video/mp4"} />
      </video>
    );
  }
  const isPdf =
    message.mime_type?.toLowerCase() === "application/pdf" ||
    message.file_name?.toLowerCase().endsWith(".pdf");
  return (
    <div className="space-y-2">
      {isPdf ? (
        <iframe
          src={message.media_url}
          title={message.file_name || "מסמך"}
          className="h-64 w-full rounded-md border border-slate-200 bg-white"
        />
      ) : null}
      <a
        href={message.media_url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <span>מסמך</span>
        <span className="truncate">{message.file_name || "קובץ"}</span>
      </a>
    </div>
  );
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
  initialSelectedConversationId = null,
  initialUnreadAnchorAt = null,
}: {
  initialConversations: InboxConversationItem[];
  initialSelectedConversationId?: string | null;
  initialUnreadAnchorAt?: string | null;
}) {
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const nonBotInitial = initialConversations.filter((c) => c.inbox_kind !== "bot_intake");
  const [conversations, setConversations] = useState<InboxConversationItem[]>(nonBotInitial);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (initialSelectedConversationId && nonBotInitial.some((c) => c.id === initialSelectedConversationId)) {
      return initialSelectedConversationId;
    }
    return nonBotInitial[0]?.id ?? null;
  });
  const [thread, setThread] = useState<InboxThreadItem[]>([]);
  const [threadHasMore, setThreadHasMore] = useState(false);
  const [threadNextBeforeAt, setThreadNextBeforeAt] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [mediaKind, setMediaKind] = useState<"image" | "audio" | "document" | "video">("image");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [entryUnreadAnchorAt, setEntryUnreadAnchorAt] = useState<string | null>(
    initialUnreadAnchorAt
  );
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const threadViewportRef = useRef<HTMLDivElement | null>(null);
  const firstUnreadMessageIdRef = useRef<string | null>(null);
  const initialSelectionAppliedRef = useRef(false);
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);

  const lightboxImages = useMemo(
    () =>
      thread
        .filter((m) => m.media_type === "image" && !!m.media_url)
        .map((m) => ({
          id: m.id,
          url: m.media_url as string,
          alt: m.caption || "תמונה",
        })),
    [thread]
  );
  const lightboxImage =
    lightboxIndex != null && lightboxIndex >= 0 && lightboxIndex < lightboxImages.length
      ? lightboxImages[lightboxIndex]
      : null;

  useEffect(() => {
    if (
      !initialSelectionAppliedRef.current &&
      initialSelectedConversationId &&
      conversations.some((c) => c.id === initialSelectedConversationId)
    ) {
      setSelectedId(initialSelectedConversationId);
      setMobileView("chat");
      initialSelectionAppliedRef.current = true;
    }
  }, [initialSelectedConversationId, conversations]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const hay = [
        c.formatted_phone,
        c.display_name ?? "",
        c.display_title ?? "",
        ...c.role_labels,
        KIND_LABEL[c.inbox_kind],
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, searchQuery]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const selectedKind: InboxKind | null = selectedConversation?.inbox_kind ?? null;
  const selectedKindStyle = selectedKind ? KIND_STYLES[selectedKind] : null;
  const unreadAnchorAt =
    selectedConversation?.unread_anchor_at ??
    (selectedConversation?.id === initialSelectedConversationId ? entryUnreadAnchorAt : null);

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

  const markConversationReadSilently = async (conversationId: string) => {
    try {
      const payload = await apiJson<{ ok: boolean }>(`/api/admin/whatsapp-inbox/mark-read`, {
        method: "POST",
        body: JSON.stringify({ conversationId }),
      });
      if (!payload.ok) return;
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0, unread_anchor_at: null } : c))
      );
    } catch {
      // best-effort
    }
  };

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
    if (!selectedId) return;
    if (!filteredConversations.some((c) => c.id === selectedId)) {
      setSelectedId(filteredConversations[0]?.id ?? null);
    }
  }, [filteredConversations, selectedId]);

  useEffect(() => {
    setInitialScrollDone(false);
    firstUnreadMessageIdRef.current = null;
    setThreadLoading(true);
    const currentId = selectedId;
    void loadThread(currentId)
      .catch((e) => setError((e as Error).message))
      .finally(() => {
        setThreadLoading(false);
        if (currentId) void markConversationReadSilently(currentId);
      });
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

  useEffect(() => {
    if (!attachmentMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (attachmentMenuRef.current?.contains(t)) return;
      setAttachmentMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [attachmentMenuOpen]);

  useEffect(() => {
    if (!lightboxImage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxIndex(null);
        return;
      }
      if (e.key === "ArrowRight" && lightboxImages.length > 1) {
        setLightboxIndex((prev) => (prev == null ? 0 : (prev - 1 + lightboxImages.length) % lightboxImages.length));
      }
      if (e.key === "ArrowLeft" && lightboxImages.length > 1) {
        setLightboxIndex((prev) => (prev == null ? 0 : (prev + 1) % lightboxImages.length));
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lightboxImage, lightboxImages.length]);

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
      await markConversationReadSilently(selectedId);
      await loadThread(selectedId);
      await refreshConversations(filter);
    } finally {
      setBusy(false);
    }
  };

  const onSendMedia = async () => {
    if (!selectedId || !canSendFreeText || !mediaFile) return;
    const maxSizeByKind: Record<"image" | "audio" | "document" | "video", number> = {
      image: 10 * 1024 * 1024,
      audio: 16 * 1024 * 1024,
      document: 20 * 1024 * 1024,
      video: 16 * 1024 * 1024,
    };
    if (mediaFile.size > maxSizeByKind[mediaKind]) {
      const maxMb = Math.round(maxSizeByKind[mediaKind] / (1024 * 1024));
      setError(`הקובץ גדול מדי עבור ${mediaKind}. מקסימום ${maxMb}MB.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("conversationId", selectedId);
      form.set("kind", mediaKind);
      form.set("file", mediaFile);
      if (mediaCaption.trim()) form.set("caption", mediaCaption.trim());
      const res = await fetch("/api/admin/whatsapp-inbox/send-media", {
        method: "POST",
        body: form,
      });
      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? "לא הצלחנו לשלוח את הקובץ כרגע. נסו שוב בעוד רגע.");
        return;
      }
      setMediaFile(null);
      setMediaCaption("");
      await markConversationReadSilently(selectedId);
      await loadThread(selectedId);
      await refreshConversations(filter);
    } finally {
      setBusy(false);
    }
  };

  const chooseAttachmentKind = (kind: "image" | "audio" | "document" | "video") => {
    setMediaKind(kind);
    setAttachmentMenuOpen(false);
    setTimeout(() => mediaFileInputRef.current?.click(), 0);
  };

  const mediaAccept =
    mediaKind === "image"
      ? "image/*"
      : mediaKind === "audio"
        ? "audio/*"
        : mediaKind === "video"
          ? "video/*"
          : ".pdf,.doc,.docx,.txt";

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
    // מעבר ידני בין שיחות מנקה עוגן "הודעות חדשות" שהגיע מהפעמון.
    setEntryUnreadAnchorAt(null);
    setMobileView("chat");
    setInitialScrollDone(false);
    firstUnreadMessageIdRef.current = null;

    if (selectedId === conversationId) {
      setThreadLoading(true);
      try {
        await loadThread(conversationId);
        await markConversationReadSilently(conversationId);
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

        <div
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3"
          dir="rtl"
        >
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
          <div className="relative w-full min-w-0 sm:max-w-sm sm:flex-1">
            <span className="pointer-events-none absolute start-2.5 top-1/2 z-[1] -translate-y-1/2 text-slate-400">
              <SearchIcon className="size-4 shrink-0" />
            </span>
            <Input
              type="search"
              placeholder="חיפוש לפי שם, טלפון, תפקיד…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full min-w-0 border-slate-300 bg-white ps-9 text-sm"
              dir="rtl"
              aria-label="חיפוש ברשימת השיחות"
            />
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
                <div
                  className="flex min-h-[280px] w-full flex-col items-center justify-center px-4 py-8 text-center"
                  dir="rtl"
                >
                  <p className="text-sm text-slate-600">אין שיחות להצגה.</p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div
                  className="flex min-h-[280px] w-full flex-col items-center justify-center px-4 py-8 text-center"
                  dir="rtl"
                >
                  <p className="text-sm text-slate-600">אין תוצאות שמתאימות לחיפוש.</p>
                  <p className="mt-1 text-xs text-slate-500">נסו מילה אחרת או נקו את שדה החיפוש.</p>
                </div>
              ) : (
                filteredConversations.map((c) => {
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
                              <span dir="ltr" className="shrink-0 text-[11px] font-normal text-slate-500">({c.formatted_phone})</span>
                            ) : null}
                            <span className="truncate text-right text-base font-bold" dir="rtl">
                              {c.inbox_kind === "team" ? (c.display_title || c.formatted_phone || c.phone).split(" · ")[0] : c.display_title || c.formatted_phone || c.phone}
                            </span>
                          </div>
                          {c.inbox_kind === "team" ? (
                            <div className="mt-1 flex items-center justify-between">
                              <div className="flex flex-wrap items-center gap-1">
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
                              <span className="shrink-0 text-xs text-slate-500">{formatDateTime(c.last_inbound_at)}</span>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">{formatDateTime(c.last_inbound_at)}</div>
                          )}
                        </div>
                        {c.unread_count > 0 ? (
                          <span className={["inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold", style.badgeBg, style.badgeText].join(" ")}>
                            {c.unread_count}
                          </span>
                        ) : null}
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
                    שיחה: <span className="font-medium">{selectedConversation.display_title || selectedConversation.formatted_phone || selectedConversation.phone}</span>
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
                  className="h-8 shrink-0 gap-1 px-2"
                  onClick={() => {
                    setMobileView("list");
                    // יציאה מהצ'אט סוגרת את עוגן "הודעות חדשות" שהגיע מהפעמון.
                    setEntryUnreadAnchorAt(null);
                  }}
                  aria-label="חזרה לרשימה"
                >
                  <span aria-hidden className="text-lg font-bold leading-none">‹</span>
                  <span className="text-xs font-medium">חזרה</span>
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
                    <div
                      className="flex min-h-[200px] w-full flex-col items-center justify-center px-4 py-8 text-center"
                      dir="rtl"
                    >
                      <p className="text-sm text-slate-600">אין הודעות להצגה.</p>
                    </div>
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
                            <div className="space-y-2">
                              <ThreadMediaBlock
                                message={m}
                                onOpenImage={(messageId) => {
                                  const idx = lightboxImages.findIndex((img) => img.id === messageId);
                                  if (idx >= 0) {
                                    setLightboxZoom(1);
                                    setLightboxIndex(idx);
                                  }
                                }}
                              />
                              {m.text ? <div className="whitespace-pre-wrap break-words text-sm">{m.text}</div> : null}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <input
                ref={mediaFileInputRef}
                type="file"
                accept={mediaAccept}
                onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                disabled={!canSendFreeText || busy}
                className="hidden"
              />
              {mediaFile ? (
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <span className="truncate">
                    {mediaKind === "image"
                      ? "תמונה"
                      : mediaKind === "audio"
                        ? "אודיו"
                        : mediaKind === "video"
                          ? "וידאו"
                          : "מסמך"}
                    : {mediaFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaFile(null);
                      setMediaCaption("");
                    }}
                    className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
                    disabled={busy}
                  >
                    הסר
                  </button>
                </div>
              ) : null}
              {mediaFile ? (
                <Input
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                  placeholder="כיתוב לקובץ (אופציונלי)"
                  disabled={!canSendFreeText || busy}
                />
              ) : null}
              <div ref={attachmentMenuRef} className="relative">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="min-h-[70px] pe-14"
                  placeholder="כתוב/כתבי תשובה לפונה..."
                  disabled={!canSendFreeText}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAttachmentMenuOpen((v) => !v)}
                  disabled={busy || !selectedId || !canSendFreeText}
                  aria-label="צרף קובץ"
                  className="absolute end-2 top-2 h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
                >
                  <PaperclipIcon className="h-4 w-4" />
                </Button>
                {attachmentMenuOpen ? (
                  <div className="absolute bottom-11 end-2 z-20 min-w-[150px] rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                    <button type="button" onClick={() => chooseAttachmentKind("image")} className="block w-full rounded px-3 py-2 text-right text-sm hover:bg-slate-50">
                      תמונה
                    </button>
                    <button type="button" onClick={() => chooseAttachmentKind("video")} className="block w-full rounded px-3 py-2 text-right text-sm hover:bg-slate-50">
                      וידאו
                    </button>
                    <button type="button" onClick={() => chooseAttachmentKind("audio")} className="block w-full rounded px-3 py-2 text-right text-sm hover:bg-slate-50">
                      אודיו
                    </button>
                    <button type="button" onClick={() => chooseAttachmentKind("document")} className="block w-full rounded px-3 py-2 text-right text-sm hover:bg-slate-50">
                      מסמך
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="relative flex items-center justify-end gap-2">
                <Button
                  type="button"
                  onClick={mediaFile ? onSendMedia : onSendReply}
                  disabled={
                    busy ||
                    !selectedId ||
                    !canSendFreeText ||
                    (mediaFile ? false : !replyText.trim())
                  }
                >
                  {mediaFile ? "שלח קובץ" : "שלח"}
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

        {lightboxImage ? (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setLightboxIndex(null)}
            role="dialog"
            aria-label="תצוגת תמונה מוגדלת"
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="absolute end-4 top-4 rounded-md bg-white/10 px-3 py-1 text-lg text-white hover:bg-white/20"
              aria-label="סגור"
            >
              ×
            </button>
            {lightboxImages.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxZoom(1);
                    setLightboxIndex((prev) =>
                      prev == null ? 0 : (prev - 1 + lightboxImages.length) % lightboxImages.length
                    );
                  }}
                  className="absolute start-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-white hover:bg-white/20"
                  aria-label="תמונה קודמת"
                >
                  ❮
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxZoom(1);
                    setLightboxIndex((prev) =>
                      prev == null ? 0 : (prev + 1) % lightboxImages.length
                    );
                  }}
                  className="absolute end-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-white hover:bg-white/20"
                  aria-label="תמונה הבאה"
                >
                  ❯
                </button>
              </>
            ) : null}
            <div
              className="max-h-[90vh] max-w-[90vw] overflow-auto"
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                setLightboxZoom((z) => Math.min(4, Math.max(1, z + delta)));
              }}
              onTouchStart={(e) => {
                if (e.touches.length === 1) {
                  swipeStartXRef.current = e.touches[0].clientX;
                  swipeStartYRef.current = e.touches[0].clientY;
                  return;
                }
                if (e.touches.length !== 2) return;
                const t0 = e.touches[0];
                const t1 = e.touches[1];
                const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
                pinchStartDistanceRef.current = dist;
                pinchStartZoomRef.current = lightboxZoom;
              }}
              onTouchMove={(e) => {
                if (e.touches.length !== 2 || pinchStartDistanceRef.current == null) return;
                const t0 = e.touches[0];
                const t1 = e.touches[1];
                const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
                const ratio = dist / pinchStartDistanceRef.current;
                const next = Math.min(4, Math.max(1, pinchStartZoomRef.current * ratio));
                setLightboxZoom(next);
              }}
              onTouchEnd={() => {
                if (pinchStartDistanceRef.current != null) pinchStartDistanceRef.current = null;
                swipeStartXRef.current = null;
                swipeStartYRef.current = null;
              }}
              onTouchCancel={() => {
                if (pinchStartDistanceRef.current != null) pinchStartDistanceRef.current = null;
                swipeStartXRef.current = null;
                swipeStartYRef.current = null;
              }}
              onTouchMoveCapture={(e) => {
                if (e.touches.length !== 1 || lightboxImages.length <= 1 || lightboxZoom > 1.05) return;
                const startX = swipeStartXRef.current;
                const startY = swipeStartYRef.current;
                if (startX == null || startY == null) return;
                const curX = e.touches[0].clientX;
                const curY = e.touches[0].clientY;
                const dx = curX - startX;
                const dy = curY - startY;
                // Horizontal swipe only if dominant over vertical movement.
                if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) {
                  setLightboxZoom(1);
                  if (dx > 0) {
                    setLightboxIndex((prev) =>
                      prev == null ? 0 : (prev - 1 + lightboxImages.length) % lightboxImages.length
                    );
                  } else {
                    setLightboxIndex((prev) =>
                      prev == null ? 0 : (prev + 1) % lightboxImages.length
                    );
                  }
                  swipeStartXRef.current = curX;
                  swipeStartYRef.current = curY;
                }
              }}
            >
              <img
                src={lightboxImage.url}
                alt={lightboxImage.alt}
                className="object-contain"
                style={{
                  maxWidth: "90vw",
                  maxHeight: "90vh",
                  transform: `scale(${lightboxZoom})`,
                  transformOrigin: "center center",
                }}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

