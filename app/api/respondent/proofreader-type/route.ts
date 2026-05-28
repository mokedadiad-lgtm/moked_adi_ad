import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUserFromBearerToken } from "@/lib/supabase/route-auth";

function authToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromBearerToken(authToken(request));
    if (!user) return NextResponse.json({ ok: false, error: "לא מחובר" }, { status: 401 });

    const questionId = request.nextUrl.searchParams.get("questionId");
    if (!questionId) {
      return NextResponse.json({ ok: false, error: "חסר מזהה שאלה" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: q } = await supabase.from("questions").select("topic_id").eq("id", questionId).single();
    if (q?.topic_id) {
      const { data: topic } = await supabase
        .from("topics")
        .select("proofreader_type_id")
        .eq("id", q.topic_id)
        .single();
      if (topic?.proofreader_type_id) {
        return NextResponse.json({ ok: true, proofreader_type_id: topic.proofreader_type_id });
      }
    }
    const { data: first } = await supabase
      .from("proofreader_types")
      .select("id")
      .order("sort_order")
      .limit(1)
      .single();
    return NextResponse.json({ ok: true, proofreader_type_id: first?.id ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
