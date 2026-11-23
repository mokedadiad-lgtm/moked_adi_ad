import { NextRequest, NextResponse } from "next/server";
import {
  buildDualProgress,
  fetchDualProofreadersConfig,
  fetchReviewsForQuestions,
  type DualProofreaderProgress,
  type ProofreaderReviewRow,
} from "@/lib/dual-proofreaders";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdminFromRequest } from "@/lib/supabase/admin-route-auth";

interface ProofreaderLobbyTask {
  id: string;
  answer_id?: string | null;
  assigned_proofreader_id: string | null;
  assigned_respondent_id?: string | null;
  respondent_name?: string | null;
  title?: string | null;
  content: string;
  response_text: string | null;
  created_at: string;
  asker_age: string | null;
  asker_gender: "M" | "F" | null;
  response_type: "short" | "detailed" | null;
  my_review?: ProofreaderReviewRow | null;
  dual_progress?: DualProofreaderProgress;
}

type QuestionAskerFields = {
  asker_age?: string | null;
  asker_gender?: string | null;
  response_type?: string | null;
};

function normalizeAskerFields(q: QuestionAskerFields | null | undefined): {
  asker_age: string | null;
  asker_gender: "M" | "F" | null;
  response_type: "short" | "detailed" | null;
} {
  const gender = q?.asker_gender;
  const responseType = q?.response_type;
  return {
    asker_age: q?.asker_age ?? null,
    asker_gender: gender === "M" || gender === "F" ? gender : null,
    response_type:
      responseType === "short" || responseType === "detailed" ? responseType : null,
  };
}

/** מחזיר למנהל/ת את כל המשימות בתור ההגהה (עוקף RLS בעזרת service role). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminFromRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseAdmin();
    const cfg = await fetchDualProofreadersConfig(supabase);

    const { data: qaData, error: qaError } = await supabase
      .from("question_answers")
      .select(
        "id, question_id, response_text, assigned_respondent_id, assigned_proofreader_id, deleted_at, questions(id, title, content, created_at, asker_age, asker_gender, response_type)"
      )
      .eq("stage", "in_proofreading_lobby")
      .order("created_at", { ascending: true });

    if (qaError) {
      return NextResponse.json({ ok: false, error: qaError.message }, { status: 500 });
    }

    type QaRow = {
      id: string;
      question_id: string;
      response_text: string | null;
      assigned_respondent_id?: string | null;
      assigned_proofreader_id: string | null;
      deleted_at?: string | null;
      questions:
        | ({ id: string; title?: string | null; content: string; created_at: string } & QuestionAskerFields)
        | ({ id: string; title?: string | null; content: string; created_at: string } & QuestionAskerFields)[]
        | null;
    };
    const qaRows = (qaData ?? []) as QaRow[];
    const activeQa = qaRows.filter((r) => !r.deleted_at);
    const fromQaIds = new Set(activeQa.map((r) => r.question_id));

    const fromQa: ProofreaderLobbyTask[] = activeQa.map((r) => {
      const q = Array.isArray(r.questions) ? r.questions[0] : r.questions;
      return {
        id: q?.id ?? r.question_id,
        answer_id: r.id,
        assigned_proofreader_id: r.assigned_proofreader_id,
        assigned_respondent_id: r.assigned_respondent_id ?? null,
        title: q?.title ?? null,
        content: q?.content ?? "",
        response_text: r.response_text,
        created_at: q?.created_at ?? "",
        ...normalizeAskerFields(q),
      };
    });

    const { data: qData, error: qError } = await supabase
      .from("questions")
      .select(
        "id, title, content, response_text, created_at, assigned_respondent_id, assigned_proofreader_id, asker_age, asker_gender, response_type"
      )
      .eq("stage", "in_proofreading_lobby")
      .order("created_at", { ascending: true });

    if (qError) {
      return NextResponse.json({ ok: false, error: qError.message }, { status: 500 });
    }

    const legacy = (qData ?? [])
      .filter((q) => !fromQaIds.has(q.id))
      .map((q) => {
        const row = q as {
          id: string;
          assigned_respondent_id?: string | null;
          assigned_proofreader_id?: string | null;
          title?: string | null;
          content: string;
          response_text?: string | null;
          created_at: string;
        } & QuestionAskerFields;
        return {
          id: row.id,
          answer_id: null,
          assigned_proofreader_id: row.assigned_proofreader_id ?? null,
          assigned_respondent_id: row.assigned_respondent_id ?? null,
          title: row.title ?? null,
          content: row.content ?? "",
          response_text: row.response_text ?? null,
          created_at: row.created_at,
          ...normalizeAskerFields(row),
        } satisfies ProofreaderLobbyTask;
      });

    const tasksBase = [...fromQa, ...legacy];
    const respondentIds = [
      ...new Set(
        tasksBase
          .map((t) => t.assigned_respondent_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    let profileNames: Record<string, string> = {};
    if (respondentIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name_he")
        .in("id", respondentIds);
      if (profiles) {
        profileNames = Object.fromEntries(
          profiles.map((p) => [p.id, (p.full_name_he ?? "").trim()])
        );
      }
    }

    const reviewsByQ = await fetchReviewsForQuestions(
      supabase,
      tasksBase.map((t) => t.id)
    );

    const tasks: ProofreaderLobbyTask[] = tasksBase.map((t) => {
      const reviews = reviewsByQ[t.id] ?? [];
      return {
        ...t,
        respondent_name: t.assigned_respondent_id
          ? profileNames[t.assigned_respondent_id] || null
          : null,
        dual_progress: buildDualProgress(cfg, reviews),
        my_review: null,
      };
    });

    return NextResponse.json({
      ok: true,
      tasks,
      dual_config: {
        proofreader_a_id: cfg.proofreader_a_id,
        proofreader_b_id: cfg.proofreader_b_id,
        proofreader_a_name: cfg.proofreader_a_name ?? null,
        proofreader_b_name: cfg.proofreader_b_name ?? null,
      },
    });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
