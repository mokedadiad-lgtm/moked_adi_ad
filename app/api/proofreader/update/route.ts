import { NextRequest, NextResponse } from "next/server";
import {
  audienceMatchesAskerGender,
  parseAskerAudience,
} from "@/lib/asker-audience";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUserFromBearerToken } from "@/lib/supabase/route-auth";

type UpdatePayload = {
  questionId?: string;
  answerId?: string | null;
  updates?: Record<string, unknown>;
};

function authToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromBearerToken(authToken(request));
    if (!user) return NextResponse.json({ ok: false, error: "לא מחובר" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as UpdatePayload;
    const questionId = body.questionId ?? null;
    const answerId = body.answerId ?? null;
    const updates = body.updates ?? {};
    if (!questionId || typeof updates !== "object") {
      return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_technical_lead, is_proofreader, asker_audience")
      .eq("id", user.id)
      .maybeSingle();
    const isStaff = profile?.is_admin === true || profile?.is_technical_lead === true;
    if (!isStaff && profile?.is_proofreader !== true) {
      return NextResponse.json({ ok: false, error: "אין הרשאה" }, { status: 403 });
    }

    // Claim: verify proofreader is allowed for this asker's gender
    if (
      !isStaff &&
      updates.assigned_proofreader_id === user.id
    ) {
      const { data: q } = await supabase
        .from("questions")
        .select("asker_gender")
        .eq("id", questionId)
        .maybeSingle();
      const askerGender =
        q?.asker_gender === "M" || q?.asker_gender === "F" ? q.asker_gender : null;
      const audience = parseAskerAudience(
        (profile as { asker_audience?: string } | null)?.asker_audience
      );
      if (!audienceMatchesAskerGender(audience, askerGender)) {
        return NextResponse.json(
          { ok: false, error: "משימה זו אינה מיועדת לקהל הפונים שלך" },
          { status: 403 }
        );
      }
    }

    const data = { ...updates, updated_at: new Date().toISOString() };
    const { error } = answerId
      ? await supabase.from("question_answers").update(data).eq("id", answerId)
      : await supabase.from("questions").update(data).eq("id", questionId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    // Keep parent question stage aligned with question_answers stage transitions.
    if (answerId && typeof updates.stage === "string" && updates.stage) {
      await supabase
        .from("questions")
        .update({ stage: updates.stage, updated_at: new Date().toISOString() })
        .eq("id", questionId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
