import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  parseResponseRich,
  getFootnoteIdsInOrder,
  buildStoredResponse,
  rewriteFootnoteIds,
} from "@/lib/response-text";
import { NextResponse } from "next/server";

const ANSWER_SEP = '<div class="answer-sep" style="margin:1em 0; padding:0.5em 0; border-top:1px solid #ccc; text-align:center;">——</div>';

/**
 * POST: מיזוג כל התשובות של השאלה ל-response_text אחד ב-questions.
 * שומר HTML (מודגש, כותרות, הערות שוליים) – לא ממיר ל-plain text.
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
  // טוענים רק עמודות שנדרשות למיזוג – בלי join, כדי לקבל שורה אחת לכל question_answer
  const { data: answers, error: fetchErr } = await supabase
    .from("question_answers")
    .select("id, response_text, deleted_at")
    .eq("question_id", id)
    .in("stage", ["in_linguistic_review", "ready_for_sending", "sent_archived"])
    .order("created_at", { ascending: true });

  if (fetchErr) {
    return NextResponse.json({ error: "שגיאה בטעינת תשובות" }, { status: 500 });
  }
  const list = ((answers ?? []) as {
    id: string;
    response_text: string | null;
    deleted_at?: string | null;
  }[]).filter((a) => !a.deleted_at);

  if (list.length < 2) {
    return NextResponse.json(
      { error: "מיזוג רלוונטי רק לשאלה עם לפחות שתי תשובות" },
      { status: 400 }
    );
  }

  const bodyParts: string[] = [];
  const allFootnotes: { id: string; text: string }[] = [];

  for (let i = 0; i < list.length; i++) {
    const a = list[i]!;
    const { bodyHtml, footnotes } = parseResponseRich(a.response_text ?? null);
    const trimmed = bodyHtml.trim();
    if (i === 0) {
      const orderedIds = getFootnoteIdsInOrder(trimmed);
      const fnMap = new Map(footnotes.map((f) => [f.id, f.text ?? ""]));
      for (const fid of orderedIds) allFootnotes.push({ id: fid, text: fnMap.get(fid) ?? "" });
      bodyParts.push(trimmed);
    } else {
      const prefix = `m${i + 1}-`;
      const { bodyHtml: rewrittenBody, footnotes: rewrittenFns } = rewriteFootnoteIds(trimmed, footnotes, prefix);
      bodyParts.push(rewrittenBody);
      allFootnotes.push(...rewrittenFns);
    }
  }

  const mergedBodyHtml = bodyParts.join(ANSWER_SEP);
  const mergedStored = buildStoredResponse(mergedBodyHtml, allFootnotes);

  const { error: updateErr } = await supabase
    .from("questions")
    .update({
      response_text: mergedStored,
      answers_merged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: "שגיאה בשמירת המיזוג" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
