import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isAdminOrLinguisticOrTechnicalLead } from "@/lib/supabase/server-auth";
import { NextRequest, NextResponse } from "next/server";

const BUCKET = "response-pdfs";

function sanitizeFilename(s: string): string {
  return s.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 200) || "תשובה";
}

/**
 * GET: הורדת ה-PDF עם שם קובץ מתאים.
 * for=asker → דורש token תקף (נשלח למייל השואל). תשובה ו[כותרת].pdf
 * for=archive → דורש אימות אדמין/עורך לשוני. [תאריך]_[ID]_[נושא]_[תת נושא].pdf
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const forParam = request.nextUrl.searchParams.get("for") ?? "asker";
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const inline = request.nextUrl.searchParams.get("view") === "1";
  if (!id) {
    return NextResponse.json({ error: "חסר מזהה שאלה" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: question, error: qErr } = await supabase
    .from("questions")
    .select("title, short_id, topic_id, sub_topic_id, created_at, asker_download_token, asker_download_token_expires_at")
    .eq("id", id)
    .single();

  if (qErr || !question) {
    return NextResponse.json({ error: "שאלה לא נמצאה" }, { status: 404 });
  }

  const q = question as {
    title?: string | null;
    short_id?: string | null;
    topic_id?: string | null;
    sub_topic_id?: string | null;
    created_at?: string | null;
    asker_download_token?: string | null;
    asker_download_token_expires_at?: string | null;
  };

  if (forParam === "asker") {
    if (!token || token !== q.asker_download_token) {
      return NextResponse.json({ error: "קישור לא תקף או שפג תוקפו" }, { status: 403 });
    }
    const expiresAt = q.asker_download_token_expires_at ? new Date(q.asker_download_token_expires_at).getTime() : 0;
    if (Date.now() > expiresAt) {
      return NextResponse.json({ error: "קישור ההורדה פג תוקף" }, { status: 403 });
    }
  } else {
    const allowed = await isAdminOrLinguisticOrTechnicalLead();
    if (!allowed) {
      return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
    }
  }

  let topicName = "";
  let subTopicName = "";
  if (q.topic_id) {
    const { data: t } = await supabase.from("topics").select("name_he").eq("id", q.topic_id).single();
    topicName = (t as { name_he?: string } | null)?.name_he ?? "";
  }
  if (q.sub_topic_id) {
    const { data: st } = await supabase.from("sub_topics").select("name_he").eq("id", q.sub_topic_id).single();
    subTopicName = (st as { name_he?: string } | null)?.name_he ?? "";
  }

  const { data: fileData, error: downloadErr } = await supabase.storage
    .from(BUCKET)
    .download(`${id}.pdf`);

  if (downloadErr || !fileData) {
    return NextResponse.json({ error: "קובץ PDF לא נמצא" }, { status: 404 });
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const dateStr = q.created_at
    ? new Date(q.created_at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-")
    : "date";
  const safeTopic = sanitizeFilename(topicName);
  const safeSub = sanitizeFilename(subTopicName);
  const safeTitle = sanitizeFilename((q.title ?? "").trim());
  const idPart = (q.short_id ?? id.slice(0, 8)) as string;

  let filename: string;
  if (forParam === "archive") {
    filename = `${dateStr}_${idPart}_${safeTopic}_${safeSub}.pdf`;
  } else {
    filename = safeTitle ? `תשובה - ${safeTitle}.pdf` : "תשובה.pdf";
  }

  const disposition = inline ? "inline" : `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
      "Content-Length": String(buffer.length),
    },
  });
}
