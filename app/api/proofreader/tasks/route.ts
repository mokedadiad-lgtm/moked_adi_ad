import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUserFromBearerToken } from "@/lib/supabase/route-auth";

type ProofreaderTask = {
  id: string;
  answer_id?: string | null;
  title?: string | null;
  content: string;
  response_text: string | null;
  created_at: string;
  assigned_proofreader_id: string | null;
  proofreader_type_id?: string | null;
};

function authToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromBearerToken(authToken(request));
    if (!user) return NextResponse.json({ ok: false, error: "לא מחובר" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("is_admin, is_technical_lead, is_proofreader, proofreader_type_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json({ ok: false, error: "פרופיל לא נמצא" }, { status: 403 });
    }

    const isAdminOrTechLead = profile.is_admin === true || profile.is_technical_lead === true;
    const canProofread = profile.is_proofreader === true && Boolean(profile.proofreader_type_id);
    if (!isAdminOrTechLead && !canProofread) {
      return NextResponse.json({ ok: false, error: "אין הרשאה" }, { status: 403 });
    }

    const typeId = (profile.proofreader_type_id as string | null) ?? null;

    let qaQuery = supabase
      .from("question_answers")
      .select(
        "id, question_id, response_text, assigned_proofreader_id, proofreader_type_id, deleted_at, questions(id, title, content, created_at)"
      )
      .eq("stage", "in_proofreading_lobby")
      .order("created_at", { ascending: true });

    if (!isAdminOrTechLead) {
      qaQuery = qaQuery.or(`proofreader_type_id.eq.${typeId},assigned_proofreader_id.eq.${user.id}`);
    }

    let legacyQuery = supabase
      .from("questions")
      .select("id, title, content, response_text, created_at, assigned_proofreader_id, proofreader_type_id")
      .eq("stage", "in_proofreading_lobby")
      .order("created_at", { ascending: true });

    if (!isAdminOrTechLead) {
      legacyQuery = legacyQuery.or(`proofreader_type_id.eq.${typeId},assigned_proofreader_id.eq.${user.id}`);
    }

    const [qaRes, qRes] = await Promise.all([qaQuery, legacyQuery]);
    if (qaRes.error) return NextResponse.json({ ok: false, error: qaRes.error.message }, { status: 500 });
    if (qRes.error) return NextResponse.json({ ok: false, error: qRes.error.message }, { status: 500 });

    const qaRows = (qaRes.data ?? []) as {
      id: string;
      question_id: string;
      response_text: string | null;
      assigned_proofreader_id: string | null;
      proofreader_type_id?: string | null;
      deleted_at?: string | null;
      questions:
        | { id: string; title?: string | null; content: string; created_at: string }
        | { id: string; title?: string | null; content: string; created_at: string }[]
        | null;
    }[];

    const activeQa = qaRows.filter((r) => !r.deleted_at);
    const fromQaIds = new Set(activeQa.map((r) => r.question_id));
    const fromQa: ProofreaderTask[] = activeQa
      .map((r) => {
        const q = Array.isArray(r.questions) ? r.questions[0] : r.questions;
        if (!q) return null;
        return {
          id: q.id ?? r.question_id,
          answer_id: r.id,
          title: q.title ?? null,
          content: q.content ?? "",
          response_text: r.response_text ?? null,
          created_at: q.created_at ?? "",
          assigned_proofreader_id: r.assigned_proofreader_id ?? null,
          proofreader_type_id: r.proofreader_type_id ?? null,
        };
      })
      .filter((x): x is ProofreaderTask => Boolean(x));

    const legacy = ((qRes.data ?? []) as ProofreaderTask[]).filter((q) => !fromQaIds.has(q.id));

    return NextResponse.json({ ok: true, tasks: [...fromQa, ...legacy] });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

