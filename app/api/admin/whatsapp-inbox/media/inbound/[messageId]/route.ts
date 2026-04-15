import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  buildWhatsappMediaPath,
  createWhatsappMediaSignedUrl,
  uploadWhatsappMedia,
} from "@/lib/whatsapp/mediaStorage";
import { downloadMetaMedia, fetchMetaMediaMetadata } from "@/lib/whatsapp/meta";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await ctx.params;
  if (!isUuid(messageId)) {
    return NextResponse.json({ ok: false, error: "invalid message id" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("whatsapp_inbound_messages")
    .select("id, conversation_id, message_type, media_id, media_storage_path, media_mime_type, media_file_name, payload")
    .eq("id", messageId)
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json({ ok: false, error: "message not found" }, { status: 404 });
  }

  const existingPath = (row as { media_storage_path?: string | null }).media_storage_path ?? null;
  if (existingPath) {
    const signed = await createWhatsappMediaSignedUrl(existingPath, 60 * 60);
    if (signed) return NextResponse.redirect(signed, { status: 302 });
  }

  const messageType = ((row as { message_type?: string | null }).message_type ?? "") as string;
  const payload = ((row as { payload?: Record<string, unknown> }).payload ?? {}) as Record<string, unknown>;
  const mediaPayload =
    payload[messageType] && typeof payload[messageType] === "object"
      ? (payload[messageType] as Record<string, unknown>)
      : null;

  const mediaId =
    ((row as { media_id?: string | null }).media_id ?? null) ||
    (typeof mediaPayload?.id === "string" ? mediaPayload.id : null);
  if (!mediaId) {
    return NextResponse.json({ ok: false, error: "media id not found" }, { status: 404 });
  }

  const meta = await fetchMetaMediaMetadata(mediaId);
  if (!meta.ok) {
    return NextResponse.json({ ok: false, error: meta.error }, { status: 502 });
  }
  const bin = await downloadMetaMedia(meta.url);
  if (!bin.ok) {
    return NextResponse.json({ ok: false, error: bin.error }, { status: 502 });
  }

  const conversationId = (row as { conversation_id?: string | null }).conversation_id ?? "unknown";
  const storagePath = buildWhatsappMediaPath({
    direction: "inbound",
    conversationId,
    providerMessageId: `in_${messageId}`,
    mediaType: messageType || "media",
    mimeType:
      (row as { media_mime_type?: string | null }).media_mime_type ??
      meta.mime_type ??
      bin.mimeType,
    fileName:
      (row as { media_file_name?: string | null }).media_file_name ??
      (typeof mediaPayload?.filename === "string" ? mediaPayload.filename : null),
  });
  const uploaded = await uploadWhatsappMedia({
    path: storagePath,
    bytes: bin.bytes,
    mimeType:
      (row as { media_mime_type?: string | null }).media_mime_type ??
      meta.mime_type ??
      bin.mimeType,
  });
  if (!uploaded.ok) {
    return NextResponse.json({ ok: false, error: uploaded.error }, { status: 500 });
  }

  await supabase
    .from("whatsapp_inbound_messages")
    .update({
      media_storage_path: uploaded.path,
      media_mime_type:
        (row as { media_mime_type?: string | null }).media_mime_type ??
        meta.mime_type ??
        bin.mimeType,
      media_size_bytes: bin.sizeBytes ?? undefined,
    })
    .eq("id", messageId);

  const signed = await createWhatsappMediaSignedUrl(uploaded.path, 60 * 60);
  if (!signed) {
    return NextResponse.json({ ok: false, error: "signed url failed" }, { status: 500 });
  }
  return NextResponse.redirect(signed, { status: 302 });
}
