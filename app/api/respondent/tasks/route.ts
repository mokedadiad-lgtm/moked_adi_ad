import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUserFromBearerToken } from "@/lib/supabase/route-auth";

type RespondentTask = {
  id: string;
  answer_id?: string | null;
  proofreader_type_id?: string | null;
  title?: string | null;
  content: string;
  created_at: string;
  asker_age: string | null;
  asker_gender: "M" | "F" | null;
  response_type: "short" | "detailed" | null;
  publication_consent: "publish" | "blur" | "none" | null;
  response_text?: string | null;
};

function authToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromBearerToken(authToken(request));
    if (!user) {
      return NextResponse.json({ ok: false, error: "לא מחובר" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: qaData, error: qaError } = await supabase
      .from("question_answers")
      .select(
        "id, question_id, response_text, proofreader_type_id, deleted_at, questions(id, title, content, created_at, asker_age, asker_gender, response_type, publication_consent)"
      )
      .eq("stage", "with_respondent")
      .eq("assigned_respondent_id", user.id)
      .order("created_at", { ascending: true });

    if (qaError) {
      return NextResponse.json({ ok: false, error: qaError.message }, { status: 500 });
    }

    type QaRow = {
      id: string;
      question_id: string;
      response_text?: string | null;
      proofreader_type_id?: string | null;
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

    const fromQa: RespondentTask[] = activeQa
      .map((r) => {
        const q = Array.isArray(r.questions) ? r.questions[0] : r.questions;
        if (!q) return null;
        return {
          id: q.id ?? r.question_id,
          answer_id: r.id,
          proofreader_type_id: r.proofreader_type_id ?? null,
          title: q.title ?? null,
          content: q.content ?? "",
          created_at: q.created_at ?? "",
          asker_age: q.asker_age ?? null,
          asker_gender: q.asker_gender === "M" || q.asker_gender === "F" ? (q.asker_gender as "M" | "F") : null,
          response_type:
            q.response_type === "short" || q.response_type === "detailed"
              ? (q.response_type as "short" | "detailed")
              : null,
          publication_consent:
            q.publication_consent === "publish" ||
            q.publication_consent === "blur" ||
            q.publication_consent === "none"
              ? (q.publication_consent as "publish" | "blur" | "none")
              : null,
          response_text: r.response_text ?? null,
        };
      })
      .filter((x): x is RespondentTask => Boolean(x));

    // Legacy fallback (before question_answers flow)
    const fromQaIds = new Set(activeQa.map((r) => r.question_id));
    const { data: legacyData, error: legacyErr } = await supabase
      .from("questions")
      .select(
        "id, title, content, created_at, asker_age, asker_gender, response_type, publication_consent, response_text"
      )
      .eq("stage", "with_respondent")
      .eq("assigned_respondent_id", user.id)
      .order("created_at", { ascending: true });

    if (legacyErr) {
      return NextResponse.json({ ok: false, error: legacyErr.message }, { status: 500 });
    }

    const legacy = (legacyData ?? [])
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

    return NextResponse.json({ ok: true, tasks: [...fromQa, ...legacy] });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

