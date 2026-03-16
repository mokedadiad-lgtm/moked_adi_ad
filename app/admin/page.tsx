import { getEmailCounts, getProofreaderTypes, getTopicsWithSubTopics } from "@/app/admin/actions";
import { PageHeader } from "@/components/page-header";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";
import { ADMIN_TABLE_STAGES } from "@/lib/types";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

const BASE_SELECT =
  "id, short_id, stage, title, content, created_at, asker_email, asker_age, asker_gender, response_type, publication_consent, assigned_respondent_id, assigned_proofreader_id, response_text, proofreader_note, pdf_url, pdf_generated_at, proofreader_type_id";
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
  pdf_generated_at?: string | null;
  proofreader_type_id?: string | null;
};

function nameFromRelation(v: TopicRef): string | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0]?.name_he ?? null : v.name_he ?? null;
}

const QA_SELECT =
  "id, question_id, topic_id, sub_topic_id, assigned_respondent_id, assigned_proofreader_id, stage, response_text, proofreader_note, pdf_url, pdf_generated_at, proofreader_type_id, created_at, deleted_at";

type QuestionAnswerRaw = {
  id: string;
  question_id: string;
  topic_id?: string | null;
  sub_topic_id?: string | null;
  assigned_respondent_id?: string | null;
  assigned_proofreader_id?: string | null;
  stage: string;
  response_text?: string | null;
  proofreader_note?: string | null;
  pdf_url?: string | null;
  pdf_generated_at?: string | null;
  proofreader_type_id?: string | null;
  created_at: string;
  deleted_at?: string | null;
  questions?: {
    short_id?: string | null;
    title?: string | null;
    content: string;
    created_at: string;
    asker_email?: string | null;
    asker_age?: string | null;
    asker_gender?: string | null;
    response_type?: string | null;
    publication_consent?: string | null;
    deleted_at?: string | null;
  } | null;
  topics?: TopicRef;
  sub_topics?: TopicRef;
};

async function getActiveQuestions(): Promise<QuestionRow[]> {
  const supabase = getSupabaseAdmin();

  let qaRows: QuestionAnswerRaw[] = [];
  try {
    const qaRes = await supabase
      .from("question_answers")
      .select(
        `${QA_SELECT}, questions!inner(short_id, title, content, created_at, asker_email, asker_age, asker_gender, response_type, publication_consent, deleted_at), topics(name_he), sub_topics(name_he)`
      )
      .in("stage", ADMIN_TABLE_STAGES)
      .order("created_at", { ascending: false });
    qaRows = ((qaRes.data ?? []) as unknown as QuestionAnswerRaw[]).filter((r) => {
      // מסתירים גם תשובות שנמחקו (deleted_at ב-question_answers) וגם שאלות שנמחקו (deleted_at ב-questions)
      if (r.deleted_at) return false;
      const q = Array.isArray(r.questions) ? r.questions[0] : r.questions;
      return !q?.deleted_at;
    });
  } catch {
    // question_answers table may not exist before migration
  }

  const legacyRes = await supabase
    .from("questions")
    .select(EXTENDED_SELECT)
    .in("stage", ADMIN_TABLE_STAGES)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const legacyQuestions = (legacyRes.data ?? []) as QuestionRowRaw[];
  const questionIdsWithAnswers = new Set(qaRows.map((r) => r.question_id));
  const legacyRows = legacyQuestions.filter((q: { id: string }) => !questionIdsWithAnswers.has(q.id));

  const respondentIds = [
    ...new Set([
      ...qaRows.map((r) => r.assigned_respondent_id).filter(Boolean),
      ...legacyRows.map((r) => r.assigned_respondent_id).filter(Boolean),
    ]),
  ] as string[];
  const proofreaderIds = [
    ...new Set([
      ...qaRows.map((r) => r.assigned_proofreader_id).filter(Boolean),
      ...legacyRows.map((r) => r.assigned_proofreader_id).filter(Boolean),
    ]),
  ] as string[];
  const allProfileIds = [...new Set([...respondentIds, ...proofreaderIds])];
  let profileNames: Record<string, string> = {};
  if (allProfileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name_he")
      .in("id", allProfileIds);
    if (profiles) profileNames = Object.fromEntries(profiles.map((p) => [p.id, p.full_name_he ?? ""]));
  }

  const answersCountByQuestion: Record<string, number> = {};
  for (const r of qaRows) {
    answersCountByQuestion[r.question_id] = (answersCountByQuestion[r.question_id] ?? 0) + 1;
  }

  const fromAnswer = (r: QuestionAnswerRaw): QuestionRow => {
    const q = Array.isArray(r.questions) ? r.questions[0] : r.questions;
    return {
      id: r.question_id,
      answer_id: r.id,
      short_id: q?.short_id ?? null,
      answers_count: answersCountByQuestion[r.question_id] ?? 1,
      stage: r.stage as QuestionRow["stage"],
      title: q?.title ?? null,
      content: q?.content ?? "",
      created_at: q?.created_at ?? r.created_at,
      asker_email: q?.asker_email ?? null,
      asker_age: q?.asker_age ?? null,
      asker_gender: (q?.asker_gender as "M" | "F" | null) ?? null,
      response_type: q?.response_type ?? null,
      publication_consent: (q?.publication_consent as QuestionRow["publication_consent"]) ?? null,
      respondent_name: r.assigned_respondent_id ? (profileNames[r.assigned_respondent_id]?.trim() || null) : null,
      proofreader_name: r.assigned_proofreader_id ? (profileNames[r.assigned_proofreader_id]?.trim() || null) : null,
      topic_id: r.topic_id ?? null,
      sub_topic_id: r.sub_topic_id ?? null,
      topic_name_he: nameFromRelation(r.topics),
      sub_topic_name_he: nameFromRelation(r.sub_topics),
      response_text: r.response_text ?? null,
      proofreader_note: r.proofreader_note ?? null,
      pdf_url: r.pdf_url ?? null,
      pdf_generated_at: r.pdf_generated_at ?? null,
      proofreader_type_id: r.proofreader_type_id ?? null,
    };
  };

  const notReadyForSending = qaRows.filter((r) => r.stage !== "ready_for_sending");
  const readyForSendingRows = qaRows.filter((r) => r.stage === "ready_for_sending");
  const byQuestionIdReady = new Map<string, QuestionAnswerRaw[]>();
  for (const r of readyForSendingRows) {
    const list = byQuestionIdReady.get(r.question_id) ?? [];
    list.push(r);
    byQuestionIdReady.set(r.question_id, list);
  }

  const answerRows: QuestionRow[] = [...notReadyForSending.map(fromAnswer)];
  for (const [, group] of byQuestionIdReady) {
    const first = group[0]!;
    const q = Array.isArray(first.questions) ? first.questions[0] : first.questions;
    const respondentNames = [...new Set(group.map((r) => r.assigned_respondent_id).filter(Boolean).map((id) => profileNames[id as string]?.trim()).filter(Boolean))];
    const proofreaderNames = [...new Set(group.map((r) => r.assigned_proofreader_id).filter(Boolean).map((id) => profileNames[id as string]?.trim()).filter(Boolean))];
    const topicNames = [...new Set(group.map((r) => nameFromRelation(r.topics)).filter(Boolean))];
    const subTopicNames = [...new Set(group.map((r) => nameFromRelation(r.sub_topics)).filter(Boolean))];
    answerRows.push({
      id: first.question_id,
      answer_id: group.length === 1 ? first.id : null,
      short_id: q?.short_id ?? null,
      answers_count: group.length,
      stage: "ready_for_sending" as const,
      title: q?.title ?? null,
      content: q?.content ?? "",
      created_at: q?.created_at ?? first.created_at,
      asker_email: q?.asker_email ?? null,
      asker_age: q?.asker_age ?? null,
      asker_gender: (q?.asker_gender as "M" | "F" | null) ?? null,
      response_type: q?.response_type ?? null,
      publication_consent: (q?.publication_consent as QuestionRow["publication_consent"]) ?? null,
      respondent_name: respondentNames.length ? respondentNames.join(" · ") : null,
      proofreader_name: proofreaderNames.length ? proofreaderNames.join(" · ") : null,
      topic_id: first.topic_id ?? null,
      sub_topic_id: first.sub_topic_id ?? null,
      topic_name_he: topicNames.length ? topicNames.join(" · ") : null,
      sub_topic_name_he: subTopicNames.length ? subTopicNames.join(" · ") : null,
      response_text: first.response_text ?? null,
      proofreader_note: first.proofreader_note ?? null,
      pdf_url: first.pdf_url ?? null,
      pdf_generated_at: first.pdf_generated_at ?? null,
      proofreader_type_id: first.proofreader_type_id ?? null,
    });
  }

  const fromLegacy = (r: QuestionRowRaw): QuestionRow => ({
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
    pdf_generated_at: (r as { pdf_generated_at?: string | null }).pdf_generated_at ?? null,
    proofreader_type_id: r.proofreader_type_id ?? null,
  });

  const legacyMapped = legacyRows.map(fromLegacy);
  const combined = [...answerRows, ...legacyMapped].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return combined;
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
