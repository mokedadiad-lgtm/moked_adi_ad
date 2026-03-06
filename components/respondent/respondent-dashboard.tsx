"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { RoleSwitcher, useHasSidebar } from "@/components/role-switcher";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AnswerModal } from "./answer-modal";

export interface RespondentQuestion {
  id: string;
  title?: string | null;
  content: string;
  created_at: string;
  asker_age: string | null;
  asker_gender: "M" | "F" | null;
  response_type: "short" | "detailed" | null;
  publication_consent: "publish" | "blur" | "none" | null;
  response_text?: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function truncateSummary(text: string, maxLines = 2): string {
  const lines = text.split(/\n/).filter(Boolean);
  const show = lines.slice(0, maxLines).join("\n");
  return lines.length > maxLines ? `${show}…` : show;
}

const RESPONSE_LABEL: Record<string, string> = {
  short: "קצר ולעניין",
  detailed: "תשובה מפורטת",
};

export function RespondentDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasSidebar = useHasSidebar();
  const [questions, setQuestions] = useState<RespondentQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RespondentQuestion | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isAdminViewing, setIsAdminViewing] = useState(false);
  const openedFromLink = useRef(false);

  const fetchQuestions = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_technical_lead")
      .eq("id", user.id)
      .single();
    setIsAdminViewing(profile?.is_admin === true || profile?.is_technical_lead === true);

    const { data, error } = await supabase
      .from("questions")
      .select("id, title, content, created_at, asker_age, asker_gender, response_type, publication_consent, response_text")
      .eq("stage", "with_respondent")
      .eq("assigned_respondent_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      setQuestions([]);
    } else {
      setQuestions((data ?? []) as RespondentQuestion[]);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const didAutoOpen = useRef(false);
  const openQuestionId = searchParams.get("open");

  // קישור ממייל עם ?open=QUESTION_ID — לפתוח ישירות את חלון השאלה הזו
  useEffect(() => {
    if (openedFromLink.current || loading || !openQuestionId) return;
    const q = questions.find((x) => x.id === openQuestionId);
    if (q) {
      openedFromLink.current = true;
      didAutoOpen.current = true; // מונע פתיחה מחדש אחרי סגירה (effect של "שאלה אחת")
      setSelected(q);
      setModalOpen(true);
      router.replace("/respondent", { scroll: false });
    }
  }, [loading, questions, openQuestionId, router]);

  // יש רק שאלה אחת — לפתוח אוטומטית פעם אחת את חלון התשובה כדי שהמשיב יוכל להתחיל לעבוד מיד
  useEffect(() => {
    if (!loading && questions.length === 1 && !modalOpen && !didAutoOpen.current && !openQuestionId) {
      didAutoOpen.current = true;
      setSelected(questions[0]);
      setModalOpen(true);
    }
  }, [loading, questions, modalOpen, openQuestionId]);

  const handleLogout = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const openModal = (q: RespondentQuestion) => {
    setSelected(q);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelected(null);
  };

  const handleAnswerSubmitted = () => {
    closeModal();
    router.replace("/respondent", { scroll: false });
    fetchQuestions();
  };

  return (
    <>
      <PageHeader title="שולחן עבודה - משיבים">
        <RoleSwitcher />
        {!hasSidebar && (
          <Button variant="outline" size="sm" onClick={handleLogout}>
            התנתקות
          </Button>
        )}
      </PageHeader>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {loading ? (
          <p className="text-start text-secondary">טוען…</p>
        ) : questions.length === 0 ? (
          <div className="rounded-2xl border border-card-border bg-card p-12 text-start shadow-soft">
            <p className="text-lg font-medium text-primary">
              {isAdminViewing ? "תצוגת אזור משיב (מנהל/ת)" : "איזה יופי, שולחן העבודה שלך נקי!"}
            </p>
            <p className="mt-2 text-secondary">
              {isAdminViewing
                ? "כדי לראות איך משיב רואה שאלות משובצות: הוסף משיב/ה בניהול צוות, שייך/י אליו/ה שאלה בלוח הבקרה (עפרון → שמור ושלח למשיב), ואז התנתק והתחבר עם האימייל והסיסמה של המשיב/ה — או פתח חלון גלישה פרטית והתחבר שם כמשיב/ה."
                : "אין לך שאלות פתוחות כרגע\u200E."}
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {questions.map((q) => (
              <li key={q.id}>
                <Card
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => openModal(q)}
                >
                  <CardContent className="p-4">
                    <p className="text-xs text-secondary">{formatDate(q.created_at)}</p>
                    {q.title && <p className="mt-1 text-sm font-medium text-slate-800">{q.title}</p>}
                    <p className={cn("line-clamp-2 text-start text-sm text-primary", q.title && "mt-0.5")}>
                      {truncateSummary(q.content)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {q.asker_age && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          גיל {q.asker_age}
                        </span>
                      )}
                      {q.response_type && (
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
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>

      <AnswerModal
        question={selected}
        open={modalOpen}
        onOpenChange={(open) => !open && closeModal()}
        onSuccess={handleAnswerSubmitted}
      />
    </>
  );
}
