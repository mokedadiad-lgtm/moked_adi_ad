"use client";

import { ResponseTextView } from "@/components/response-text-view";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoadingFallback } from "@/components/ui/page-loading";
import { PageHeader } from "@/components/page-header";
import { RoleSwitcher, useHasSidebar } from "@/components/role-switcher";
import {
  outcomeLabelHe,
  type DualProofreaderProgress,
  type ProofreaderReviewRow,
} from "@/lib/dual-proofreaders";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { afterModalClose, cn } from "@/lib/utils";
import { LobbyTaskModal } from "./lobby-task-modal";

export interface LobbyQuestion {
  id: string;
  answer_id?: string | null;
  title?: string | null;
  content: string;
  response_text: string | null;
  created_at: string;
  assigned_proofreader_id: string | null;
  asker_age?: string | null;
  asker_gender?: "M" | "F" | null;
  response_type?: "short" | "detailed" | null;
  respondent_name?: string | null;
  my_review?: ProofreaderReviewRow | null;
  dual_progress?: DualProofreaderProgress;
}

const RESPONSE_LABEL: Record<string, string> = {
  short: "קצר ולעניין",
  detailed: "תשובה מפורטת",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function truncateSummary(text: string, maxLen = 100): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
}

function DualProgressBadge({ progress }: { progress?: DualProofreaderProgress }) {
  const done = progress?.completed ?? 0;
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md border text-[10px] font-medium",
        done >= 2
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : done === 1
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-violet-200 bg-violet-50 text-violet-800"
      )}
    >
      הגהה {done}/2
    </Badge>
  );
}

export function ProofreaderDashboard() {
  const router = useRouter();
  const hasSidebar = useHasSidebar();
  const [questions, setQuestions] = useState<LobbyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LobbyQuestion | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDualProofreader, setIsDualProofreader] = useState(false);
  const [showAllForAdmin, setShowAllForAdmin] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const openQuestionId = searchParams.get("open");
  const openedFromLink = useRef(false);

  const fetchQuestions = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    let {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      await new Promise((r) => setTimeout(r, 400));
      const {
        data: { session },
      } = await supabase.auth.getSession();
      user = session?.user ?? null;
    }
    if (!user) {
      router.replace("/login");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_technical_lead, is_proofreader")
      .eq("id", user.id)
      .single();
    const isAdminOrTechLead =
      profile?.is_admin === true || profile?.is_technical_lead === true;

    setUserId(user.id);
    setIsAdmin(isAdminOrTechLead);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;
    if (!token) {
      setQuestions([]);
      setLoading(false);
      return;
    }

    const useAdminAll = isAdminOrTechLead && showAllForAdmin;
    const res = await fetch(
      useAdminAll ? "/api/admin/proofreader-lobby-tasks" : "/api/proofreader/tasks",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      tasks?: LobbyQuestion[];
      dual_config?: {
        proofreader_a_id: string | null;
        proofreader_b_id: string | null;
      };
    };

    if (!data.ok) {
      setAccessError(data.error ?? "אין הרשאה");
      setQuestions([]);
      setIsDualProofreader(false);
      setLoading(false);
      if (!isAdminOrTechLead) {
        // non-dual proofreaders are redirected away from empty lobby
        router.replace("/admin");
      }
      return;
    }

    const dual =
      data.dual_config?.proofreader_a_id === user.id ||
      data.dual_config?.proofreader_b_id === user.id;
    setIsDualProofreader(dual);
    setAccessError(null);
    setQuestions(data.tasks ?? []);
    setLoading(false);
  }, [router, showAllForAdmin]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    if (openedFromLink.current || loading || !openQuestionId || questions.length === 0) return;
    const q = questions.find((x) => x.id === openQuestionId);
    if (q) {
      openedFromLink.current = true;
      setSelected(q);
      setModalOpen(true);
      router.replace("/proofreader", { scroll: false });
    }
  }, [loading, questions, openQuestionId, router]);

  const handleLogout = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  };

  const openModal = (q: LobbyQuestion) => {
    setSelected(q);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setTimeout(() => setSelected(null), 0);
  };

  const handleActionDone = () => {
    fetchQuestions();
    fetch("/api/revalidate", {
      method: "POST",
      body: JSON.stringify({ path: "/admin" }),
    }).catch(() => {});
  };

  const handleDraftSaved = ({
    questionId,
    answerId,
    responseText,
  }: {
    questionId: string;
    answerId?: string | null;
    responseText: string | null;
  }) => {
    setQuestions((prev) =>
      prev.map((q) => {
        const sameAnswer = answerId ? q.answer_id === answerId : false;
        const sameQuestion = q.id === questionId;
        if (!sameAnswer && !sameQuestion) return q;
        return { ...q, response_text: responseText };
      })
    );
    setSelected((prev) => {
      if (!prev) return prev;
      const sameAnswer = answerId ? prev.answer_id === answerId : false;
      const sameQuestion = prev.id === questionId;
      if (!sameAnswer && !sameQuestion) return prev;
      return { ...prev, response_text: responseText };
    });
  };

  useEffect(() => {
    if (!selected) return;
    const updated = questions.find((q) =>
      q.answer_id ? q.answer_id === selected.answer_id : q.id === selected.id
    );
    if (!updated) {
      setModalOpen(false);
      afterModalClose(() => setSelected(null));
    } else if (updated !== selected) {
      setSelected(updated);
    }
  }, [questions, selected?.id, selected]);

  const waitingForMe = userId
    ? questions.filter((q) => !q.my_review)
    : questions;
  const canCompleteSelected =
    Boolean(userId) &&
    isDualProofreader &&
    Boolean(selected) &&
    !selected?.my_review;

  return (
    <>
      <PageHeader title="לובי הגהה">
        <RoleSwitcher />
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={showAllForAdmin ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAllForAdmin(true)}
            >
              כל המשימות
            </Button>
            <Button
              type="button"
              variant={!showAllForAdmin ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAllForAdmin(false)}
            >
              רק המשימות שלי
            </Button>
          </div>
        )}
        {!hasSidebar && (
          <Button variant="outline" size="sm" onClick={handleLogout}>
            התנתקות
          </Button>
        )}
      </PageHeader>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-6">
        {loading ? (
          <PageLoadingFallback
            className="w-full"
            minHeight="min-h-[min(60vh,26rem)]"
          />
        ) : (
          <>
            {accessError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {accessError}
              </div>
            )}

            <section>
              <h2 className="mb-3 text-start text-sm font-medium text-secondary">
                משימות להגהה ({waitingForMe.length})
              </h2>
              {waitingForMe.length === 0 ? (
                <div className="rounded-2xl border border-card-border bg-card p-12 text-start shadow-soft">
                  <p className="text-lg font-medium text-primary">אין משימות בהמתנה</p>
                  <p className="mt-2 text-secondary">
                    משימות חדשות יופיעו כאן כשמשיבים ישלחו תשובות{"\u200E"}.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {waitingForMe.map((q) => {
                    const other = q.dual_progress?.slots.find(
                      (s) => s.id && s.id !== userId
                    );
                    return (
                      <li key={q.answer_id ?? q.id}>
                        <Card
                          className="cursor-pointer transition-shadow hover:shadow-md"
                          onClick={() => openModal(q)}
                        >
                          <CardContent className="p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs text-secondary">
                                {formatDate(q.created_at)}
                              </p>
                              <DualProgressBadge progress={q.dual_progress} />
                            </div>
                            {q.title && (
                              <p className="mt-1 text-sm font-medium text-slate-800">
                                {q.title}
                              </p>
                            )}
                            <p
                              className={cn(
                                "mt-1 line-clamp-2 text-start text-sm text-primary",
                                q.title && "mt-0.5"
                              )}
                            >
                              {truncateSummary(q.content)}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {q.respondent_name?.trim() ? (
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                                  משיב/ה: {q.respondent_name.trim()}
                                </span>
                              ) : null}
                              {q.asker_gender === "M" || q.asker_gender === "F" ? (
                                <span
                                  className={cn(
                                    "rounded-md px-2 py-0.5 text-xs font-medium",
                                    q.asker_gender === "M"
                                      ? "bg-blue-50 text-blue-800"
                                      : "bg-rose-50 text-rose-800"
                                  )}
                                >
                                  {q.asker_gender === "M" ? "בחור" : "בחורה"}
                                </span>
                              ) : null}
                              {q.asker_age ? (
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                  גיל {q.asker_age}
                                </span>
                              ) : null}
                              {q.response_type ? (
                                <span
                                  className={cn(
                                    "rounded-md px-2 py-0.5 text-xs",
                                    q.response_type === "short"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  )}
                                >
                                  {RESPONSE_LABEL[q.response_type] ?? q.response_type}
                                </span>
                              ) : null}
                            </div>
                            {other && (
                              <p className="mt-2 text-[11px] text-slate-500">
                                {other.name || "המגיהה השנייה"}:{" "}
                                {other.review
                                  ? `סיימה (${outcomeLabelHe(other.review.outcome)})`
                                  : "טרם סיימה"}
                              </p>
                            )}
                            {q.response_text && (
                              <div className="mt-2 rounded-xl border border-card-border bg-card px-2 py-1.5">
                                <p className="mb-1 text-[11px] text-slate-500">
                                  תשובה{"\u200E"}:
                                </p>
                                <div className="max-h-20 overflow-hidden">
                                  <ResponseTextView
                                    value={q.response_text}
                                    variant="compact"
                                  />
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <LobbyTaskModal
        question={selected}
        userId={userId}
        open={modalOpen}
        onOpenChange={(open) => !open && closeModal()}
        onActionDone={handleActionDone}
        onDraftSaved={handleDraftSaved}
        canComplete={canCompleteSelected}
      />
    </>
  );
}
