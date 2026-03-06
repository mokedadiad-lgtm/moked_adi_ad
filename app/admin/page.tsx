import { getEmailCounts, getProofreaderTypes, getTopicsWithSubTopics } from "@/app/admin/actions";
import { PageHeader } from "@/components/page-header";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";
import { ADMIN_TABLE_STAGES } from "@/lib/types";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

const BASE_SELECT =
  "id, short_id, stage, title, content, created_at, asker_email, asker_age, asker_gender, response_type, publication_consent, assigned_respondent_id, assigned_proofreader_id, response_text, proofreader_note, pdf_url, proofreader_type_id";
const EXTENDED_SELECT = `${BASE_SELECT}, topic_id, sub_topic_id, topics(name_he), sub_topics(name_he)`;

type TopicRef = { name_he: string } | { name_he: string }[] | null | undefined;
type QuestionRowRaw = Omit<QuestionRow, "short_id"> & {
  short_id?: string | null;
  assigned_respondent_id?: string | null;
  assigned_proofreader_id?: string | null;
  asker_gender?: "M" | "F" | null;
  publication_consent?: "publish" | "blur" | "none" | null;
  topic_id?: string | null;
  sub_topic_id?: string | null;
  topics?: TopicRef;
  sub_topics?: TopicRef;
  response_text?: string | null;
  proofreader_note?: string | null;
  pdf_url?: string | null;
  proofreader_type_id?: string | null;
};

function nameFromRelation(v: TopicRef): string | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0]?.name_he ?? null : v.name_he ?? null;
}

async function getActiveQuestions(): Promise<QuestionRow[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("questions")
    .select(EXTENDED_SELECT)
    .in("stage", ADMIN_TABLE_STAGES)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  let rows: QuestionRowRaw[];
  if (error) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("questions")
      .select(BASE_SELECT)
      .in("stage", ADMIN_TABLE_STAGES)
      .is("deleted_at", null)
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

  const withEmail = rows.map((r) => ({
    id: r.id,
    short_id: r.short_id ?? null,
    stage: r.stage,
    title: r.title ?? null,
    content: r.content,
    created_at: r.created_at,
    asker_email: (r as { asker_email?: string | null }).asker_email ?? null,
    asker_age: r.asker_age,
    asker_gender: r.asker_gender ?? null,
    response_type: r.response_type,
    publication_consent: r.publication_consent ?? null,
    respondent_name: r.assigned_respondent_id ? (profileNames[r.assigned_respondent_id]?.trim() || null) : null,
    proofreader_name: r.assigned_proofreader_id ? (profileNames[r.assigned_proofreader_id]?.trim() || null) : null,
    topic_id: r.topic_id ?? null,
    sub_topic_id: r.sub_topic_id ?? null,
    topic_name_he: nameFromRelation(r.topics),
    sub_topic_name_he: nameFromRelation(r.sub_topics),
    response_text: r.response_text ?? null,
    proofreader_note: r.proofreader_note ?? null,
    pdf_url: r.pdf_url ?? null,
    proofreader_type_id: r.proofreader_type_id ?? null,
  }));

  return withEmail;
}

export const revalidate = 0;

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const params = await searchParams;
  const [questions, topics, proofreaderTypes] = await Promise.all([
    getActiveQuestions(),
    getTopicsWithSubTopics(),
    getProofreaderTypes(),
  ]);

  const uniqueEmails = [...new Set(questions.map((r) => (r.asker_email ?? "").trim().toLowerCase()).filter(Boolean))];
  const emailCounts = uniqueEmails.length > 0 ? await getEmailCounts(uniqueEmails) : {};

  return (
    <div className="space-y-6">
      <PageHeader title="לוח בקרה" subtitle="סקירה וניהול משימות פעילות" />
      <AdminDashboard
        questions={questions}
        topics={topics}
        proofreaderTypes={proofreaderTypes}
        initialOpenQuestionId={params.open ?? undefined}
        emailCounts={emailCounts}
      />
    </div>
  );
}
