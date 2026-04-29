import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdminFromRequest } from "@/lib/supabase/admin-route-auth";

interface RespondentTask {
  id: string;
  /** When task is from question_answers, for list key and RPC */
  answer_id?: string | null;
  assigned_respondent_id?: string | null;
  proofreader_type_id?: string | null;
  title?: string | null;
  content: string;
  created_at: string;
  asker_age: string | null;
  asker_gender: "M" | "F" | null;
  response_type: "short" | "detailed" | null;
  publication_consent: "publish" | "blur" | "none" | null;
  response_text?: string | null;
}

/** מחזיר למנהל/ת את כל המשימות הפתוחות אצל משיבים (עוקף RLS בעזרת service role). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminFromRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseAdmin();

    // משימות מודרניות מטבלת question_answers
    const { data: qaData, error: qaError } = await supabase
      .from("question_answers")
      .select(
        "id, question_id, response_text, proofreader_type_id, assigned_respondent_id, deleted_at, questions(id, title, content, created_at, asker_age, asker_gender, response_type, publication_consent)"
      )
      .eq("stage", "with_respondent")
      .order("created_at", { ascending: true });

    if (qaError) {
      return NextResponse.json({ ok: false, error: qaError.message }, { status: 500 });
    }

    type QaRow = {
      id: string;
      question_id: string;
      response_text?: string | null;
      proofreader_type_id?: string | null;
      assigned_respondent_id?: string | null;
      deleted_at?: string | null;
      questions:
        | {
            id: string;
            title?: string | null;
            content: string;
            created_at: string;
            asker_age?: string | null;
            asker_gender?: string | null;
            response_type?: string | null;
            publication_consent?: string | null;
          }
        | {
            id: string;
            title?: string | null;
            content: string;
            created_at: string;
            asker_age?: string | null;
            asker_gender?: string | null;
            response_type?: string | null;
            publication_consent?: string | null;
          }[]
        | null;
    };

    const qaRows = (qaData ?? []) as QaRow[];
    const activeQa = qaRows.filter((r) => !r.deleted_at);

    const fromQa: RespondentTask[] = activeQa.map((r) => {
      const q = Array.isArray(r.questions) ? r.questions[0] : r.questions;
      return {
        id: q?.id ?? r.question_id,
        answer_id: r.id,
        assigned_respondent_id: r.assigned_respondent_id ?? null,
        proofreader_type_id: r.proofreader_type_id ?? null,
        title: q?.title ?? null,
        content: q?.content ?? "",
        created_at: q?.created_at ?? "",
        asker_age: q?.asker_age ?? null,
        asker_gender:
          q?.asker_gender === "M" || q?.asker_gender === "F" ? (q.asker_gender as "M" | "F") : null,
        response_type:
          q?.response_type === "short" || q?.response_type === "detailed"
            ? (q.response_type as "short" | "detailed")
            : null,
        publication_consent:
          q?.publication_consent === "publish" ||
          q?.publication_consent === "blur" ||
          q?.publication_consent === "none"
            ? (q.publication_consent as "publish" | "blur" | "none")
            : null,
        response_text: r.response_text ?? null,
      };
    });

    // שאלות ישנות ישירות מטבלת questions (למקרה שאין להן רשומת question_answers)
    const fromQaIds = new Set(activeQa.map((r) => r.question_id));
    const { data: qData, error: qError } = await supabase
      .from("questions")
      .select(
        "id, title, content, created_at, asker_age, asker_gender, response_type, publication_consent, response_text"
      )
      .eq("stage", "with_respondent")
      .order("created_at", { ascending: true });

    if (qError) {
      return NextResponse.json({ ok: false, error: qError.message }, { status: 500 });
    }

    const legacy = (qData ?? [])
      .filter((q) => !fromQaIds.has(q.id))
      .map((q) => ({
        id: q.id,
        answer_id: null,
        proofreader_type_id: null,
        title: (q as { title?: string | null }).title ?? null,
        content: (q as { content: string }).content ?? "",
        created_at: (q as { created_at: string }).created_at,
        asker_age: (q as { asker_age?: string | null }).asker_age ?? null,
        asker_gender:
          (q as { asker_gender?: string | null }).asker_gender === "M" ||
          (q as { asker_gender?: string | null }).asker_gender === "F"
            ? ((q as { asker_gender?: string | null }).asker_gender as "M" | "F")
            : null,
        response_type:
          (q as { response_type?: string | null }).response_type === "short" ||
          (q as { response_type?: string | null }).response_type === "detailed"
            ? ((q as { response_type?: string | null }).response_type as "short" | "detailed")
            : null,
        publication_consent:
          (q as { publication_consent?: string | null }).publication_consent === "publish" ||
          (q as { publication_consent?: string | null }).publication_consent === "blur" ||
          (q as { publication_consent?: string | null }).publication_consent === "none"
            ? ((q as { publication_consent?: string | null })
                .publication_consent as "publish" | "blur" | "none")
            : null,
        response_text: (q as { response_text?: string | null }).response_text ?? null,
      })) as RespondentTask[];

    const tasks: RespondentTask[] = [...fromQa, ...legacy];
    return NextResponse.json({ ok: true, tasks });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

