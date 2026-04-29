import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdminFromRequest } from "@/lib/supabase/admin-route-auth";

interface ProofreaderLobbyTask {
  id: string;
  /** When task is from question_answers */
  answer_id?: string | null;
  assigned_proofreader_id: string | null;
  title?: string | null;
  content: string;
  response_text: string | null;
  created_at: string;
}

/** מחזיר למנהל/ת את כל המשימות בתור ההגהה (עוקף RLS בעזרת service role). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminFromRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseAdmin();

    const { data: qaData, error: qaError } = await supabase
      .from("question_answers")
      .select(
        "id, question_id, response_text, assigned_proofreader_id, deleted_at, questions(id, title, content, created_at)"
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
      assigned_proofreader_id: string | null;
      deleted_at?: string | null;
      questions:
        | { id: string; title?: string | null; content: string; created_at: string }
        | { id: string; title?: string | null; content: string; created_at: string }[]
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
        title: q?.title ?? null,
        content: q?.content ?? "",
        response_text: r.response_text,
        created_at: q?.created_at ?? "",
      };
    });

    // שאלות ישנות ישירות מטבלת questions (למקרה שאין להן רשומת question_answers)
    const { data: qData, error: qError } = await supabase
      .from("questions")
      .select("id, title, content, response_text, created_at, assigned_proofreader_id")
      .eq("stage", "in_proofreading_lobby")
      .order("created_at", { ascending: true });

    if (qError) {
      return NextResponse.json({ ok: false, error: qError.message }, { status: 500 });
    }

    const legacy = (qData ?? [])
      .filter((q) => !fromQaIds.has(q.id))
      .map((q) => ({
        id: q.id,
        answer_id: null,
        assigned_proofreader_id: (q as { assigned_proofreader_id?: string | null }).assigned_proofreader_id ?? null,
        title: (q as { title?: string | null }).title ?? null,
        content: (q as { content: string }).content ?? "",
        response_text: (q as { response_text?: string | null }).response_text ?? null,
        created_at: (q as { created_at: string }).created_at,
      })) as ProofreaderLobbyTask[];

    const tasks: ProofreaderLobbyTask[] = [...fromQa, ...legacy];
    return NextResponse.json({ ok: true, tasks });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

