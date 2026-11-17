import { NextRequest, NextResponse } from "next/server";
import {
  fetchDualProofreadersConfig,
  isConfiguredDualProofreader,
} from "@/lib/dual-proofreaders";
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

/** Dual-gate update: only response_text (and staff stage overrides). */
const ALLOWED_KEYS = new Set(["response_text", "stage", "proofreader_note", "assigned_proofreader_id"]);

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
      .select("is_admin, is_technical_lead, is_proofreader")
      .eq("id", user.id)
      .maybeSingle();
    const isStaff = profile?.is_admin === true || profile?.is_technical_lead === true;
    const cfg = await fetchDualProofreadersConfig(supabase);
    const isDual = isConfiguredDualProofreader(cfg, user.id);

    if (!isStaff && !isDual) {
      return NextResponse.json({ ok: false, error: "אין הרשאה" }, { status: 403 });
    }

    // Dual proofreaders may only edit response text while in lobby (completion goes through complete-review).
    if (!isStaff && isDual) {
      const keys = Object.keys(updates);
      if (keys.length === 0 || keys.some((k) => k !== "response_text")) {
        return NextResponse.json(
          { ok: false, error: "לסיום הגהה השתמשי בכפתורי האישור/הערה" },
          { status: 400 }
        );
      }
    }

    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (ALLOWED_KEYS.has(k)) sanitized[k] = v;
    }
    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ ok: false, error: "אין שדות לעדכון" }, { status: 400 });
    }

    const data = { ...sanitized, updated_at: new Date().toISOString() };
    const { error } = answerId
      ? await supabase.from("question_answers").update(data).eq("id", answerId)
      : await supabase.from("questions").update(data).eq("id", questionId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    if (answerId && typeof sanitized.stage === "string" && sanitized.stage) {
      await supabase
        .from("questions")
        .update({ stage: sanitized.stage, updated_at: new Date().toISOString() })
        .eq("id", questionId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
