"use server";

import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function proofreaderUpdateQuestion(payload: {
  questionId: string;
  answerId?: string | null;
  updates: Record<string, unknown>;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const { questionId, answerId, updates } = payload;
    const data = { ...updates, updated_at: new Date().toISOString() };

    const { error } = answerId
      ? await supabase.from("question_answers").update(data).eq("id", answerId)
      : await supabase.from("questions").update(data).eq("id", questionId);

    if (error) return { ok: false as const, error: error.message };

    // Sync stage to parent questions table so PDF route and admin dashboard stay consistent
    if (answerId && updates.stage) {
      await supabase
        .from("questions")
        .update({ stage: updates.stage as string, updated_at: new Date().toISOString() })
        .eq("id", questionId);
    }

    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "שגיאה" };
  }
}
