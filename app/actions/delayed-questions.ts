"use server";

import { getActiveQuestions } from "@/lib/admin-active-questions";
import type { DelayedQuestionItem } from "@/lib/types";

/** עיכובים: אותה לוגיקת סטטוס כמו טבלת לוח הבקרה (כולל question_answers), לפי זמן עדכון הרלוונטי */
export async function getDelayedQuestions(): Promise<DelayedQuestionItem[]> {
  try {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const rows = await getActiveQuestions();
    return rows
      .filter((r) => {
        const t = r.delay_source_updated_at;
        if (!t) return false;
        return new Date(t) < fiveDaysAgo;
      })
      .sort(
        (a, b) =>
          new Date(a.delay_source_updated_at ?? 0).getTime() -
          new Date(b.delay_source_updated_at ?? 0).getTime()
      )
      .map((r) => ({
        id: r.id,
        short_id: r.short_id ?? null,
        title: r.title ?? null,
        stage: r.stage,
        answer_id: r.answer_id ?? null,
      }));
  } catch {
    return [];
  }
}
