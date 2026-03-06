"use server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendNewQuestionInLobbyToProofreaders, sendToLinguisticEditor } from "@/lib/email";

/**
 * קוראים אחרי שהמשיב סיים לשלוח תשובה (RPC submit_respondent_response) – שולח מייל למגיהים המתאימים.
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
      .select("id, communication_preference, proofreader_type_id")
      .eq("is_proofreader", true);
    const { data: fromJunction } = await supabase
      .from("profile_proofreader_types")
      .select("profile_id")
      .eq("proofreader_type_id", proofreaderTypeId);
    const typeMatchIds = new Set<string>();
    for (const p of allProof ?? []) {
      if (p.proofreader_type_id === proofreaderTypeId) typeMatchIds.add(p.id);
    }
    for (const r of fromJunction ?? []) typeMatchIds.add(r.profile_id);
    const ids = (allProof ?? [])
      .filter((p) => typeMatchIds.has(p.id) && (p.communication_preference === "email" || p.communication_preference === "both"))
      .map((p) => p.id);
    if (ids.length === 0) return { ok: true };

    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, string> = {};
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap[u.id] = u.email;
    }
    const toEmails = ids.map((id) => emailMap[id]).filter(Boolean);

    let topicName: string | null = null;
    if (question.topic_id) {
      const { data: topic } = await supabase.from("topics").select("name_he").eq("id", question.topic_id).single();
      topicName = topic?.name_he ?? null;
    }

    await sendNewQuestionInLobbyToProofreaders(
      toEmails,
      topicName,
      questionId,
      (question as { short_id?: string | null })?.short_id ?? null
    );
    return { ok: true };
  } catch (e) {
    console.error("notifyLobbyNewQuestion", e);
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * קוראים אחרי ששאלה עברה לעריכה לשונית – שולח מייל לעורכים הלשוניים.
 * דרוש: לפחות משתמש אחד עם is_linguistic_editor או is_admin או is_technical_lead, והעדפת תקשורת email או both.
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
      .select("id, communication_preference")
      .or("is_linguistic_editor.eq.true,is_admin.eq.true,is_technical_lead.eq.true");

    const ids = (profiles ?? []).filter(
      (p) => (p.communication_preference === "email" || p.communication_preference === "both")
    ).map((p) => p.id);
    if (ids.length === 0) {
      console.warn("[notifyLinguisticNewQuestion] אין עורכים/מנהלים עם העדפת תקשורת אימייל או שניהם. סה״כ פרופילים:", (profiles ?? []).length);
      return { ok: true };
    }

    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, string> = {};
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap[u.id] = u.email;
    }
    const toEmails = ids.map((id) => emailMap[id]).filter(Boolean);
    if (toEmails.length === 0) {
      console.warn("[notifyLinguisticNewQuestion] לא נמצאו כתובות אימייל ל־", ids.length, "משתמשים (בדוק ב-Auth)");
      return { ok: true };
    }

    console.log("[notifyLinguisticNewQuestion] שולח מייל ל־", toEmails.length, "נמענים");
    const q = question as { content?: string; short_id?: string | null };
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
    return { ok: true };
  } catch (e) {
    console.error("notifyLinguisticNewQuestion", e);
    return { ok: false, error: (e as Error).message };
  }
}
