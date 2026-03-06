"use client";

import { responseToPlainText } from "@/lib/response-text";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LobbyTaskModal } from "./lobby-task-modal";

export interface LobbyQuestion {
  id: string;
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
  const [questions, setQuestions] = useState<LobbyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LobbyQuestion | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

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
      .select("is_admin, is_proofreader, proofreader_type_id")
      .eq("id", user.id)
      .single();
    const isAdmin = profile?.is_admin === true;
    const canLobby = isAdmin || (profile?.is_proofreader && profile?.proofreader_type_id);
    if (!canLobby) {
      router.replace("/admin");
      return;
    }
    setUserId(user.id);
    const { data, error } = await supabase
      .from("questions")
      .select("id, content, response_text, created_at, assigned_proofreader_id")
      .eq("stage", "in_proofreading_lobby")
      .order("created_at", { ascending: true });

    if (error) {
      setQuestions([]);
    } else {
      setQuestions((data ?? []) as LobbyQuestion[]);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

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
  };

  // אחרי רענון: אם השאלה כבר לא בתור — לסגור מודאל; אם עדיין בתור — לעדכן את השאלה (למשל אחרי "תפוס משימה") כדי להציג עריכה
  useEffect(() => {
    if (!selected) return;
    const updated = questions.find((q) => q.id === selected.id);
    if (!updated) {
      setModalOpen(false);
      setSelected(null);
    } else if (updated !== selected) {
      setSelected(updated);
    }
  }, [questions, selected?.id]);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-card-border bg-card py-4 shadow-soft">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4">
          <h1 className="text-start text-xl font-bold text-primary">לובי הגהה</h1>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            התנתקות
          </Button>
        </div>
      </header>

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
                    <li key={q.id}>
                      <Card
                        className="cursor-pointer border-violet-200 bg-violet-50/50 transition-shadow hover:shadow-md"
                        onClick={() => openModal(q)}
                      >
                        <CardContent className="p-4">
                          <p className="text-xs text-secondary">{formatDate(q.created_at)}</p>
                          <p className="mt-1 line-clamp-2 text-start text-sm text-primary">
                            {truncateSummary(q.content)}
                          </p>
                          {q.response_text && (
                            <p className="mt-2 line-clamp-1 text-start text-xs text-slate-600">
                              תשובה: {truncateSummary(responseToPlainText(q.response_text), 80)}
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
                  <p className="mt-2 text-secondary">משימות חדשות יופיעו כאן כשמשיבים ישלחו תשובות.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {available.map((q) => (
                    <li key={q.id}>
                      <Card
                        className="cursor-pointer transition-shadow hover:shadow-md"
                        onClick={() => openModal(q)}
                      >
                        <CardContent className="p-4">
                          <p className="text-xs text-secondary">{formatDate(q.created_at)}</p>
                          <p className="mt-1 line-clamp-2 text-start text-sm text-primary">
                            {truncateSummary(q.content)}
                          </p>
                          {q.response_text && (
                            <p className="mt-2 line-clamp-1 text-start text-xs text-slate-600">
                              תשובה: {truncateSummary(responseToPlainText(q.response_text), 80)}
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
