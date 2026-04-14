import { TrashTable } from "@/components/admin/trash-table";
import { TrashAnswersTable } from "@/components/admin/trash-answers-table";
import { PageHeader } from "@/components/page-header";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

async function getCancelledIntakeDrafts(): Promise<
  {
    id: string;
    phone: string;
    title: string | null;
    content_preview: string;
    updated_at: string | null;
  }[]
> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("question_intake_drafts")
    .select("id, phone, title, content, updated_at")
    .eq("status", "cancelled")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) return [];
  return (data ?? []).map((d) => ({
    id: d.id as string,
    phone: (d.phone as string) ?? "",
    title: (d.title as string | null) ?? null,
    content_preview: (((d.content as string | null) ?? "").slice(0, 120) as string) || "",
    updated_at: (d.updated_at as string | null) ?? null,
  }));
}

export default async function AdminTrashPage() {
  const [questions, answers] = await Promise.all([getTrashedQuestions(), getTrashedAnswers()]);
  const cancelledDrafts = await getCancelledIntakeDrafts();

  return (
    <div className="space-y-6">
      <PageHeader title="אשפה" subtitle="שאלות שהושלכו לאשפה" />
      <TrashTable questions={questions} />
      <TrashAnswersTable answers={answers} />

      <Card className="overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          <div className="border-b px-4 py-2 text-right text-sm font-semibold text-slate-700">
            טיוטות שבוטלו (WhatsApp)
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>ID טיוטה</TableHead>
                  <TableHead>טלפון</TableHead>
                  <TableHead>כותרת / תקציר</TableHead>
                  <TableHead>תאריך ביטול</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cancelledDrafts.length === 0 ? (
                  <TableRow className="border-0 !bg-transparent odd:!bg-transparent even:!bg-transparent hover:!bg-transparent">
                    <TableCell colSpan={4} className="py-8 text-center text-secondary">
                      אין טיוטות שבוטלו
                    </TableCell>
                  </TableRow>
                ) : (
                  cancelledDrafts.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs text-secondary">{d.id.slice(0, 8)}…</TableCell>
                      <TableCell className="text-sm text-slate-800">{d.phone}</TableCell>
                      <TableCell className="max-w-[420px] text-right">
                        {d.title && <div className="text-sm font-medium text-slate-800">{d.title}</div>}
                        <div className="line-clamp-2 text-sm text-slate-600">{d.title ? d.content_preview : d.content_preview}</div>
                      </TableCell>
                      <TableCell className="text-sm text-secondary">
                        {d.updated_at ? new Date(d.updated_at).toLocaleDateString("he-IL") : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
