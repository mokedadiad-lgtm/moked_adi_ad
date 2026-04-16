import { getSupabaseAdmin } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const BUCKET = "response-pdfs";

function sanitizeFilename(s: string): string {
  return s.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 200) || "תשובה";
}

/**
 * GET: הורדת ה-PDF עם שם קובץ מתאים.
 * for=asker → תשובה ו[כותרת השאלה].pdf
 * for=archive → [תאריך]_[ID]_[נושא]_[תת נושא].pdf
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const forParam = request.nextUrl.searchParams.get("for") ?? "asker";
  const inline = request.nextUrl.searchParams.get("view") === "1";
  if (!id) {
    return NextResponse.json({ error: "חסר מזהה שאלה" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: question, error: qErr } = await supabase
    .from("questions")
    .select("title, short_id, topic_id, sub_topic_id, created_at")
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
  };

  type TopicRef = { name_he?: string } | { name_he?: string }[] | null;
  const { data: qaRows } = await supabase
    .from("question_answers")
    .select("topic_id, sub_topic_id, topics(name_he), sub_topics(name_he)")
    .eq("question_id", id);
  const qaList = (qaRows ?? []) as { topics?: TopicRef; sub_topics?: TopicRef }[];

  let topicName = "";
  let subTopicName = "";
  if (qaList.length > 0) {
    const topicNames: string[] = [];
    const subNames: string[] = [];
    for (const row of qaList) {
      const t = row.topics;
      const tn = t == null ? "" : Array.isArray(t) ? (t[0]?.name_he ?? "") : (t.name_he ?? "");
      if (tn) topicNames.push(tn);
      const st = row.sub_topics;
      const sn = st == null ? "" : Array.isArray(st) ? (st[0]?.name_he ?? "") : (st.name_he ?? "");
      if (sn) subNames.push(sn);
    }
    topicName = [...new Set(topicNames)].join(" ");
    subTopicName = [...new Set(subNames)].join(" ");
  }
  if (!topicName && q.topic_id) {
    const { data: t } = await supabase.from("topics").select("name_he").eq("id", q.topic_id).single();
    topicName = (t as { name_he?: string } | null)?.name_he ?? "";
  }
  if (!subTopicName && q.sub_topic_id) {
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
      // Aggressive anti-cache for regenerated PDFs.
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
