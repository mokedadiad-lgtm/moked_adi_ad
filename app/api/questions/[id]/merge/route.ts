import { getSupabaseAdmin } from "@/lib/supabase/server";
import { responseToPlainText } from "@/lib/response-text";
import { NextResponse } from "next/server";

/**
 * POST: מיזוג כל התשובות של השאלה ל-response_text אחד ב-questions.
 * נדרש לפני יצירת PDF כשהשאלה נשלחה למספר משיבים.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "חסר מזהה שאלה" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: answers, error: fetchErr } = await supabase
    .from("question_answers")
    .select("response_text, assigned_respondent_id, topics(name_he), sub_topics(name_he), deleted_at")
    .eq("question_id", id)
    .in("stage", ["in_linguistic_review", "ready_for_sending", "sent_archived"])
    .order("created_at", { ascending: true });

  if (fetchErr) {
    return NextResponse.json({ error: "שגיאה בטעינת תשובות" }, { status: 500 });
  }
  const list = ((answers ?? []) as {
    response_text: string | null;
    assigned_respondent_id: string | null;
    topics?: { name_he?: string } | null;
    sub_topics?: { name_he?: string } | null;
    deleted_at?: string | null;
  }[]).filter((a) => !a.deleted_at);

  if (list.length < 2) {
    return NextResponse.json(
      { error: "מיזוג רלוונטי רק לשאלה עם לפחות שתי תשובות" },
      { status: 400 }
    );
  }

  let respondentNames: Record<string, string> = {};
  const respondentIds = [...new Set(list.map((a) => a.assigned_respondent_id).filter(Boolean))] as string[];
  if (respondentIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name_he").in("id", respondentIds);
    if (profs) respondentNames = Object.fromEntries(profs.map((p) => [p.id, p.full_name_he ?? ""]));
  }

  const parts: string[] = [];
  for (const a of list) {
    const titleParts = [a.topics?.name_he, a.sub_topics?.name_he].filter(Boolean);
    const title = titleParts.length ? titleParts.join(" · ") : null;
    const subTitle = a.assigned_respondent_id ? respondentNames[a.assigned_respondent_id]?.trim() : null;
    const heading = [title, subTitle].filter(Boolean).join(" — ");
    const body = responseToPlainText(a.response_text ?? null);
    if (heading) parts.push(heading + "\n\n" + body);
    else parts.push(body);
  }
  const mergedText = parts.join("\n\n——\n\n");

  const { error: updateErr } = await supabase
    .from("questions")
    .update({
      response_text: mergedText,
      answers_merged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: "שגיאה בשמירת המיזוג" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
