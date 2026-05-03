import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendPdfToAsker } from "@/lib/email";
import { NextResponse } from "next/server";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

function buildAskerPdfWhatsAppBody(downloadUrl: string, _questionTitle: string): string {
  return `שלום וברכה,

שמחים לעדכן כי צוות אסק מי פלוס השיב לפנייתך.
להורדת קובץ התשובה (PDF) לחץ/י על הקישור:
${downloadUrl}

הערה: המידע בתשובה הינו כללי ואינו מהווה תחליף לייעוץ מקצועי אישי.`;
}

/**
 * Meta URL-button templates use a fixed website prefix in Manager + one dynamic segment {{1}}.
 * Send only the path + query relative to NEXT_PUBLIC_APP_URL (same origin as downloadUrl).
 */
function askerPdfUrlButtonSuffix(absoluteDownloadUrl: string): string {
  try {
    const u = new URL(absoluteDownloadUrl);
    const base = new URL(APP_URL);
    if (u.origin === base.origin) {
      const path = u.pathname.replace(/^\//, "");
      return path + u.search;
    }
  } catch {
    /* ignore */
  }
  return absoluteDownloadUrl;
}

async function sendAskerPdfWhatsApp(
  phone: string,
  downloadUrl: string,
  questionTitle: string,
  idempotencyKey: string
) {
  const { sendMetaWhatsAppInitiatedWithLog } = await import("@/lib/whatsapp/outbound");
  const waText = buildAskerPdfWhatsAppBody(downloadUrl, questionTitle);
  const buttonSuffix = askerPdfUrlButtonSuffix(downloadUrl);
  return sendMetaWhatsAppInitiatedWithLog(phone, {
    templateKey: "asker_pdf_sent",
    channel_event: "asker_pdf_sent",
    idempotency_key: idempotencyKey,
    /** Approved template: static body text + CTA button with dynamic URL suffix */
    bodyParameters: [],
    buttonDynamicParam: buttonSuffix,
    legacyText: waText,
  });
}

/**
 * POST: שולח את התשובה (קישור ל-PDF) לשואל לפי asker_delivery_preference — מייל, וואטסאפ, או שניהם.
 * מעדכן שלב ל-sent_archived ו-sent_at.
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
    .select("asker_email, asker_phone, asker_delivery_preference, pdf_url, stage, title")
    .eq("id", id)
    .single();

  if (fetchError || !question) {
    return NextResponse.json({ error: "שאלה לא נמצאה" }, { status: 404 });
  }

  const pdfUrl = question.pdf_url as string | null;
  if (!pdfUrl) {
    return NextResponse.json(
      { error: "חסר קובץ PDF. יש ליצור PDF לפני שליחה." },
      { status: 400 }
    );
  }

  const rawPref = question.asker_delivery_preference as string | null | undefined;
  const delivery = rawPref ?? "email";

  const email = (question.asker_email as string | null)?.trim() ?? "";
  const phone = (question.asker_phone as string | null)?.trim() ?? "";
  const downloadUrlForAsker = `${APP_URL}/api/questions/${id}/pdf/download?for=asker`;
  const questionTitle = (question.title as string | null)?.trim() ?? "";

  if (delivery === "email") {
    if (!email) {
      return NextResponse.json(
        { error: "לא הוזנה כתובת מייל לשואל. לא ניתן לשלוח." },
        { status: 400 }
      );
    }
    const sendResult = await sendPdfToAsker(email, downloadUrlForAsker, questionTitle);
    if (!sendResult.ok) {
      return NextResponse.json(
        { error: sendResult.error ?? "שליחת המייל נכשלה. נסה שוב או בדוק הגדרות Resend." },
        { status: 500 }
      );
    }
  } else if (delivery === "whatsapp") {
    if (!phone) {
      return NextResponse.json(
        { error: "לא הוזן מספר וואטסאפ לשואל. לא ניתן לשלוח." },
        { status: 400 }
      );
    }
    const waResult = await sendAskerPdfWhatsApp(phone, downloadUrlForAsker, questionTitle, `asker_pdf_${id}`);
    if (!waResult.ok) {
      return NextResponse.json(
        { error: waResult.error ?? "שליחת וואטסאפ נכשלה. בדוק הגדרות Meta." },
        { status: 500 }
      );
    }
  } else if (delivery === "both") {
    if (!email) {
      return NextResponse.json(
        { error: "לא הוזנה כתובת מייל (נדרש לעדפת ״גם וגם״)." },
        { status: 400 }
      );
    }
    if (!phone) {
      return NextResponse.json(
        { error: "לא הוזן מספר וואטסאפ (נדרש לעדפת ״גם וגם״)." },
        { status: 400 }
      );
    }
    const waResult = await sendAskerPdfWhatsApp(phone, downloadUrlForAsker, questionTitle, `asker_pdf_${id}_wa`);
    if (!waResult.ok) {
      return NextResponse.json(
        { error: waResult.error ?? "שליחת וואטסאפ נכשלה. בדוק הגדרות Meta." },
        { status: 500 }
      );
    }
    const sendResult = await sendPdfToAsker(email, downloadUrlForAsker, questionTitle);
    if (!sendResult.ok) {
      return NextResponse.json(
        { error: sendResult.error ?? "שליחת המייל נכשלה (הודעת וואטסאפ כבר נשלחה). נסה שוב או בדוק Resend." },
        { status: 500 }
      );
    }
  } else {
    return NextResponse.json({ error: "העדפת משלוח לא תקינה" }, { status: 400 });
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
      { error: "ההודעות נשלחו אך עדכון הארכיון נכשל." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
