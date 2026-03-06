import { LinguisticEditorView } from "@/components/admin/linguistic-editor-view";
import { PageHeader } from "@/components/page-header";
import { RoleSwitcher } from "@/components/role-switcher";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";
import { Suspense } from "react";

const SELECT =
  "id, short_id, stage, title, content, created_at, asker_email, asker_age, asker_gender, response_type, publication_consent, assigned_respondent_id, response_text, proofreader_note, pdf_url, pdf_generated_at, topic_id, sub_topic_id, topics(name_he), sub_topics(name_he)";

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
};

function nameFromRelation(v: TopicRef): string | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0]?.name_he ?? null : v.name_he ?? null;
}

async function getLinguisticQuestions(): Promise<QuestionRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("questions")
    .select(SELECT)
    .in("stage", ["in_linguistic_review", "ready_for_sending"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) return [];
  const rows = (data ?? []) as Row[];

  const respondentIds = [...new Set(rows.map((r) => r.assigned_respondent_id).filter(Boolean))] as string[];
  let names: Record<string, string> = {};
  if (respondentIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name_he")
      .in("id", respondentIds);
    if (profiles) names = Object.fromEntries(profiles.map((p) => [p.id, p.full_name_he ?? ""]));
  }

  return rows.map((r) => ({
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
  }));
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
      <Suspense fallback={<div className="text-secondary py-8">טוען…</div>}>
        <LinguisticEditorView questions={questions} />
      </Suspense>
    </div>
  );
}
