import { NextRequest, NextResponse } from "next/server";
import { sendReminderToRespondent, sendReminderToProofreaders } from "@/app/admin/actions";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const questionId = typeof body.questionId === "string" ? body.questionId : null;
    const target = body.target as "respondent" | "proofreader" | undefined;

    if (!questionId || (target !== "respondent" && target !== "proofreader")) {
      return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
    }

    console.log("[api/admin/reminder] start", { questionId, target });

    const result =
      target === "respondent"
        ? await sendReminderToRespondent(questionId)
        : await sendReminderToProofreaders(questionId);

    if (!result.ok) {
      console.error("[api/admin/reminder] failed", { questionId, target, error: result.error });
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    console.log("[api/admin/reminder] success", { questionId, target });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/admin/reminder] unexpected error", e);
    return NextResponse.json({ ok: false, error: "שגיאה בשרת" }, { status: 500 });
  }
}

