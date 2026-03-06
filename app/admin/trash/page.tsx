import { TrashTable } from "@/components/admin/trash-table";
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

export default async function AdminTrashPage() {
  const questions = await getTrashedQuestions();

  return (
    <div className="space-y-6">
      <PageHeader title="אשפה" subtitle="שאלות שהושלכו לאשפה" />
      <TrashTable questions={questions} />
    </div>
  );
}
