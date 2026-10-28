/** קהל פונים שאיש צוות מיועד אליהם */
export type AskerAudience = "M" | "F" | "both";

export const ASKER_AUDIENCE_VALUES = ["M", "F", "both"] as const;

export const ASKER_AUDIENCE_LABELS: Record<AskerAudience, string> = {
  M: "בחורים",
  F: "בחורות",
  both: "בחורים ובחורות",
};

export function parseAskerAudience(raw: unknown): AskerAudience {
  if (raw === "M" || raw === "F" || raw === "both") return raw;
  return "both";
}

/** האם איש צוות יכול לטפל בפונה עם מגדר נתון (null = לא צוין → מתאים לכולם) */
export function audienceMatchesAskerGender(
  audience: AskerAudience | null | undefined,
  askerGender: "M" | "F" | null | undefined
): boolean {
  if (!askerGender) return true;
  const a = audience ?? "both";
  return a === "both" || a === askerGender;
}
