/**
 * מפתח ייחודי ל־RichTextEditor כשלאותה שאלה יכולות להיות כמה שורות ב־question_answers.
 * חובה להעדיף answer_id — אחרת React עלול למחזר מופע עורך עם state ישן (עיצוב/הערות שוליים).
 */
export function getRichTextEditorInstanceKey(
  questionId: string,
  answerId?: string | null
): string {
  const a = answerId?.trim();
  return a ? a : questionId;
}
