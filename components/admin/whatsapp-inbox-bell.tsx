"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type InboxKind = "bot_intake" | "anonymous" | "team";

type UnreadSummaryItem = {
  conversationId: string;
  inbox_kind: InboxKind;
  phone: string;
  unread_count: number;
  last_inbound_at: string | null;
  last_text_preview: string;
};

type UnreadSummary = {
  ok: boolean;
  totalUnread: number;
  byKind: Record<InboxKind, number>;
  conversationsWithUnread?: number;
  items: UnreadSummaryItem[];
};

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("he-IL", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const KIND_LABEL: Record<InboxKind, string> = {
  bot_intake: "בוט",
  anonymous: "אנונימי",
  team: "צוות",
};

export function WhatsappInboxBell({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverPanelRef = useRef<HTMLDivElement | null>(null);

  const [summary, setSummary] = useState<UnreadSummary | null>(null);
  const [markAllBusy, setMarkAllBusy] = useState(false);
  const totalUnread = summary?.totalUnread ?? 0;

  const fetchSummary = async () => {
    try {
      const res = await fetch("/api/admin/whatsapp-inbox/unread-summary", { cache: "no-store" });
      const data = (await res.json()) as UnreadSummary;
      if (data?.ok) setSummary(data);
    } catch {
      // best-effort
    }
  };

  const markAllRead = async () => {
    if (totalUnread === 0) return;
    setMarkAllBusy(true);
    try {
      const res = await fetch("/api/admin/whatsapp-inbox/mark-all-read", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean };
      if (data?.ok) await fetchSummary();
    } catch {
      // best-effort
    } finally {
      setMarkAllBusy(false);
    }
  };

  useEffect(() => {
    void fetchSummary();
    const t = window.setInterval(() => void fetchSummary(), 12000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!popoverOpen) return;
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (rootRef.current?.contains(t)) return;
      if (popoverPanelRef.current?.contains(t)) return;
      setPopoverOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [popoverOpen]);

  useEffect(() => {
    if (!popoverOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopoverOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [popoverOpen]);

  const badgeLabel = useMemo(() => {
    if (!totalUnread) return "";
    if (totalUnread >= 99) return "99+";
    return String(totalUnread);
  }, [totalUnread]);

  return (
    <>
      <div ref={rootRef} className={["relative inline-block", className ?? ""].join(" ")}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPopoverOpen((open) => {
              const next = !open;
              if (next) void fetchSummary();
              return next;
            });
          }}
          aria-expanded={popoverOpen}
          aria-haspopup="dialog"
          aria-label="דואר נכנס WhatsApp"
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card p-0 shadow-sm text-slate-700 hover:bg-muted/60"
        >
          <BellIcon className="pointer-events-none block h-5 w-5 shrink-0" />
          {badgeLabel ? (
            <span className="absolute -top-1 -end-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">
              {badgeLabel}
            </span>
          ) : null}
        </button>
      </div>

      {popoverOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-start justify-center pt-[max(4.5rem,calc(env(safe-area-inset-top,0px)+3.5rem))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]"
              role="presentation"
            >
              <button
                type="button"
                tabIndex={-1}
                className="absolute inset-0 cursor-default bg-black/10"
                aria-label="סגור"
                onClick={() => setPopoverOpen(false)}
              />
              <div
                ref={popoverPanelRef}
                role="dialog"
                aria-label="תקציר הודעות שלא נקראו"
                className="relative z-10 w-full max-w-[22rem] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-border/60 bg-white p-3 shadow-lg"
              >
                <div className="text-sm font-semibold text-slate-800">דואר נכנס WhatsApp</div>
                <div className="mt-1 text-sm text-secondary">
                  {totalUnread > 0 ? (
                    <>
                      יש <span className="font-semibold text-slate-700">{totalUnread}</span> שיחות עם דואר נכנס שלא נקרא
                      {summary?.conversationsWithUnread != null &&
                      summary.conversationsWithUnread > (summary.items?.length ?? 0) ? (
                        <span className="block text-xs text-slate-500">
                          מוצגות {summary.items?.length ?? 0} מתוך {summary.conversationsWithUnread}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "אין שיחות חדשות"
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {(summary?.items ?? []).length === 0 ? (
                    <div className="rounded-lg border border-border/50 bg-slate-50 p-3 text-sm text-slate-600">
                      אין שיחות עם הודעות שלא נקראו
                    </div>
                  ) : (
                    summary!.items.map((it) => (
                      <button
                        key={it.conversationId}
                        type="button"
                        className="w-full rounded-lg border border-border/50 bg-background p-2.5 text-right transition hover:bg-slate-50"
                        onClick={() => {
                          setPopoverOpen(false);
                          router.push("/admin/whatsapp-inbox");
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-500">{KIND_LABEL[it.inbox_kind]}</span>
                          <span className="text-[11px] text-slate-400">{formatTime(it.last_inbound_at)}</span>
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-900">{it.phone || "—"}</div>
                        <div className="mt-1 line-clamp-3 text-xs leading-snug text-slate-600">{it.last_text_preview}</div>
                      </button>
                    ))
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2 border-t border-border/40 pt-3 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={markAllBusy || totalUnread === 0}
                    onClick={() => void markAllRead()}
                  >
                    {markAllBusy ? "מסמן…" : "סמן הכל כנקרא"}
                  </Button>
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setPopoverOpen(false);
                      router.push("/admin/whatsapp-inbox");
                    }}
                  >
                    מעבר לדואר נכנס
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

