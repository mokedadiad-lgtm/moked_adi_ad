import { LinguisticEditorView } from "@/components/admin/linguistic-editor-view";
import { PageHeader } from "@/components/page-header";
import { RoleSwitcher } from "@/components/role-switcher";
import { PageLoadingFallback } from "@/components/ui/page-loading";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";
import { Suspense } from "react";

const SELECT_WITH_SIGNATURE =
  "id, short_id, stage, title, content, created_at, asker_email, asker_age, asker_gender, response_type, publication_consent, assigned_respondent_id, response_text, proofreader_note, pdf_url, pdf_generated_at, linguistic_signature, topic_id, sub_topic_id, topics(name_he), sub_topics(name_he)";

const SELECT_NO_SIGNATURE =
  "id, short_id, stage, title, content, created_at, asker_email, asker_age, asker_gender, response_type, publication_consent, assigned_respondent_id, response_text, proofreader_note, pdf_url, pdf_generated_at, topic_id, sub_topic_id, topics(name_he), sub_topics(name_he)";

const QA_SELECT =
  "id, question_id, topic_id, sub_topic_id, assigned_respondent_id, stage, response_text, proofreader_note, pdf_url, pdf_generated_at, deleted_at";

const QA_QUESTIONS_INNER_WITH_SIG =
  "questions!inner(id, short_id, title, content, created_at, asker_email, asker_age, asker_gender, response_type, publication_consent, deleted_at, answers_merged_at, response_text, pdf_url, pdf_generated_at, linguistic_signature)";

const QA_QUESTIONS_INNER_NO_SIG =
  "questions!inner(id, short_id, title, content, created_at, asker_email, asker_age, asker_gender, response_type, publication_consent, deleted_at, answers_merged_at, response_text, pdf_url, pdf_generated_at)";

function isMissingLinguisticSignatureError(err: { message?: string } | null | undefined): boolean {
  return (err?.message ?? "").toLowerCase().includes("linguistic_signature");
}

type TopicRef = { name_he: string } | { name_he: string }[] | null | undefined;
type Row = QuestionRow & {
  assigned_respondent_id?: string | null;
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
  linguistic_signature?: string | null;
};

function nameFromRelation(v: TopicRef): string | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0]?.name_he ?? null : v.name_he ?? null;
}

async function fetchLinguisticQuestionRows(includeSignature: boolean): Promise<QuestionRow[] | "missing-signature-column"> {
  const supabase = getSupabaseAdmin();
  const stages = ["in_linguistic_review", "ready_for_sending"] as const;
  const qaInner = includeSignature ? QA_QUESTIONS_INNER_WITH_SIG : QA_QUESTIONS_INNER_NO_SIG;

  let qaRows: {
    id: string;
    question_id: string;
    topic_id?: string | null;
    sub_topic_id?: string | null;
    assigned_respondent_id?: string | null;
    stage: string;
    response_text?: string | null;
    proofreader_note?: string | null;
    pdf_url?: string | null;
    pdf_generated_at?: string | null;
    deleted_at?: string | null;
    questions?: { id: string; short_id?: string | null; title?: string | null; content: string; created_at: string; asker_email?: string | null; asker_age?: string | null; asker_gender?: string | null; response_type?: string | null; publication_consent?: string | null; deleted_at?: string | null } | { id: string; short_id?: string | null; title?: string | null; content: string; created_at: string; asker_email?: string | null; asker_age?: string | null; asker_gender?: string | null; response_type?: string | null; publication_consent?: string | null; deleted_at?: string | null }[] | null;
    topics?: TopicRef;
    sub_topics?: TopicRef;
  }[] = [];
  try {
    const qaRes = await supabase
      .from("question_answers")
      .select(`${QA_SELECT}, ${qaInner}, topics(name_he), sub_topics(name_he)`)
      .in("stage", stages)
      .order("created_at", { ascending: false });
    if (qaRes.error) {
      if (includeSignature && isMissingLinguisticSignatureError(qaRes.error)) return "missing-signature-column";
    } else {
      qaRows = ((qaRes.data ?? []) as unknown as typeof qaRows).filter((r) => !r.deleted_at);
    }
  } catch {
    // question_answers may not exist
  }

  const legacyRes = includeSignature
    ? await supabase
        .from("questions")
        .select(SELECT_WITH_SIGNATURE)
        .in("stage", stages)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    : await supabase
        .from("questions")
        .select(SELECT_NO_SIGNATURE)
        .in("stage", stages)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
  const legacyData = legacyRes.data;
  const error = legacyRes.error;

  if (error) {
    if (includeSignature && isMissingLinguisticSignatureError(error)) return "missing-signature-column";
  }

  const legacyRows = (error ? [] : (legacyData ?? [])) as Row[];
  const questionIdsFromQa = new Set(qaRows.map((r) => r.question_id));
  const legacy = legacyRows.filter((r) => !questionIdsFromQa.has(r.id));

  const allRespondentIds = [
    ...new Set([
      ...qaRows.map((r) => r.assigned_respondent_id).filter(Boolean),
      ...legacy.map((r) => r.assigned_respondent_id).filter(Boolean),
    ]),
  ] as string[];
  let names: Record<string, string> = {};
  if (allRespondentIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name_he")
      .in("id", allRespondentIds);
    if (profiles) names = Object.fromEntries(profiles.map((p) => [p.id, p.full_name_he ?? ""]));
  }

  // לקיבוץ: שורה אחת לעריכה לשונית לכל שאלה (גם אם יש כמה question_answers)
  const answersCountByQuestion: Record<string, number> = {};
  for (const r of qaRows) {
    answersCountByQuestion[r.question_id] = (answersCountByQuestion[r.question_id] ?? 0) + 1;
  }
  const byQuestionId = new Map<string, typeof qaRows>();
  for (const r of qaRows) {
    const list = byQuestionId.get(r.question_id) ?? [];
    list.push(r);
    byQuestionId.set(r.question_id, list);
  }
  const fromQa: QuestionRow[] = [];
  for (const [questionId, rows] of byQuestionId.entries()) {
    if (rows.length === 0) continue;
    const first = rows[0]!;
    const q = Array.isArray(first.questions) ? first.questions[0] : first.questions;
    const qData = q as {
      answers_merged_at?: string | null;
      response_text?: string | null;
      pdf_url?: string | null;
      pdf_generated_at?: string | null;
      linguistic_signature?: string | null;
    } | undefined;
    const respondentName =
      first.assigned_respondent_id && names[first.assigned_respondent_id]
        ? names[first.assigned_respondent_id]!
        : null;
    fromQa.push({
      id: q?.id ?? questionId,
      // כשיש תשובה אחת – שומרים ל-question_answers כדי ש־PDF ורענון יראו את העדכון
      answer_id: rows.length === 1 ? first.id : null,
      short_id: q?.short_id ?? null,
      stage: first.stage as QuestionRow["stage"],
      title: q?.title ?? null,
      content: q?.content ?? "",
      created_at: q?.created_at ?? "",
      asker_email: q?.asker_email ?? null,
      asker_age: q?.asker_age ?? null,
      asker_gender: (q?.asker_gender === "M" || q?.asker_gender === "F" ? q.asker_gender : null) as "M" | "F" | null,
      response_type: (q?.response_type === "short" || q?.response_type === "detailed" ? q.response_type : null) as QuestionRow["response_type"],
      publication_consent: (q?.publication_consent === "publish" || q?.publication_consent === "blur" || q?.publication_consent === "none" ? q.publication_consent : null) as QuestionRow["publication_consent"],
      respondent_name: respondentName,
      topic_id: first.topic_id ?? null,
      sub_topic_id: first.sub_topic_id ?? null,
      topic_name_he: nameFromRelation(first.topics),
      sub_topic_name_he: nameFromRelation(first.sub_topics),
      response_text: qData?.answers_merged_at
        ? (qData?.response_text ?? null)
        : (() => {
            const fromAnswer = first.response_text?.trim() ?? "";
            return fromAnswer ? first.response_text : (qData?.response_text ?? first.response_text ?? null);
          })(),
      proofreader_note: first.proofreader_note ?? null,
      pdf_url: qData?.pdf_url ?? null,
      pdf_generated_at: qData?.pdf_generated_at ?? null,
      answers_merged_at: qData?.answers_merged_at ?? null,
      answers_count: answersCountByQuestion[questionId] ?? 1,
      linguistic_signature: includeSignature ? (qData?.linguistic_signature ?? null) : null,
    });
  }

  const fromLegacy: QuestionRow[] = legacy.map((r) => ({
    id: r.id,
    short_id: r.short_id ?? null,
    stage: r.stage,
    title: r.title ?? null,
    content: r.content,
    created_at: r.created_at,
    asker_email: r.asker_email ?? null,
    asker_age: r.asker_age,
    asker_gender: r.asker_gender ?? null,
    response_type: r.response_type,
    publication_consent: r.publication_consent ?? null,
    respondent_name: r.assigned_respondent_id ? names[r.assigned_respondent_id] ?? null : null,
    topic_id: r.topic_id ?? null,
    sub_topic_id: r.sub_topic_id ?? null,
    topic_name_he: nameFromRelation(r.topics),
    sub_topic_name_he: nameFromRelation(r.sub_topics),
    response_text: r.response_text ?? null,
    proofreader_note: r.proofreader_note ?? null,
    pdf_url: r.pdf_url ?? null,
    pdf_generated_at: r.pdf_generated_at ?? null,
    linguistic_signature: includeSignature ? (r.linguistic_signature ?? null) : null,
  }));

  return [...fromQa, ...fromLegacy];
}

async function getLinguisticQuestions(): Promise<QuestionRow[]> {
  const withCol = await fetchLinguisticQuestionRows(true);
  if (withCol !== "missing-signature-column") return withCol;
  const without = await fetchLinguisticQuestionRows(false);
  return without === "missing-signature-column" ? [] : without;
}

export default async function LinguisticEditorPage() {
  const questions = await getLinguisticQuestions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="עריכה לשונית"
        subtitle="עריכת תשובות מוכנות לשליחה ויצירת PDF"
      >
        <RoleSwitcher className="shrink-0" />
      </PageHeader>
      <Suspense fallback={<PageLoadingFallback minHeight="min-h-[12rem]" />}>
        <LinguisticEditorView questions={questions} />
      </Suspense>
    </div>
  );
}
