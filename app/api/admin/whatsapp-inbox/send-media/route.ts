import { NextRequest, NextResponse } from "next/server";
import { buildWhatsappMediaPath, uploadWhatsappMedia } from "@/lib/whatsapp/mediaStorage";
import { sendWhatsappMediaReply } from "@/lib/whatsapp/inboxService";

const MAX_FILE_SIZE_BY_KIND = {
  image: 10 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 20 * 1024 * 1024,
  video: 16 * 1024 * 1024,
} as const;

function normalizeKind(v: string | null): "image" | "audio" | "document" | "video" | null {
  if (v === "image" || v === "audio" || v === "document" || v === "video") return v;
  return null;
}

function mimeAllowed(kind: "image" | "audio" | "document" | "video", mime: string): boolean {
  const mt = (mime || "").toLowerCase();
  if (kind === "image") return mt.startsWith("image/");
  if (kind === "audio") return mt.startsWith("audio/");
  if (kind === "video") return mt.startsWith("video/");
  if (kind === "document") {
    return (
      mt === "application/pdf" ||
      mt === "application/msword" ||
      mt === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mt === "text/plain"
    );
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const conversationId = String(form.get("conversationId") ?? "").trim();
    const kind = normalizeKind(String(form.get("kind") ?? "").trim());
    const captionRaw = String(form.get("caption") ?? "");
    const caption = captionRaw.trim() || null;
    const fileEntry = form.get("file");
    if (!conversationId || !kind || !(fileEntry instanceof File)) {
      return NextResponse.json({ ok: false, error: "conversationId/kind/file נדרשים" }, { status: 400 });
    }
    if (fileEntry.size <= 0 || fileEntry.size > MAX_FILE_SIZE_BY_KIND[kind]) {
      const maxMb = Math.round(MAX_FILE_SIZE_BY_KIND[kind] / (1024 * 1024));
      return NextResponse.json({ ok: false, error: `הקובץ גדול מדי עבור ${kind}. מקסימום ${maxMb}MB` }, { status: 400 });
    }
    if (!mimeAllowed(kind, fileEntry.type)) {
      return NextResponse.json({ ok: false, error: "סוג קובץ לא נתמך לסוג המדיה שנבחר" }, { status: 400 });
    }

    const bytes = Buffer.from(await fileEntry.arrayBuffer());
    const storagePath = buildWhatsappMediaPath({
      direction: "outbound",
      conversationId,
      mediaType: kind,
      mimeType: fileEntry.type,
      fileName: fileEntry.name,
    });

    const up = await uploadWhatsappMedia({
      path: storagePath,
      bytes,
      mimeType: fileEntry.type || "application/octet-stream",
    });
    if (!up.ok) {
      return NextResponse.json({ ok: false, error: up.error }, { status: 500 });
    }

    const sent = await sendWhatsappMediaReply({
      conversationId,
      mediaKind: kind,
      storagePath,
      mimeType: fileEntry.type || null,
      fileName: fileEntry.name || null,
      caption,
    });
    if (!sent.ok) {
      return NextResponse.json({ ok: false, error: sent.error ?? "לא הצלחנו לשלוח את הקובץ כרגע. נסו שוב." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
