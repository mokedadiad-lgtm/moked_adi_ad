import { getSupabaseAdmin } from "@/lib/supabase/server";
import { responseToStructured, responseToStructuredForPdf } from "@/lib/response-text";
import { renderPdfFromHtml } from "@/lib/pdf-from-html";
import { NextResponse } from "next/server";
import React from "react";
import * as ReactPDF from "@react-pdf/renderer";
import { ResponsePdfDocument, type ResponsePdfProps } from "@/lib/pdf-response-document";
import { ensureHeeboFontFiles, registerHeeboFont } from "@/lib/pdf-register-font";

const BUCKET = "response-pdfs";

export const maxDuration = 60;

/**
 * ייצור PDF: מנסה קודם מ-HTML (Puppeteer, עברית תקינה). אם נכשל – fallback ל-react-pdf.
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
  };
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("questions")
      .select("content, response_text, created_at, stage")
      .eq("id", id)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "שאלה לא נמצאה" }, { status: 404 });
    }
    question = data;
  } catch (e) {
    console.error("PDF: Supabase error", e);
    return NextResponse.json({ error: "שגיאה בטעינת השאלה" }, { status: 500 });
  }

  const { bodyHtmlForPdf, footnotes } = responseToStructuredForPdf(question.response_text ?? null);
  const pdfGeneratedAt = new Date().toISOString();
  const pdfOptions = {
    questionContent: question.content,
    bodyHtmlForPdf,
    footnotes,
    createdAt: pdfGeneratedAt,
  };

  let buffer: Buffer;
  try {
    buffer = await renderPdfFromHtml(pdfOptions);
  } catch (e) {
    console.warn("PDF from HTML failed, using react-pdf fallback:", e);
    try {
      const { bodyPlain } = responseToStructured(question.response_text ?? null);
      await ensureHeeboFontFiles();
      registerHeeboFont();
      const doc = React.createElement(ResponsePdfDocument, {
        ...pdfOptions,
        bodyPlain,
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
  const supabase = getSupabaseAdmin();

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

  const updatePayload: { pdf_url: string; updated_at: string; pdf_generated_at: string; stage?: string } = {
    pdf_url: pdfUrl,
    updated_at: pdfGeneratedAt,
    pdf_generated_at: pdfGeneratedAt,
  };
  if (question.stage === "in_linguistic_review") {
    updatePayload.stage = "ready_for_sending";
  }

  await supabase.from("questions").update(updatePayload).eq("id", id);

  return NextResponse.json({ pdf_url: pdfUrl, pdf_generated_at: pdfGeneratedAt });
}
