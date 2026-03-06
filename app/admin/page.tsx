import {
  getRespondents,
  getTopicsWithSubTopics,
} from "@/app/admin/actions";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";
import { ACTIVE_STAGES } from "@/lib/types";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

const BASE_SELECT =
  "id, stage, content, created_at, asker_age, asker_gender, response_type, publication_consent, assigned_respondent_id, assigned_proofreader_id, response_text, proofreader_note";
const EXTENDED_SELECT = `${BASE_SELECT}, topic_id, sub_topic_id, topics(name_he), sub_topics(name_he)`;

type QuestionRowRaw = QuestionRow & {
  assigned_respondent_id?: string | null;
  assigned_proofreader_id?: string | null;
  asker_gender?: "M" | "F" | null;
  publication_consent?: "publish" | "blur" | "none" | null;
  topic_id?: string | null;
  sub_topic_id?: string | null;
  topics?: { name_he: string } | null;
  sub_topics?: { name_he: string } | null;
  response_text?: string | null;
  proofreader_note?: string | null;
};

async function getActiveQuestions(): Promise<QuestionRow[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("questions")
    .select(EXTENDED_SELECT)
    .in("stage", ACTIVE_STAGES)
    .order("created_at", { ascending: false });

  let rows: QuestionRowRaw[];
  if (error) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("questions")
      .select(BASE_SELECT)
      .in("stage", ACTIVE_STAGES)
      .order("created_at", { ascending: false });
    if (fallbackError) return [];
    rows = (fallbackData ?? []) as QuestionRowRaw[];
  } else {
    rows = (data ?? []) as QuestionRowRaw[];
  }

  const respondentIds = [...new Set(rows.map((r) => r.assigned_respondent_id).filter(Boolean))] as string[];
  const proofreaderIds = [...new Set(rows.map((r) => r.assigned_proofreader_id).filter(Boolean))] as string[];
  const allProfileIds = [...new Set([...respondentIds, ...proofreaderIds])];
  let profileNames: Record<string, string> = {};
  if (allProfileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name_he")
      .in("id", allProfileIds);
    if (profiles) profileNames = Object.fromEntries(profiles.map((p) => [p.id, p.full_name_he ?? ""]));
  }

  return rows.map((r) => ({
    id: r.id,
    stage: r.stage,
    content: r.content,
    created_at: r.created_at,
    asker_age: r.asker_age,
    asker_gender: r.asker_gender ?? null,
    response_type: r.response_type,
    publication_consent: r.publication_consent ?? null,
    respondent_name: r.assigned_respondent_id ? profileNames[r.assigned_respondent_id] ?? null : null,
    proofreader_name: r.assigned_proofreader_id ? profileNames[r.assigned_proofreader_id] ?? null : null,
    topic_id: r.topic_id ?? null,
    sub_topic_id: r.sub_topic_id ?? null,
    topic_name_he: r.topics?.name_he ?? null,
    sub_topic_name_he: r.sub_topics?.name_he ?? null,
    response_text: r.response_text ?? null,
    proofreader_note: r.proofreader_note ?? null,
  }));
}

export default async function AdminDashboardPage() {
  const [questions, respondents, topics] = await Promise.all([
    getActiveQuestions(),
    getRespondents(),
    getTopicsWithSubTopics(),
  ]);

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200/80 pb-4 text-start">
        <h1 className="text-2xl font-bold text-slate-800">לוח בקרה</h1>
        <p className="mt-1 text-sm text-slate-500">סקירה וניהול משימות פעילות</p>
      </header>
      <AdminDashboard
        questions={questions}
        respondents={respondents}
        topics={topics}
      />
    </div>
  );
}
