import { getSupabaseAdmin } from "@/lib/supabase/server";
import { responseToStructured, responseToStructuredForPdf } from "@/lib/response-text";
import { responseToPlainText } from "@/lib/response-text";
import { renderPdfFromHtml } from "@/lib/pdf-from-html";
import { NextResponse } from "next/server";
import React from "react";
import * as ReactPDF from "@react-pdf/renderer";
import { ResponsePdfDocument, type ResponsePdfProps } from "@/lib/pdf-response-document";
import { getPdfLogoAssets } from "@/lib/pdf-brand-assets";
import { ensureHeeboFontFiles, registerHeeboFont } from "@/lib/pdf-register-font";

const BUCKET = "response-pdfs";

export const maxDuration = 60;

/** Build merged body HTML and footnotes from multiple answers (renumber footnote refs). */
function mergeAnswersForPdf(
  answers: { response_text: string | null; topic_name_he?: string | null; sub_topic_name_he?: string | null; respondent_name?: string | null }[]
): { bodyHtmlForPdf: string; footnotes: string[]; mergedPlainText: string } {
  const allFootnotes: string[] = [];
  const bodyParts: string[] = [];
  const plainParts: string[] = [];
  let offset = 0;
  for (const a of answers) {
    const { bodyHtmlForPdf, footnotes } = responseToStructuredForPdf(a.response_text ?? null);
    // לא מציגים כותרת עם נושא/תת-נושא או שם המשיב/ה בתחילת התשובה ב-PDF
    const heading = null;
    const renumberedBody = bodyHtmlForPdf.replace(
      /<sup[^>]*class="fn-ref"[^>]*>(\d+)<\/sup>/gi,
      (_, n) => `<sup class="fn-ref">${Number(n) + offset}</sup>`
    );
    for (let i = 0; i < footnotes.length; i++) {
      allFootnotes.push(`${offset + i + 1}. ${footnotes[i]!.replace(/^\d+\.\s*/, "")}`);
    }
    offset += footnotes.length;
    if (heading) bodyParts.push(`<h3 class="answer-heading">${escapeHtmlForPdf(heading)}</h3>`);
    bodyParts.push(renumberedBody);
    plainParts.push(responseToPlainText(a.response_text ?? null));
  }
  const mergedPlainText = plainParts.join("\n\n——\n\n");
  return {
    bodyHtmlForPdf: bodyParts.join("<div class=\"answer-sep\"></div>"),
    footnotes: allFootnotes,
    mergedPlainText,
  };
}

function escapeHtmlForPdf(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * ייצור PDF: מנסה קודם מ-HTML (Puppeteer, עברית תקינה). אם נכשל – fallback ל-react-pdf.
 * כשקיימות תשובות ב-question_answers – מאחד את כולן ל-PDF אחד ומעדכן questions.response_text לארכיון.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "חסר מזהה שאלה" }, { status: 400 });
  }

  let question: {
    content: string;
    response_text: string | null;
    created_at: string | null;
    stage?: string;
    answers_merged_at?: string | null;
    linguistic_signature?: string | null;
  };
  try {
    const supabase = getSupabaseAdmin();
    let data: (typeof question) | null = null;
    let error: { message?: string } | null = null;
    const withSig = await supabase
      .from("questions")
      .select("content, response_text, created_at, stage, answers_merged_at, linguistic_signature")
      .eq("id", id)
      .single();
    if (
      withSig.error &&
      (withSig.error.message ?? "").toLowerCase().includes("linguistic_signature")
    ) {
      const noSig = await supabase
        .from("questions")
        .select("content, response_text, created_at, stage, answers_merged_at")
        .eq("id", id)
        .single();
      data = noSig.data ? { ...noSig.data, linguistic_signature: null as string | null } : null;
      error = noSig.error;
    } else {
      data = withSig.data;
      error = withSig.error;
    }
    if (error || !data) {
      return NextResponse.json({ error: "שאלה לא נמצאה" }, { status: 404 });
    }
    question = data;
  } catch (e) {
    console.error("PDF: Supabase error", e);
    return NextResponse.json({ error: "שגיאה בטעינת השאלה" }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const { data: answersRows } = await supabase
    .from("question_answers")
    .select("response_text, assigned_respondent_id, topics(name_he), sub_topics(name_he), deleted_at")
    .eq("question_id", id)
    .in("stage", ["in_linguistic_review", "ready_for_sending", "sent_archived"])
    .order("created_at", { ascending: true });

  const answers = ((answersRows ?? []) as {
    response_text: string | null;
    assigned_respondent_id: string | null;
    topics?: { name_he?: string } | null;
    sub_topics?: { name_he?: string } | null;
    deleted_at?: string | null;
  }[]).filter((a) => !a.deleted_at);

  let respondentNames: Record<string, string> = {};
  if (answers.length > 0) {
    const respondentIds = [...new Set(answers.map((a) => a.assigned_respondent_id).filter(Boolean))] as string[];
    if (respondentIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name_he").in("id", respondentIds);
      if (profs) respondentNames = Object.fromEntries(profs.map((p) => [p.id, p.full_name_he ?? ""]));
    }
  }

  let bodyHtmlForPdf: string;
  let footnotes: string[];
  let mergedPlainForArchive: string | null = null;

  // כשמספר תשובות > 1 – משתמשים רק במיזוג שבוצע לפני העריכה הלשונית (merge API). אין שלב מיזוג נפרד ל-PDF.
  if (answers.length > 1) {
    if (!question.answers_merged_at) {
      return NextResponse.json(
        { error: "נא לבצע מיזוג תשובות קודם (כפתור מיזוג תשובות בעמוד העריכה הלשונית)" },
        { status: 400 }
      );
    }
    const single = responseToStructuredForPdf(question.response_text ?? null);
    bodyHtmlForPdf = single.bodyHtmlForPdf;
    footnotes = single.footnotes;
    mergedPlainForArchive = question.response_text;
  } else if (answers.length === 1) {
    const merged = mergeAnswersForPdf(
      answers.map((a) => ({
        response_text: a.response_text,
        topic_name_he: a.topics?.name_he ?? null,
        sub_topic_name_he: a.sub_topics?.name_he ?? null,
        respondent_name: a.assigned_respondent_id ? (respondentNames[a.assigned_respondent_id]?.trim() || null) : null,
      }))
    );
    bodyHtmlForPdf = merged.bodyHtmlForPdf;
    footnotes = merged.footnotes;
    /** לא לשמור mergedPlainText ב־questions.response_text — זה דורס HTML עשיר (בולד/כותרות/הערות) אחרי יצירת PDF */
    mergedPlainForArchive = null;
  } else {
    const single = responseToStructuredForPdf(question.response_text ?? null);
    bodyHtmlForPdf = single.bodyHtmlForPdf;
    footnotes = single.footnotes;
  }

  const pdfGeneratedAt = new Date().toISOString();
  const pdfOptions = {
    questionContent: question.content,
    bodyHtmlForPdf,
    footnotes,
    createdAt: pdfGeneratedAt,
    linguisticSignature: question.linguistic_signature ?? null,
  };

  let buffer: Buffer;
  try {
    buffer = await renderPdfFromHtml(pdfOptions);
  } catch (e) {
    console.warn("PDF from HTML failed, using react-pdf fallback:", e);
    const responseTextForFallback = mergedPlainForArchive ?? question.response_text;
    try {
      const { bodyPlain } = responseToStructured(responseTextForFallback ?? null);
      await ensureHeeboFontFiles();
      registerHeeboFont();
      const doc = React.createElement(ResponsePdfDocument, {
        ...pdfOptions,
        bodyPlain,
        ...getPdfLogoAssets(),
      } as ResponsePdfProps);
      buffer = await ReactPDF.renderToBuffer(doc as React.ReactElement<ReactPDF.DocumentProps>);
    } catch (fallbackErr) {
      console.error("PDF render error:", fallbackErr);
      return NextResponse.json(
        {
          error: "שגיאה ביצירת PDF",
          details: fallbackErr instanceof Error ? fallbackErr.message : "",
        },
        { status: 500 }
      );
    }
  }

  const filename = `${id}.pdf`;
  await supabase.storage.from(BUCKET).remove([filename]);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    console.error("PDF upload error:", uploadError);
    return NextResponse.json(
      { error: "שגיאה בשמירת PDF. וודא שקיים bucket 'response-pdfs' ב-Storage." },
      { status: 500 }
    );
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  const baseUrl = urlData.publicUrl;
  const pdfUrl = `${baseUrl}?v=${Date.now()}`;

  const updatePayload: { pdf_url: string; updated_at: string; pdf_generated_at: string; response_text?: string; stage?: string } = {
    pdf_url: pdfUrl,
    updated_at: pdfGeneratedAt,
    pdf_generated_at: pdfGeneratedAt,
  };
  if (mergedPlainForArchive != null) {
    updatePayload.response_text = mergedPlainForArchive;
  } else if (answers.length === 1) {
    /** מסנכרן את questions.response_text עם ה-HTML העשיר מ־question_answers — אחרת רענון UI נופל לטקסט שטוח ישן ב־questions */
    const rt = answers[0]?.response_text;
    if (rt != null && String(rt).trim() !== "") {
      updatePayload.response_text = rt;
    }
  }
  if (question.stage === "in_linguistic_review") {
    updatePayload.stage = "ready_for_sending";
  }

  await supabase.from("questions").update(updatePayload).eq("id", id);

  // לוח הבקרה מציג סטטוס מתוך question_answers – מעדכנים גם שם כדי שהשאלה תעבור ל"מוכן לשליחה"
  await supabase
    .from("question_answers")
    .update({
      stage: "ready_for_sending",
      pdf_url: pdfUrl,
      pdf_generated_at: pdfGeneratedAt,
      updated_at: pdfGeneratedAt,
    })
    .eq("question_id", id)
    .in("stage", ["in_linguistic_review", "ready_for_sending"])
    .is("deleted_at", null);

  return NextResponse.json({ pdf_url: pdfUrl, pdf_generated_at: pdfGeneratedAt });
}
