/**
 * טווחי גיל קבועים לקליטה (טופס / וואטסאפ / אדמין).
 * נשמרים כטקסט תצוגה ב־questions.asker_age (TEXT).
 */
export const ASKER_AGE_RANGE_LABELS = [
  "23-26",
  "27-34",
  "35-40",
  "41-50",
  "50+",
] as const;

export type AskerAgeRangeLabel = (typeof ASKER_AGE_RANGE_LABELS)[number];

export function isAskerAgeRangeLabel(value: string | null | undefined): value is AskerAgeRangeLabel {
  return Boolean(value && (ASKER_AGE_RANGE_LABELS as readonly string[]).includes(value));
}

export function normalizeAskerAgeRangeInput(raw: string | null | undefined): AskerAgeRangeLabel | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (isAskerAgeRangeLabel(t)) return t;
  // tolerate common variants
  const compact = t.replace(/\s+/g, "");
  if (compact === "50+") return "50+";
  // allow unicode plus sign
  if (compact.replace(/＋/g, "+") === "50+") return "50+";
  return null;
}
