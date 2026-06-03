import { notifyLobbyNewQuestion } from "@/app/actions/notifications";
import { getUserFromBearerToken } from "@/lib/supabase/route-auth";
import { NextRequest, NextResponse } from "next/server";

function authToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export async function POST(request: NextRequest) {
  const user = await getUserFromBearerToken(authToken(request));
  if (!user) return NextResponse.json({ ok: false, error: "לא מחובר" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { questionId?: string };
  const questionId = body.questionId ?? null;
  if (!questionId) {
    return NextResponse.json({ ok: false, error: "חסר מזהה שאלה" }, { status: 400 });
  }

  const result = await notifyLobbyNewQuestion(questionId);
  return NextResponse.json(result);
}
