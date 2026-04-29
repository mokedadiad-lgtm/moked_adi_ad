"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLoadingFallback } from "@/components/ui/page-loading";
import { PageHeader } from "@/components/page-header";
import { RoleSwitcher, useHasSidebar } from "@/components/role-switcher";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { afterModalClose, cn } from "@/lib/utils";
import { AnswerModal } from "./answer-modal";

export interface RespondentQuestion {
  id: string;
  /** When task is from question_answers, for list key and RPC */
  answer_id?: string | null;
  proofreader_type_id?: string | null;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRespondent, setIsRespondent] = useState(false);
  const [showAllForAdmin, setShowAllForAdmin] = useState(true);
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
      .select("is_admin, is_technical_lead, is_respondent")
      .eq("id", user.id)
      .single();
    const isAdminOrTechLead = profile?.is_admin === true || profile?.is_technical_lead === true;
    const isResp = profile?.is_respondent === true;
    setIsAdmin(isAdminOrTechLead);
    setIsRespondent(isResp);

    // אם המשתמש הוא מנהל (עם או בלי תפקיד משיב) ובחר "כל המשימות" – נשתמש ב-API עם service role
    if (isAdminOrTechLead && (!isResp || showAllForAdmin)) {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      if (!token) {
        setQuestions([]);
        setLoading(false);
        return;
      }
      const res = await fetch("/api/admin/respondent-tasks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        tasks?: RespondentQuestion[];
      };
      if (!data.ok || !data.tasks) {
        setQuestions([]);
      } else {
        setQuestions(data.tasks);
      }
      setLoading(false);
      return;
    }

    // אם המשתמש הוא גם מנהל וגם משיב אבל בחר "רק המשימות שלי" – נשתמש גם ב-API המנהלי,
    // אבל נסנן רק למשימות ששויכו אליו (assigned_respondent_id).
    if (isAdminOrTechLead && isResp && !showAllForAdmin) {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      if (!token) {
        setQuestions([]);
        setLoading(false);
        return;
      }
      const res = await fetch("/api/admin/respondent-tasks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        tasks?: (RespondentQuestion & { assigned_respondent_id?: string | null })[];
      };
      if (!data.ok || !data.tasks) {
        setQuestions([]);
      } else {
        setQuestions(
          data.tasks.filter((t) => t.assigned_respondent_id && t.assigned_respondent_id === user.id)
        );
      }
      setLoading(false);
      return;
    }

    // אחרת – תצוגת משיב רגילה: רק המשימות של המשתמש הנוכחי (RLS),
    // עם שליפת השאלות בבקשה נפרדת כדי להימנע מבעיות הרשאה על join.
    const { data: qaData } = await supabase
      .from("question_answers")
      .select("id, question_id, response_text, proofreader_type_id, deleted_at")
      .eq("stage", "with_respondent")
      .eq("assigned_respondent_id", user.id)
      .order("created_at", { ascending: true });

    const qaRows = (qaData ?? []) as {
      id: string;
      question_id: string;
      response_text?: string | null;
      proofreader_type_id?: string | null;
      deleted_at?: string | null;
    }[];
    const activeQa = qaRows.filter((r) => !r.deleted_at);
    const questionIds = [...new Set(activeQa.map((r) => r.question_id))];

    const { data: qData } = await supabase
      .from("questions")
      .select(
        "id, title, content, created_at, asker_age, asker_gender, response_type, publication_consent"
      )
      .in("id", questionIds.length > 0 ? questionIds : ["00000000-0000-0000-0000-000000000000"]);

    const qMap = new Map<
      string,
      {
        id: string;
        title?: string | null;
        content: string;
        created_at: string;
        asker_age?: string | null;
        asker_gender?: string | null;
        response_type?: string | null;
        publication_consent?: string | null;
      }
    >();
    for (const q of qData ?? []) {
      qMap.set((q as { id: string }).id, q as any);
    }

    const fromQa: RespondentQuestion[] = activeQa.map((r) => {
      const q = qMap.get(r.question_id);
      return {
        id: q?.id ?? r.question_id,
        answer_id: r.id,
        proofreader_type_id: r.proofreader_type_id ?? null,
        title: (q as { title?: string | null } | undefined)?.title ?? null,
        content: (q as { content?: string } | undefined)?.content ?? "",
        created_at: (q as { created_at?: string } | undefined)?.created_at ?? "",
        asker_age: (q as { asker_age?: string | null } | undefined)?.asker_age ?? null,
        asker_gender:
          (q as { asker_gender?: string | null } | undefined)?.asker_gender === "M" ||
          (q as { asker_gender?: string | null } | undefined)?.asker_gender === "F"
            ? ((q as { asker_gender?: string | null }).asker_gender as "M" | "F")
            : null,
        response_type:
          (q as { response_type?: string | null } | undefined)?.response_type === "short" ||
          (q as { response_type?: string | null } | undefined)?.response_type === "detailed"
            ? ((q as { response_type?: string | null }).response_type as "short" | "detailed")
            : null,
        publication_consent:
          (q as { publication_consent?: string | null } | undefined)?.publication_consent ===
            "publish" ||
          (q as { publication_consent?: string | null } | undefined)?.publication_consent ===
            "blur" ||
          (q as { publication_consent?: string | null } | undefined)?.publication_consent ===
            "none"
            ? ((q as { publication_consent?: string | null }).publication_consent as
                | "publish"
                | "blur"
                | "none")
            : null,
        response_text: r.response_text ?? null,
      };
    });

    // שאלות ישנות (ללא question_answers) — נשארות כמו קודם
    const { data: legacyData } = await supabase
      .from("questions")
      .select(
        "id, title, content, created_at, asker_age, asker_gender, response_type, publication_consent, response_text"
      )
      .eq("stage", "with_respondent")
      .eq("assigned_respondent_id", user.id)
      .order("created_at", { ascending: true });

    const legacyRows = (legacyData ?? []) as RespondentQuestion[];
    const fromQaIds = new Set(activeQa.map((r) => r.question_id));
    const legacy = legacyRows.filter((q) => !fromQaIds.has(q.id));

    setQuestions([...fromQa, ...legacy]);
    setLoading(false);
  }, [router, showAllForAdmin]);

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
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  };

  const openModal = (q: RespondentQuestion) => {
    setSelected(q);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    afterModalClose(() => setSelected(null));
  };

  const handleAnswerSubmitted = () => {
    closeModal();
    router.replace("/respondent", { scroll: false });
    fetchQuestions();
  };

  const handleDraftSaved = ({
    questionId,
    answerId,
    responseText,
  }: {
    questionId: string;
    answerId?: string | null;
    responseText: string;
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

  return (
    <>
      <PageHeader title="שולחן עבודה - משיבים">
        <RoleSwitcher />
        {isAdmin && isRespondent && (
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

      <main className="mx-auto max-w-4xl px-4 py-6">
        {loading ? (
          <PageLoadingFallback
            className="w-full"
            minHeight="min-h-[min(60vh,26rem)]"
          />
        ) : questions.length === 0 ? (
          <div className="rounded-2xl border border-card-border bg-card p-12 text-start shadow-soft">
            <p className="text-lg font-medium text-primary">
              {isAdmin && showAllForAdmin
                ? "תצוגת אזור משיב (מנהל/ת)"
                : "איזה יופי, שולחן העבודה שלך נקי!"}
            </p>
            <p className="mt-2 text-secondary">
              {isAdmin && showAllForAdmin
                ? "כדי לראות איך משיב רואה שאלות משובצות: הוסף משיב/ה בניהול צוות, שייך/י אליו/ה שאלה בלוח הבקרה (עפרון → שמור ושלח למשיב), ואז התנתק והתחבר עם האימייל והסיסמה של המשיב/ה — או פתח חלון גלישה פרטית והתחבר שם כמשיב/ה."
                : "אין לך שאלות פתוחות כרגע\u200E."}
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {questions.map((q) => (
              <li key={q.answer_id ?? q.id}>
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
        onDraftSaved={handleDraftSaved}
      />
    </>
  );
}
