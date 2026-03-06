import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendPdfToAsker } from "@/lib/email";
import { requireAdminOrLinguistic } from "@/lib/auth-api";
import { NextResponse } from "next/server";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

/**
 * POST: שולח את התשובה (קישור ל-PDF) למייל השואל, מעדכן שלב ל-sent_archived ומעדכן sent_at.
 * דורש אימות: אדמין או עורך לשוני.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOrLinguistic(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

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

  const crypto = await import("crypto");
  const askerDownloadToken = crypto.randomBytes(32).toString("hex");
  const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  const downloadUrlForAsker = `${APP_URL}/api/questions/${id}/pdf/download?for=asker&token=${askerDownloadToken}`;
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
      asker_download_token: askerDownloadToken,
      asker_download_token_expires_at: tokenExpiresAt,
    })
    .eq("id", id);

  if (updateError) {
    console.error("Update question after send:", updateError);
    return NextResponse.json(
      { error: "המייל נשלח אך עדכון הארכיון נכשל." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
