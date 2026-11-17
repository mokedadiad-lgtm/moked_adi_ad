import type { SupabaseClient } from "@supabase/supabase-js";

export type DualProofreaderSlot = "a" | "b";

export type DualProofreadersConfig = {
  proofreader_a_id: string | null;
  proofreader_b_id: string | null;
  proofreader_a_name?: string | null;
  proofreader_b_name?: string | null;
};

export type ProofreaderReviewOutcome = "approved" | "noted";

export type ProofreaderReviewRow = {
  proofreader_id: string;
  proofreader_name?: string | null;
  outcome: ProofreaderReviewOutcome;
  note: string | null;
  completed_at: string;
};

export type DualProofreaderProgress = {
  required: 2;
  completed: number;
  reviews: ProofreaderReviewRow[];
  slots: {
    id: string | null;
    name: string | null;
    review: ProofreaderReviewRow | null;
  }[];
};

export function outcomeLabelHe(outcome: ProofreaderReviewOutcome): string {
  return outcome === "approved" ? "אישור" : "הערה";
}

export async function fetchDualProofreadersConfig(
  supabase: SupabaseClient
): Promise<DualProofreadersConfig> {
  const { data } = await supabase
    .from("system_dual_proofreaders")
    .select("proofreader_a_id, proofreader_b_id")
    .eq("id", 1)
    .maybeSingle();

  const aId = (data as { proofreader_a_id?: string | null } | null)?.proofreader_a_id ?? null;
  const bId = (data as { proofreader_b_id?: string | null } | null)?.proofreader_b_id ?? null;
  const ids = [aId, bId].filter(Boolean) as string[];
  let names: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name_he")
      .in("id", ids);
    names = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, (p.full_name_he ?? "").trim()])
    );
  }

  return {
    proofreader_a_id: aId,
    proofreader_b_id: bId,
    proofreader_a_name: aId ? names[aId] || null : null,
    proofreader_b_name: bId ? names[bId] || null : null,
  };
}

export function isConfiguredDualProofreader(
  cfg: DualProofreadersConfig,
  userId: string | null | undefined
): boolean {
  if (!userId) return false;
  return userId === cfg.proofreader_a_id || userId === cfg.proofreader_b_id;
}

export function buildDualProgress(
  cfg: DualProofreadersConfig,
  reviews: ProofreaderReviewRow[]
): DualProofreaderProgress {
  const byId = new Map(reviews.map((r) => [r.proofreader_id, r]));
  const slots = [
    {
      id: cfg.proofreader_a_id,
      name: cfg.proofreader_a_name ?? null,
      review: cfg.proofreader_a_id ? byId.get(cfg.proofreader_a_id) ?? null : null,
    },
    {
      id: cfg.proofreader_b_id,
      name: cfg.proofreader_b_name ?? null,
      review: cfg.proofreader_b_id ? byId.get(cfg.proofreader_b_id) ?? null : null,
    },
  ];
  const completed = slots.filter((s) => s.review).length;
  return { required: 2, completed, reviews, slots };
}

export async function fetchReviewsForQuestions(
  supabase: SupabaseClient,
  questionIds: string[]
): Promise<Record<string, ProofreaderReviewRow[]>> {
  if (questionIds.length === 0) return {};
  const { data } = await supabase
    .from("question_proofreader_reviews")
    .select("question_id, proofreader_id, outcome, note, completed_at")
    .in("question_id", questionIds);

  const rows = (data ?? []) as {
    question_id: string;
    proofreader_id: string;
    outcome: ProofreaderReviewOutcome;
    note: string | null;
    completed_at: string;
  }[];

  const profileIds = [...new Set(rows.map((r) => r.proofreader_id))];
  let names: Record<string, string> = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name_he")
      .in("id", profileIds);
    names = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, (p.full_name_he ?? "").trim()])
    );
  }

  const out: Record<string, ProofreaderReviewRow[]> = {};
  for (const r of rows) {
    const list = out[r.question_id] ?? [];
    list.push({
      proofreader_id: r.proofreader_id,
      proofreader_name: names[r.proofreader_id] || null,
      outcome: r.outcome,
      note: r.note,
      completed_at: r.completed_at,
    });
    out[r.question_id] = list;
  }
  return out;
}
