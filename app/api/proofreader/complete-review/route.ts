import { NextRequest, NextResponse } from "next/server";
import {
  fetchDualProofreadersConfig,
  isConfiguredDualProofreader,
  type ProofreaderReviewOutcome,
} from "@/lib/dual-proofreaders";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUserFromBearerToken } from "@/lib/supabase/route-auth";

type Body = {
  questionId?: string;
  answerId?: string | null;
  outcome?: ProofreaderReviewOutcome;
  note?: string | null;
  responseText?: string | null;
};

function authToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromBearerToken(authToken(request));
    if (!user) {
      return NextResponse.json({ ok: false, error: "לא מחובר" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const questionId = body.questionId ?? null;
    const answerId = body.answerId ?? null;
    const outcome = body.outcome;
    const note = (body.note ?? "").trim();
    const responseText =
      typeof body.responseText === "string" ? body.responseText.trim() || null : null;

    if (!questionId || (outcome !== "approved" && outcome !== "noted")) {
      return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
    }
    if (outcome === "noted" && !note) {
      return NextResponse.json({ ok: false, error: "יש לכתוב הערה למנהלת" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const cfg = await fetchDualProofreadersConfig(supabase);
    if (!cfg.proofreader_a_id || !cfg.proofreader_b_id) {
      return NextResponse.json(
        { ok: false, error: "טרם הוגדרו שתי המגיהות הקבועות במערכת" },
        { status: 400 }
      );
    }
    if (!isConfiguredDualProofreader(cfg, user.id)) {
      return NextResponse.json({ ok: false, error: "אין הרשאה — אינך אחת משתי המגיהות הקבועות" }, { status: 403 });
    }

    if (responseText != null) {
      if (answerId) {
        await supabase
          .from("question_answers")
          .update({ response_text: responseText, updated_at: new Date().toISOString() })
          .eq("id", answerId)
          .eq("question_id", questionId)
          .eq("stage", "in_proofreading_lobby");
      }
      await supabase
        .from("questions")
        .update({ response_text: responseText, updated_at: new Date().toISOString() })
        .eq("id", questionId)
        .eq("stage", "in_proofreading_lobby");
    }

    const { error: upsertErr } = await supabase.from("question_proofreader_reviews").upsert(
      {
        question_id: questionId,
        answer_id: answerId,
        proofreader_id: user.id,
        outcome,
        note: note || null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "question_id,proofreader_id" }
    );

    if (upsertErr) {
      return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 400 });
    }

    const { data: reviews } = await supabase
      .from("question_proofreader_reviews")
      .select("proofreader_id, outcome, note, completed_at")
      .eq("question_id", questionId)
      .in("proofreader_id", [cfg.proofreader_a_id, cfg.proofreader_b_id]);

    const reviewRows = reviews ?? [];
    const moved = reviewRows.length >= 2;

    if (moved) {
      const ids = [cfg.proofreader_a_id, cfg.proofreader_b_id];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name_he")
        .in("id", ids);
      const names = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, (p.full_name_he ?? "").trim() || "מגיהה"])
      );

      const sorted = [...reviewRows].sort(
        (a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
      );
      const combinedNote = sorted
        .map((r) => {
          const name = names[r.proofreader_id] ?? "מגיהה";
          const detail =
            r.note?.trim() ||
            (r.outcome === "approved" ? "אושר" : "הערה");
          return `${name}: ${detail}`;
        })
        .join("\n");

      const now = new Date().toISOString();
      if (answerId) {
        await supabase
          .from("question_answers")
          .update({
            stage: "in_linguistic_review",
            proofreader_note: combinedNote,
            updated_at: now,
          })
          .eq("id", answerId)
          .eq("question_id", questionId);
      }
      await supabase
        .from("questions")
        .update({
          stage: "in_linguistic_review",
          proofreader_note: combinedNote,
          updated_at: now,
        })
        .eq("id", questionId);
    }

    return NextResponse.json({
      ok: true,
      moved_to_linguistic: moved,
      review_count: reviewRows.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
