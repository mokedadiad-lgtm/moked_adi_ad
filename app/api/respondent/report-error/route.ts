import { reportRespondentFlowErrorToAdmins } from "@/app/actions/notifications";
import { getUserFromBearerToken } from "@/lib/supabase/route-auth";
import { NextRequest, NextResponse } from "next/server";

function authToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export async function POST(request: NextRequest) {
  const user = await getUserFromBearerToken(authToken(request));
  if (!user) return NextResponse.json({ ok: false, error: "לא מחובר" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    context?: string;
    questionId?: string;
    answerId?: string | null;
    technicalDetail?: string;
  };
  if (!body.context || !body.questionId || !body.technicalDetail) {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }

  await reportRespondentFlowErrorToAdmins({
    context: body.context,
    questionId: body.questionId,
    answerId: body.answerId ?? null,
    technicalDetail: body.technicalDetail,
  });
  return NextResponse.json({ ok: true });
}
