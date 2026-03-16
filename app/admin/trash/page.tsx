import { TrashTable } from "@/components/admin/trash-table";
import { TrashAnswersTable } from "@/components/admin/trash-answers-table";
import { PageHeader } from "@/components/page-header";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";

async function getTrashedQuestions(): Promise<QuestionRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("questions")
    .select("id, short_id, stage, title, content, created_at, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as QuestionRow[];
}

async function getTrashedAnswers(): Promise<
  {
    id: string;
    question_id: string;
    deleted_at: string | null;
    stage: string;
    respondent_name: string | null;
    topic_name_he: string | null;
    sub_topic_name_he: string | null;
    short_id: string | null;
    title: string | null;
  }[]
> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("question_answers")
    .select(
      "id, question_id, deleted_at, stage, topics(name_he), sub_topics(name_he), questions(id, short_id, title, deleted_at), assigned_respondent_id"
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error || !data) return [];

  const rows = (data ?? []) as unknown as {
    id: string;
    question_id: string;
    deleted_at: string | null;
    stage: string;
    topics?: { name_he?: string } | null;
    sub_topics?: { name_he?: string } | null;
    questions?: { id: string; short_id?: string | null; title?: string | null; deleted_at?: string | null } | null;
    assigned_respondent_id?: string | null;
  }[];

  const activeRows = rows.filter((r) => !r.questions?.deleted_at);
  const respondentIds = [...new Set(activeRows.map((r) => r.assigned_respondent_id).filter(Boolean))] as string[];
  let respondentNames: Record<string, string> = {};
  if (respondentIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name_he")
      .in("id", respondentIds);
    if (profiles) respondentNames = Object.fromEntries(profiles.map((p) => [p.id, p.full_name_he ?? ""]));
  }

  return activeRows.map((r) => ({
    id: r.id,
    question_id: r.question_id,
    deleted_at: r.deleted_at ?? null,
    stage: r.stage,
    respondent_name: r.assigned_respondent_id ? respondentNames[r.assigned_respondent_id] ?? null : null,
    topic_name_he: r.topics?.name_he ?? null,
    sub_topic_name_he: r.sub_topics?.name_he ?? null,
    short_id: r.questions?.short_id ?? null,
    title: r.questions?.title ?? null,
  }));
}

export default async function AdminTrashPage() {
  const [questions, answers] = await Promise.all([getTrashedQuestions(), getTrashedAnswers()]);

  return (
    <div className="space-y-6">
      <PageHeader title="אשפה" subtitle="שאלות שהושלכו לאשפה" />
      <TrashTable questions={questions} />
      <TrashAnswersTable answers={answers} />
    </div>
  );
}
