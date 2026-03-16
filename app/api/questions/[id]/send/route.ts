import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendPdfToAsker } from "@/lib/email";
import { NextResponse } from "next/server";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

/**
 * POST: שולח את התשובה (קישור ל-PDF) למייל השואל, מעדכן שלב ל-sent_archived ומעדכן sent_at.
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
  const { data: question, error: fetchError } = await supabase
    .from("questions")
    .select("asker_email, pdf_url, stage, title")
    .eq("id", id)
    .single();

  if (fetchError || !question) {
    return NextResponse.json({ error: "שאלה לא נמצאה" }, { status: 404 });
  }

  const email = (question.asker_email as string | null)?.trim();
  const pdfUrl = question.pdf_url as string | null;

  if (!email) {
    return NextResponse.json(
      { error: "לא הוזנה כתובת מייל לשואל. לא ניתן לשלוח." },
      { status: 400 }
    );
  }
  if (!pdfUrl) {
    return NextResponse.json(
      { error: "חסר קובץ PDF. יש ליצור PDF לפני שליחה." },
      { status: 400 }
    );
  }

  const downloadUrlForAsker = `${APP_URL}/api/questions/${id}/pdf/download?for=asker`;
  const questionTitle = (question.title as string | null)?.trim() ?? "";
  const sendResult = await sendPdfToAsker(email, downloadUrlForAsker, questionTitle);
  if (!sendResult.ok) {
    return NextResponse.json(
      { error: sendResult.error ?? "שליחת המייל נכשלה. נסה שוב או בדוק הגדרות Resend." },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabase
    .from("questions")
    .update({
      stage: "sent_archived",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  await supabase
    .from("question_answers")
    .update({ stage: "sent_archived", updated_at: new Date().toISOString() })
    .eq("question_id", id);

  if (updateError) {
    console.error("Update question after send:", updateError);
    return NextResponse.json(
      { error: "המייל נשלח אך עדכון הארכיון נכשל." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
