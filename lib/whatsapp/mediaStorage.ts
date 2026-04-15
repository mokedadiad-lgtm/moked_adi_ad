import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const WHATSAPP_MEDIA_BUCKET = process.env.WHATSAPP_MEDIA_BUCKET?.trim() || "whatsapp-media";

function extFromMime(mimeType: string | null | undefined): string {
  const mt = (mimeType ?? "").toLowerCase();
  if (mt.includes("jpeg")) return "jpg";
  if (mt.includes("png")) return "png";
  if (mt.includes("webp")) return "webp";
  if (mt.includes("gif")) return "gif";
  if (mt.includes("ogg")) return "ogg";
  if (mt.includes("mpeg")) return "mp3";
  if (mt.includes("mp4")) return "mp4";
  if (mt.includes("pdf")) return "pdf";
  if (mt.includes("msword")) return "doc";
  if (mt.includes("officedocument")) return "docx";
  return "bin";
}

export function buildWhatsappMediaPath(params: {
  direction: "inbound" | "outbound";
  conversationId: string;
  providerMessageId?: string | null;
  mediaType: string;
  mimeType?: string | null;
  fileName?: string | null;
}): string {
  const date = new Date().toISOString().slice(0, 10);
  const ext = extFromMime(params.mimeType);
  const baseName =
    params.providerMessageId?.trim() ||
    params.fileName?.trim()?.replace(/[^\w.-]/g, "_") ||
    crypto.randomUUID();
  const short = baseName.length > 80 ? baseName.slice(0, 80) : baseName;
  return `${params.direction}/${date}/${params.conversationId}/${params.mediaType}/${short}.${ext}`;
}

async function ensureBucket(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === WHATSAPP_MEDIA_BUCKET)) return;
  const { error } = await supabase.storage.createBucket(WHATSAPP_MEDIA_BUCKET, {
    public: false,
    fileSizeLimit: "20MB",
  });
  if (error && !String(error.message ?? "").toLowerCase().includes("already")) {
    throw error;
  }
}

export async function uploadWhatsappMedia(params: {
  path: string;
  bytes: Buffer;
  mimeType?: string | null;
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  try {
    await ensureBucket();
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from(WHATSAPP_MEDIA_BUCKET)
      .upload(params.path, params.bytes, {
        contentType: params.mimeType ?? "application/octet-stream",
        upsert: true,
      });
    if (error) return { ok: false, error: error.message };
    return { ok: true, path: params.path };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "upload_failed" };
  }
}

export async function createWhatsappMediaSignedUrl(
  path: string,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(WHATSAPP_MEDIA_BUCKET)
      .createSignedUrl(path, expiresInSeconds);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export async function removeWhatsappMediaPaths(paths: Array<string | null | undefined>): Promise<void> {
  const clean = Array.from(
    new Set(
      paths
        .map((p) => (typeof p === "string" ? p.trim() : ""))
        .filter(Boolean)
    )
  );
  if (clean.length === 0) return;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).remove(clean);
    if (error) {
      console.error("removeWhatsappMediaPaths:", error);
    }
  } catch (e) {
    console.error("removeWhatsappMediaPaths:", e);
  }
}

export { WHATSAPP_MEDIA_BUCKET };
