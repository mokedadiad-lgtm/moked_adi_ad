"use server";

import { getSupabaseAdmin } from "@/lib/supabase/server";

/** משיב/ה בשליחה: סוג מגיהה לפי נושא השאלה, או ברירת מחדל */
export async function getProofreaderTypeIdForQuestion(questionId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: q } = await supabase.from("questions").select("topic_id").eq("id", questionId).single();
    if (q?.topic_id) {
      const { data: topic } = await supabase
        .from("topics")
        .select("proofreader_type_id")
        .eq("id", q.topic_id)
        .single();
      if (topic?.proofreader_type_id) return topic.proofreader_type_id;
    }
    const { data: first } = await supabase
      .from("proofreader_types")
      .select("id")
      .order("sort_order")
      .limit(1)
      .single();
    return first?.id ?? null;
  } catch {
    return null;
  }
}
