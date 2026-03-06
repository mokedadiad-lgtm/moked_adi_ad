import { ArchiveTable } from "@/components/admin/archive-table";
import { PageHeader } from "@/components/page-header";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";

const ARCHIVE_SELECT =
  "id, short_id, stage, title, content, created_at, sent_at, asker_email, asker_age, asker_gender, response_type, publication_consent, assigned_respondent_id, assigned_proofreader_id, response_text, proofreader_note, pdf_url, pdf_generated_at, topic_id, sub_topic_id, topics(name_he), sub_topics(name_he)";

type ArchiveRowRaw = QuestionRow & {
  assigned_respondent_id?: string | null;
  assigned_proofreader_id?: string | null;
  topics?: { name_he: string } | null;
  sub_topics?: { name_he: string } | null;
};

async function getArchivedQuestions(): Promise<QuestionRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("questions")
    .select(ARCHIVE_SELECT)
    .eq("stage", "sent_archived")
    .is("deleted_at", null)
    .order("sent_at", { ascending: false });

  if (error) return [];
  const rows = (data ?? []) as ArchiveRowRaw[];
  const profileIds = [...new Set(rows.flatMap((r) => [r.assigned_respondent_id, r.assigned_proofreader_id].filter(Boolean)))] as string[];
  let profileNames: Record<string, string> = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name_he").in("id", profileIds);
    if (profiles?.length) profileNames = Object.fromEntries(profiles.map((p) => [p.id, p.full_name_he ?? ""]));
  }
  return rows.map((r) => ({
    ...r,
    respondent_name: r.assigned_respondent_id ? (profileNames[r.assigned_respondent_id]?.trim() || null) : null,
    proofreader_name: r.assigned_proofreader_id ? (profileNames[r.assigned_proofreader_id]?.trim() || null) : null,
    topic_name_he: r.topics?.name_he ?? null,
    sub_topic_name_he: r.sub_topics?.name_he ?? null,
  })) as QuestionRow[];
}

export default async function AdminArchivePage() {
  const questions = await getArchivedQuestions();

  return (
    <div className="space-y-6">
      <PageHeader title="ארכיון" subtitle="תשובות שנשלחו ואורכבו" />
      <ArchiveTable questions={questions} />
    </div>
  );
}
