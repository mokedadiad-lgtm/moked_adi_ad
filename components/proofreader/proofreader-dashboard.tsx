"use client";

import { responseToPlainText } from "@/lib/response-text";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { RoleSwitcher, useHasSidebar } from "@/components/role-switcher";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LobbyTaskModal } from "./lobby-task-modal";

export interface LobbyQuestion {
  id: string;
  /** When task is from question_answers */
  answer_id?: string | null;
  title?: string | null;
  content: string;
  response_text: string | null;
  created_at: string;
  assigned_proofreader_id: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function truncateSummary(text: string, maxLen = 100): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
}

export function ProofreaderDashboard() {
  const router = useRouter();
  const hasSidebar = useHasSidebar();
  const [questions, setQuestions] = useState<LobbyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LobbyQuestion | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const openQuestionId = searchParams.get("open");
  const openedFromLink = useRef(false);

  const fetchQuestions = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    let { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      await new Promise((r) => setTimeout(r, 400));
      const { data: { session } } = await supabase.auth.getSession();
      user = session?.user ?? null;
    }
    if (!user) {
      router.replace("/login");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_technical_lead, is_proofreader, proofreader_type_id")
      .eq("id", user.id)
      .single();
    const isAdminOrTechLead = profile?.is_admin === true || profile?.is_technical_lead === true;
    const canLobby = isAdminOrTechLead || (profile?.is_proofreader && profile?.proofreader_type_id);
    if (!canLobby) {
      router.replace("/admin");
      return;
    }
    setUserId(user.id);
    const [qaRes, qRes] = await Promise.all([
      supabase
        .from("question_answers")
        .select("id, question_id, response_text, assigned_proofreader_id, deleted_at, questions(id, title, content, created_at)")
        .eq("stage", "in_proofreading_lobby")
        .order("created_at", { ascending: true }),
      supabase
        .from("questions")
        .select("id, title, content, response_text, created_at, assigned_proofreader_id")
        .eq("stage", "in_proofreading_lobby")
        .order("created_at", { ascending: true }),
    ]);

    const qaRows = (qaRes.data ?? []) as unknown as {
      id: string;
      question_id: string;
      response_text: string | null;
      assigned_proofreader_id: string | null;
      deleted_at?: string | null;
      questions: { id: string; title?: string | null; content: string; created_at: string } | { id: string; title?: string | null; content: string; created_at: string }[] | null;
    }[];
    const activeQa = qaRows.filter((r) => !r.deleted_at);
    const legacyRows = (qRes.data ?? []) as LobbyQuestion[];
    const fromQaIds = new Set(activeQa.map((r) => r.question_id));
    const fromQa: LobbyQuestion[] = activeQa.map((r) => {
      const q = Array.isArray(r.questions) ? r.questions[0] : r.questions;
      return {
        id: q?.id ?? r.question_id,
        answer_id: r.id,
        title: q?.title ?? null,
        content: q?.content ?? "",
        response_text: r.response_text,
        created_at: q?.created_at ?? "",
        assigned_proofreader_id: r.assigned_proofreader_id,
      };
    });
    const legacy = legacyRows.filter((q) => !fromQaIds.has(q.id));
    setQuestions([...fromQa, ...legacy]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // קישור עם ?open=QUESTION_ID — לפתוח ישירות את חלון השאלה
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
    router.replace("/login");
    router.refresh();
  };

  const mine = userId ? questions.filter((q) => q.assigned_proofreader_id === userId) : [];
  const available = questions.filter((q) => !q.assigned_proofreader_id);

  const openModal = (q: LobbyQuestion) => {
    setSelected(q);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelected(null);
  };

  const handleActionDone = () => {
    fetchQuestions();
    fetch("/api/revalidate", { method: "POST", body: JSON.stringify({ path: "/admin" }) }).catch(() => {});
  };

  // אחרי רענון: אם השאלה כבר לא בתור — לסגור מודאל; אם עדיין בתור — לעדכן את השאלה (למשל אחרי "תפוס משימה") כדי להציג עריכה
  useEffect(() => {
    if (!selected) return;
    const updated = questions.find((q) => (q.answer_id ? q.answer_id === selected.answer_id : q.id === selected.id));
    if (!updated) {
      setModalOpen(false);
      setSelected(null);
    } else if (updated !== selected) {
      setSelected(updated);
    }
  }, [questions, selected?.id]);

  return (
    <>
      <PageHeader title="לובי הגהה">
        <RoleSwitcher />
        {!hasSidebar && (
          <Button variant="outline" size="sm" onClick={handleLogout}>
            התנתקות
          </Button>
        )}
      </PageHeader>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-8">
        {loading ? (
          <p className="text-start text-secondary">טוען…</p>
        ) : (
          <>
            {mine.length > 0 && (
              <section>
                <h2 className="mb-3 text-start text-sm font-medium text-secondary">המשימות שלי ({mine.length})</h2>
                <ul className="space-y-3">
                  {mine.map((q) => (
                    <li key={q.answer_id ?? q.id}>
                      <Card
                        className="cursor-pointer border-violet-200 bg-violet-50/50 transition-shadow hover:shadow-md"
                        onClick={() => openModal(q)}
                      >
                        <CardContent className="p-4">
                          <p className="text-xs text-secondary">{formatDate(q.created_at)}</p>
                          {q.title && <p className="mt-1 text-sm font-medium text-slate-800">{q.title}</p>}
                          <p className={cn("mt-1 line-clamp-2 text-start text-sm text-primary", q.title && "mt-0.5")}>
                            {truncateSummary(q.content)}
                          </p>
                          {q.response_text && (
                            <p className="mt-2 line-clamp-1 text-start text-xs text-slate-600">
                              תשובה{"\u200E"}: {truncateSummary(responseToPlainText(q.response_text), 80)}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-start text-sm font-medium text-secondary">בתור ({available.length})</h2>
              {available.length === 0 && mine.length === 0 ? (
                <div className="rounded-2xl border border-card-border bg-card p-12 text-start shadow-soft">
                  <p className="text-lg font-medium text-primary">אין משימות בהמתנה</p>
                  <p className="mt-2 text-secondary">משימות חדשות יופיעו כאן כשמשיבים ישלחו תשובות{"\u200E"}.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {available.map((q) => (
                    <li key={q.answer_id ?? q.id}>
                      <Card
                        className="cursor-pointer transition-shadow hover:shadow-md"
                        onClick={() => openModal(q)}
                      >
                        <CardContent className="p-4">
                          <p className="text-xs text-secondary">{formatDate(q.created_at)}</p>
                          {q.title && <p className="mt-1 text-sm font-medium text-slate-800">{q.title}</p>}
                          <p className={cn("mt-1 line-clamp-2 text-start text-sm text-primary", q.title && "mt-0.5")}>
                            {truncateSummary(q.content)}
                          </p>
                          {q.response_text && (
                            <p className="mt-2 line-clamp-1 text-start text-xs text-slate-600">
                              תשובה{"\u200E"}: {truncateSummary(responseToPlainText(q.response_text), 80)}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </li>
                  ))}
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
      />
    </>
  );
}
