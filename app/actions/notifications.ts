"use server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { wantsEmail, wantsWhatsApp } from "@/lib/communicationPreference";
import { sendNewQuestionInLobbyToProofreaders, sendToLinguisticEditor } from "@/lib/email";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

function goLink(pathWithQuery: string): string {
  return `${APP_URL}/api/go?r=${encodeURIComponent(pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`)}`;
}

/**
 * קוראים אחרי שהמשיב סיים לשלוח תשובה (RPC submit_respondent_response) – שולח התראה למגיהים המתאימים (מייל ו/או וואטסאפ לפי העדפה).
 */
export async function notifyLobbyNewQuestion(questionId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: question, error: qErr } = await supabase
      .from("questions")
      .select("id, short_id, stage, proofreader_type_id, topic_id")
      .eq("id", questionId)
      .single();

    if (qErr || !question) return { ok: false, error: "שאלה לא נמצאה" };
    if (question.stage !== "in_proofreading_lobby") return { ok: true };

    const proofreaderTypeId = question.proofreader_type_id as string | null;
    if (!proofreaderTypeId) return { ok: true };

    const { data: allProof } = await supabase
      .from("profiles")
      .select("id, communication_preference, proofreader_type_id, phone");
    const { data: fromJunction } = await supabase
      .from("profile_proofreader_types")
      .select("profile_id")
      .eq("proofreader_type_id", proofreaderTypeId);
    const typeMatchIds = new Set<string>();
    for (const p of allProof ?? []) {
      if (p.proofreader_type_id === proofreaderTypeId) typeMatchIds.add(p.id);
    }
    for (const r of fromJunction ?? []) typeMatchIds.add(r.profile_id);

    const matchedProfiles = (allProof ?? []).filter((p) => typeMatchIds.has(p.id));
    if (matchedProfiles.length === 0) return { ok: true };

    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, string> = {};
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap[u.id] = u.email;
    }

    let topicName: string | null = null;
    if (question.topic_id) {
      const { data: topic } = await supabase.from("topics").select("name_he").eq("id", question.topic_id).single();
      topicName = topic?.name_he ?? null;
    }

    const linkUrl = questionId ? goLink(`/proofreader?open=${encodeURIComponent(questionId)}`) : goLink("/proofreader");
    const topicLine = topicName ? ` נושא: ${topicName}.` : "";
    const waBody = `שלום,\nנכנסה שאלה חדשה ללובי ההגהה.${topicLine}\nכניסה לטיפול: ${linkUrl}`;

    const toEmails = [
      ...new Set(
        matchedProfiles
          .filter((p) => wantsEmail(p.communication_preference))
          .map((p) => emailMap[p.id])
          .filter(Boolean) as string[]
      ),
    ];

    if (toEmails.length > 0) {
      const emailResult = await sendNewQuestionInLobbyToProofreaders(
        toEmails,
        topicName,
        questionId,
        (question as { short_id?: string | null })?.short_id ?? null
      );
      if (!emailResult.ok) return { ok: false, error: emailResult.error };
    }

    const { sendMetaWhatsAppTextWithLog } = await import("@/lib/whatsapp/outbound");
    for (const p of matchedProfiles) {
      if (!wantsWhatsApp(p.communication_preference)) continue;
      const phone = (p.phone as string | null)?.trim();
      if (!phone) continue;
      await sendMetaWhatsAppTextWithLog(phone, waBody, {
        channel_event: "lobby_new_question",
        idempotency_key: `lobby_${questionId}_${p.id}`,
      });
    }

    return { ok: true };
  } catch (e) {
    console.error("notifyLobbyNewQuestion", e);
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * קוראים אחרי ששאלה עברה לעריכה לשונית – שולח התראה לעורכים (מייל ו/או וואטסאפ).
 */
export async function notifyLinguisticNewQuestion(questionId: string): Promise<{ ok: boolean; error?: string }> {
  console.log("[notifyLinguisticNewQuestion] נקרא עבור questionId:", questionId);
  try {
    const supabase = getSupabaseAdmin();
    const { data: question, error: qErr } = await supabase
      .from("questions")
      .select("id, short_id, stage, content")
      .eq("id", questionId)
      .single();

    if (qErr || !question) {
      console.warn("[notifyLinguisticNewQuestion] שאלה לא נמצאה או שגיאה:", questionId, qErr?.message);
      return { ok: false, error: "שאלה לא נמצאה" };
    }
    if (question.stage !== "in_linguistic_review") {
      console.warn("[notifyLinguisticNewQuestion] השאלה לא בשלב עריכה לשונית, stage:", question.stage);
      return { ok: true };
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, communication_preference, phone")
      .or("is_linguistic_editor.eq.true,is_admin.eq.true,is_technical_lead.eq.true");

    const matched = (profiles ?? []).filter(
      (p) => wantsEmail(p.communication_preference) || wantsWhatsApp(p.communication_preference)
    );
    if (matched.length === 0) {
      console.warn("[notifyLinguisticNewQuestion] אין עורכים/מנהלים עם ערוץ התראה מוגדר. סה״כ פרופילים:", (profiles ?? []).length);
      return { ok: true };
    }

    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, string> = {};
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap[u.id] = u.email;
    }

    const q = question as { content?: string; short_id?: string | null };
    const preview = q.content?.slice(0, 80) ?? "";
    const linkUrl = questionId ? goLink(`/admin/linguistic?open=${encodeURIComponent(questionId)}`) : goLink("/admin/linguistic");
    const waBody = `שלום,\nשאלה הועברה לעריכה לשונית${preview ? ` (תחילת השאלה: ${preview}…)` : ""}.\nכניסה: ${linkUrl}`;

    const toEmails = [
      ...new Set(
        matched
          .filter((p) => wantsEmail(p.communication_preference))
          .map((p) => emailMap[p.id])
          .filter(Boolean) as string[]
      ),
    ];

    if (toEmails.length > 0) {
      console.log("[notifyLinguisticNewQuestion] שולח מייל ל־", toEmails.length, "נמענים");
      const result = await sendToLinguisticEditor(
        toEmails,
        q.content?.slice(0, 80) ?? "",
        questionId,
        q.short_id ?? null
      );
      if (!result.ok) {
        console.error("[notifyLinguisticNewQuestion] שליחת המייל נכשלה:", result.error);
        return result;
      }
    }

    const { sendMetaWhatsAppTextWithLog } = await import("@/lib/whatsapp/outbound");
    for (const p of matched) {
      if (!wantsWhatsApp(p.communication_preference)) continue;
      const phone = (p.phone as string | null)?.trim();
      if (!phone) continue;
      await sendMetaWhatsAppTextWithLog(phone, waBody, {
        channel_event: "linguistic_new_question",
        idempotency_key: `linguistic_${questionId}_${p.id}`,
      });
    }

    return { ok: true };
  } catch (e) {
    console.error("notifyLinguisticNewQuestion", e);
    return { ok: false, error: (e as Error).message };
  }
}
