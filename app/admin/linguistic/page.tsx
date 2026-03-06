import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";
import { LinguisticEditorView } from "@/components/admin/linguistic-editor-view";

const SELECT =
  "id, stage, content, created_at, asker_email, asker_age, asker_gender, response_type, publication_consent, assigned_respondent_id, response_text, proofreader_note, pdf_url, topic_id, sub_topic_id, topics(name_he), sub_topics(name_he)";

type Row = QuestionRow & {
  assigned_respondent_id?: string | null;
  asker_gender?: "M" | "F" | null;
  publication_consent?: "publish" | "blur" | "none" | null;
  topic_id?: string | null;
  sub_topic_id?: string | null;
  topics?: { name_he: string } | null;
  sub_topics?: { name_he: string } | null;
  response_text?: string | null;
  proofreader_note?: string | null;
  pdf_url?: string | null;
};

async function getLinguisticQuestions(): Promise<QuestionRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("questions")
    .select(SELECT)
    .in("stage", ["in_linguistic_review", "ready_for_sending"])
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
    stage: r.stage,
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
    topic_name_he: r.topics?.name_he ?? null,
    sub_topic_name_he: r.sub_topics?.name_he ?? null,
    response_text: r.response_text ?? null,
    proofreader_note: r.proofreader_note ?? null,
    pdf_url: r.pdf_url ?? null,
  }));
}

export default async function LinguisticEditorPage() {
  const questions = await getLinguisticQuestions();

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200/80 pb-4 text-start">
        <h1 className="text-2xl font-bold text-slate-800">עריכה לשונית</h1>
        <p className="mt-1 text-sm text-slate-500">עריכת תשובות מוכנות לשליחה ויצירת PDF</p>
      </header>
      <LinguisticEditorView questions={questions} />
    </div>
  );
}
