import { ArchiveTable } from "@/components/admin/archive-table";
import { PageHeader } from "@/components/page-header";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";

const ARCHIVE_SELECT =
  "id, short_id, stage, title, content, created_at, sent_at, asker_email, asker_age, asker_gender, response_type, publication_consent, assigned_respondent_id, assigned_proofreader_id, response_text, proofreader_note, pdf_url, pdf_generated_at, topic_id, sub_topic_id, topics(name_he), sub_topics(name_he)";

type TopicRef = { name_he: string } | { name_he: string }[] | null | undefined;
type ArchiveRowRaw = QuestionRow & {
  assigned_respondent_id?: string | null;
  assigned_proofreader_id?: string | null;
  topics?: TopicRef;
  sub_topics?: TopicRef;
};

function nameFromRelation(v: TopicRef): string | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0]?.name_he ?? null : v.name_he ?? null;
}

type QaArchive = {
  question_id: string;
  assigned_respondent_id?: string | null;
  assigned_proofreader_id?: string | null;
  topics?: TopicRef;
  sub_topics?: TopicRef;
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
  const questionIds = rows.map((r) => r.id);

  let qaByQuestion: Map<string, QaArchive[]> = new Map();
  if (questionIds.length > 0) {
    const { data: qaData } = await supabase
      .from("question_answers")
      .select("question_id, assigned_respondent_id, assigned_proofreader_id, topics(name_he), sub_topics(name_he)")
      .in("question_id", questionIds)
      .eq("stage", "sent_archived")
      .is("deleted_at", null);
    const qaList = (qaData ?? []) as QaArchive[];
    for (const qa of qaList) {
      const list = qaByQuestion.get(qa.question_id) ?? [];
      list.push(qa);
      qaByQuestion.set(qa.question_id, list);
    }
  }

  const allProfileIds = [
    ...new Set([
      ...rows.flatMap((r) => [r.assigned_respondent_id, r.assigned_proofreader_id].filter(Boolean)),
      ...Array.from(qaByQuestion.values()).flat().flatMap((qa) => [qa.assigned_respondent_id, qa.assigned_proofreader_id].filter(Boolean)),
    ]),
  ] as string[];
  let profileNames: Record<string, string> = {};
  if (allProfileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name_he").in("id", allProfileIds);
    if (profiles?.length) profileNames = Object.fromEntries(profiles.map((p) => [p.id, p.full_name_he ?? ""]));
  }

  return rows.map((r) => {
    const group = qaByQuestion.get(r.id) ?? [];
    let respondent_name: string | null = null;
    let proofreader_name: string | null = null;
    let topic_name_he: string | null = null;
    let sub_topic_name_he: string | null = null;
    if (group.length > 0) {
      const respondentNames = [...new Set(group.map((qa) => qa.assigned_respondent_id).filter(Boolean).map((id) => profileNames[id as string]?.trim()).filter(Boolean))];
      const proofreaderNames = [...new Set(group.map((qa) => qa.assigned_proofreader_id).filter(Boolean).map((id) => profileNames[id as string]?.trim()).filter(Boolean))];
      const topicNames = [...new Set(group.map((qa) => nameFromRelation(qa.topics)).filter(Boolean))];
      const subNames = [...new Set(group.map((qa) => nameFromRelation(qa.sub_topics)).filter(Boolean))];
      respondent_name = respondentNames.length ? respondentNames.join(" · ") : null;
      proofreader_name = proofreaderNames.length ? proofreaderNames.join(" · ") : null;
      topic_name_he = topicNames.length ? topicNames.join(" · ") : null;
      sub_topic_name_he = subNames.length ? subNames.join(" · ") : null;
    }
    if (respondent_name === null && r.assigned_respondent_id) respondent_name = profileNames[r.assigned_respondent_id]?.trim() || null;
    if (proofreader_name === null && r.assigned_proofreader_id) proofreader_name = profileNames[r.assigned_proofreader_id]?.trim() || null;
    if (topic_name_he === null) topic_name_he = nameFromRelation(r.topics);
    if (sub_topic_name_he === null) sub_topic_name_he = nameFromRelation(r.sub_topics);
    return {
      ...r,
      respondent_name,
      proofreader_name,
      topic_name_he,
      sub_topic_name_he,
    };
  }) as QuestionRow[];
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
