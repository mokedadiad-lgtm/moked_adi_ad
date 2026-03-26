"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { wantsEmail, wantsWhatsApp } from "@/lib/communicationPreference";
import { sendAssignmentLinkToRespondent, sendInactivityReminder, sendManualReminderToRespondent } from "@/lib/email";
import { notifyLobbyNewQuestion, notifyLinguisticNewQuestion } from "@/app/actions/notifications";
import type { QuestionStage } from "@/lib/types";
import { ADMIN_TABLE_STAGES } from "@/lib/types";
import { getActiveQuestions } from "@/lib/admin-active-questions";

function revalidateAdminTopics() {
  revalidatePath("/admin/topics");
  revalidatePath("/admin");
}

function safeError(message: string): string {
  return message || "שגיאה לא צפויה";
}

const APP_URL_FOR_LINKS =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

/** קישור דרך /api/go — כמו במיילים ובהתראות אחרות */
function goLinkRespondentAssignment(questionId: string): string {
  const path = `/respondent?open=${encodeURIComponent(questionId)}`;
  return `${APP_URL_FOR_LINKS}/api/go?r=${encodeURIComponent(path.startsWith("/") ? path : `/${path}`)}`;
}

function buildRespondentAssignmentWhatsAppParts(params: {
  fullNameHe: string | null;
  topicName: string | null;
  subTopicName: string | null;
  managerMessage: string | null;
  questionId: string;
}): {
  nameOnly: string;
  greetingLegacy: string;
  topicPart: string;
  managerNote: string;
  linkUrl: string;
} {
  const name = params.fullNameHe?.trim() ?? "";
  const nameOnly = name;
  const greetingLegacy = name ? `שלום ${name}` : "שלום";
  const topicPart = [params.topicName?.trim(), params.subTopicName?.trim()].filter(Boolean).join(" – ") || "כללי";
  const managerNote =
    params.managerMessage?.trim() ? `הערת מנהל: ${params.managerMessage.trim()}` : "";
  const linkUrl = goLinkRespondentAssignment(params.questionId);
  return { nameOnly, greetingLegacy, topicPart, managerNote, linkUrl };
}

/**
 * מייל + וואטסאפ לפי communication_preference (כמו לובי/לשוני).
 */
async function sendRespondentAssignmentNotifications(opts: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  respondentId: string;
  questionId: string;
  questionLabel: string | null;
  topicName: string | null;
  subTopicName: string | null;
  managerMessage: string | null;
  profile: {
    full_name_he: string | null;
    communication_preference: string | null;
    gender: string | null;
    phone: string | null;
  };
  whatsappIdempotencyKey: string;
}): Promise<void> {
  const pref = opts.profile.communication_preference ?? undefined;
  const respondentGender = (opts.profile.gender === "F" || opts.profile.gender === "M" ? opts.profile.gender : null) as
    | "M"
    | "F"
    | null;

  if (wantsEmail(pref)) {
    const { data: authUser } = await opts.supabase.auth.admin.getUserById(opts.respondentId);
    const email = authUser?.user?.email?.trim();
    if (email) {
      await sendAssignmentLinkToRespondent(
        email,
        opts.profile.full_name_he ?? null,
        opts.managerMessage?.trim() || null,
        opts.questionLabel,
        opts.questionId,
        opts.topicName,
        opts.subTopicName,
        respondentGender
      );
    }
  }

  if (wantsWhatsApp(pref)) {
    const phone = opts.profile.phone?.trim();
    if (!phone) {
      console.warn("[sendRespondentAssignmentNotifications] wants WhatsApp but no phone on profile", opts.respondentId);
      return;
    }
    const parts = buildRespondentAssignmentWhatsAppParts({
      fullNameHe: opts.profile.full_name_he,
      topicName: opts.topicName,
      subTopicName: opts.subTopicName,
      managerMessage: opts.managerMessage,
      questionId: opts.questionId,
    });
    const waBody = `${parts.greetingLegacy},\nשובצה לך שאלה חדשה לטיפול בנושא ${parts.topicPart}.\nכניסה למערכת: ${parts.linkUrl}${parts.managerNote ? `\n${parts.managerNote}` : ""}`;
    const { sendMetaWhatsAppInitiatedWithLog } = await import("@/lib/whatsapp/outbound");
    const { waTemplateBodyParam } = await import("@/lib/whatsapp/templateConfig");
    const { extractWhatsAppUrlSuffix } = await import("@/lib/whatsapp/urlSuffix");
    const linkSuffix = extractWhatsAppUrlSuffix(parts.linkUrl);
    await sendMetaWhatsAppInitiatedWithLog(phone, {
      templateKey: "respondent_assignment",
      channel_event: "respondent_assignment",
      idempotency_key: opts.whatsappIdempotencyKey,
      // Template begins with fixed "שלום וברכה" so param 1 must be name-only (or invisible).
      bodyParameters: [waTemplateBodyParam(parts.nameOnly), parts.topicPart, waTemplateBodyParam(parts.managerNote)],
      buttonDynamicParam: linkSuffix,
      legacyText: waBody,
    });
  }
}

/** כפילות מינימלית מ־response-text — נשמר כאן כדי שלא ייבא ה־actions bundle מודולים מיותרים */
function sanitizeLinguisticSignatureStored(html: unknown): string {
  const s = typeof html === "string" ? html : html == null ? "" : String(html);
  if (!s.trim()) return "";
  return s
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<(\/?)([a-z0-9]+)(\s[^>]*)?>/gi, (_, slash: string, tag: string) => {
      const t = tag.toLowerCase();
      const allowed = new Set(["b", "strong", "br", "div"]);
      if (t === "br" && slash) return "";
      if (t === "br") return "<br>";
      if (!allowed.has(t)) return "";
      return `<${slash}${t}>`;
    });
}

export interface RespondentOption {
  id: string;
  full_name_he: string | null;
}

export async function getRespondents(): Promise<RespondentOption[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name_he")
      .eq("is_respondent", true)
      .order("full_name_he");

    if (error) return [];
    return (data ?? []).map((p) => ({ id: p.id, full_name_he: p.full_name_he ?? null }));
  } catch {
    return [];
  }
}

/** רשימת מגיהים לסינון בנתונים */
export async function getProofreadersList(): Promise<RespondentOption[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name_he")
      .eq("is_proofreader", true)
      .order("full_name_he");
    if (error) return [];
    return (data ?? []).map((p) => ({ id: p.id, full_name_he: p.full_name_he ?? null }));
  } catch {
    return [];
  }
}

export interface RespondentWithEligibility extends RespondentOption {
  eligible: boolean;
  reason?: string;
}

const ACTIVE_STAGES_FOR_COUNT: QuestionStage[] = [
  "with_respondent",
  "in_proofreading_lobby",
  "in_linguistic_review",
  "ready_for_sending",
];

/** משיבים עם סטטוס זמינות לשיבוץ (מכסה, צינון) */
export async function getRespondentsWithEligibility(
  questionId: string,
  topicId?: string | null
): Promise<RespondentWithEligibility[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: profiles, error: pe } = await supabase
      .from("profiles")
      .select("id, full_name_he, concurrency_limit, cooldown_days")
      .eq("is_respondent", true)
      .order("full_name_he");
    if (pe || !profiles?.length) return [];

    const ids = profiles.map((p) => p.id);
    const { data: activeCounts } = await supabase
      .from("questions")
      .select("assigned_respondent_id")
      .in("assigned_respondent_id", ids)
      .in("stage", ACTIVE_STAGES_FOR_COUNT);
    const countByRespondent: Record<string, number> = {};
    for (const id of ids) countByRespondent[id] = 0;
    for (const q of activeCounts ?? []) {
      if (q.assigned_respondent_id) countByRespondent[q.assigned_respondent_id] = (countByRespondent[q.assigned_respondent_id] ?? 0) + 1;
    }
    const { data: qaActiveCounts } = await supabase
      .from("question_answers")
      .select("assigned_respondent_id")
      .in("assigned_respondent_id", ids)
      .in("stage", ACTIVE_STAGES_FOR_COUNT);
    for (const q of qaActiveCounts ?? []) {
      if (q.assigned_respondent_id) countByRespondent[q.assigned_respondent_id] = (countByRespondent[q.assigned_respondent_id] ?? 0) + 1;
    }

    const { data: lastSent } = await supabase
      .from("questions")
      .select("assigned_respondent_id, sent_at")
      .in("assigned_respondent_id", ids)
      .eq("stage", "sent_archived")
      .not("sent_at", "is", null);
    const lastSentByRespondent: Record<string, string> = {};
    for (const q of lastSent ?? []) {
      if (q.assigned_respondent_id && q.sent_at) {
        const id = q.assigned_respondent_id;
        const existing = lastSentByRespondent[id];
        if (!existing || new Date(q.sent_at) > new Date(existing)) lastSentByRespondent[id] = q.sent_at;
      }
    }
    const { data: qaArchived } = await supabase
      .from("question_answers")
      .select("assigned_respondent_id, question_id")
      .eq("stage", "sent_archived")
      .in("assigned_respondent_id", ids);
    if (qaArchived?.length) {
      const qIds = [...new Set(qaArchived.map((q) => q.question_id))];
      const { data: qSent } = await supabase
        .from("questions")
        .select("id, sent_at")
        .in("id", qIds)
        .not("sent_at", "is", null);
      const sentByQ = Object.fromEntries((qSent ?? []).map((q) => [q.id, q.sent_at as string]));
      for (const qa of qaArchived) {
        const sentAt = qa.assigned_respondent_id && sentByQ[qa.question_id];
        if (sentAt) {
          const id = qa.assigned_respondent_id;
          const existing = lastSentByRespondent[id];
          if (!existing || new Date(sentAt) > new Date(existing)) lastSentByRespondent[id] = sentAt;
        }
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return profiles.map((p) => {
      const limit = p.concurrency_limit ?? 1;
      const current = countByRespondent[p.id] ?? 0;
      const last = lastSentByRespondent[p.id];
      const cooldownDays = p.cooldown_days ?? 0;
      let eligible = true;
      let reason: string | undefined;
      if (current >= limit) {
        eligible = false;
        reason = "סיים/ה מכסה";
      } else if (last && cooldownDays > 0) {
        const lastDate = new Date(last);
        lastDate.setHours(0, 0, 0, 0);
        const endCooldown = new Date(lastDate);
        endCooldown.setDate(endCooldown.getDate() + cooldownDays);
        if (endCooldown > today) {
          const daysLeft = Math.ceil((endCooldown.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
          eligible = false;
          reason = `נותרו עוד ${daysLeft} ימים לצינון`;
        }
      }
      return {
        id: p.id,
        full_name_he: p.full_name_he ?? null,
        eligible,
        reason,
      };
    });
  } catch {
    return [];
  }
}

export type SendReminderResult = { ok: true } | { ok: false; error: string };

export async function sendReminderToRespondent(questionId: string, answerId?: string | null): Promise<SendReminderResult> {
  try {
    console.log("[sendReminderToRespondent] started for question:", questionId, "answerId:", answerId);
    const supabase = getSupabaseAdmin();
    let respondentId: string | null = null;
    let topicId: string | null = null;
    let subTopicId: string | null = null;

    if (answerId) {
      const { data: a, error: ae } = await supabase
        .from("question_answers")
        .select("assigned_respondent_id, topic_id, sub_topic_id")
        .eq("id", answerId)
        .single();
      if (ae || !a?.assigned_respondent_id) return { ok: false, error: "תשובה או משיב לא נמצאו" };
      respondentId = a.assigned_respondent_id;
      topicId = a.topic_id ?? null;
      subTopicId = a.sub_topic_id ?? null;
    } else {
      const { data: q, error: qe } = await supabase
        .from("questions")
        .select("assigned_respondent_id, topic_id, sub_topic_id")
        .eq("id", questionId)
        .single();
      if (qe || !q?.assigned_respondent_id) return { ok: false, error: "שאלה או משיב לא נמצאו" };
      respondentId = q.assigned_respondent_id;
      topicId = q.topic_id ?? null;
      subTopicId = q.sub_topic_id ?? null;
    }

    let topicName: string | null = null;
    let subTopicName: string | null = null;
    if (topicId) {
      const { data: t } = await supabase.from("topics").select("name_he").eq("id", topicId).single();
      topicName = t?.name_he ?? null;
    }
    if (subTopicId) {
      const { data: s } = await supabase.from("sub_topics").select("name_he").eq("id", subTopicId).single();
      subTopicName = s?.name_he ?? null;
    }

    const { data: authUser } = await supabase.auth.admin.getUserById(respondentId!);
    const email = authUser?.user?.email?.trim();
    if (!email) return { ok: false, error: "לא נמצא אימייל למשיב/ה" };
    const res = await sendManualReminderToRespondent(email, topicName, subTopicName);
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export async function sendReminderToProofreaders(questionId: string, answerId?: string | null): Promise<SendReminderResult> {
  try {
    console.log("[sendReminderToProofreaders] started for question:", questionId, "answerId:", answerId);
    const supabase = getSupabaseAdmin();
    let content: string | undefined;
    let proofreader_type_id: string | null = null;

    if (answerId) {
      const { data: a, error: ae } = await supabase
        .from("question_answers")
        .select("proofreader_type_id")
        .eq("id", answerId)
        .single();
      if (ae || !a) return { ok: false, error: "תשובה לא נמצאה" };
      proofreader_type_id = a.proofreader_type_id ?? null;
      const { data: q } = await supabase.from("questions").select("content").eq("id", questionId).single();
      content = (q as { content?: string } | null)?.content;
    } else {
      const { data: q, error: qe } = await supabase
        .from("questions")
        .select("content, proofreader_type_id")
        .eq("id", questionId)
        .single();
      if (qe || !q) return { ok: false, error: "שאלה לא נמצאה" };
      content = (q as { content?: string }).content;
      proofreader_type_id = (q as { proofreader_type_id?: string | null }).proofreader_type_id ?? null;
    }

    const question = { content, proofreader_type_id };
    let profileIds = new Set<string>();
    const allProof = await supabase.from("profiles").select("id, proofreader_type_id").eq("is_proofreader", true);
    if (allProof.error) return { ok: false, error: `שגיאה: ${allProof.error.message}` };
    const allProofreaders = allProof.data ?? [];
    if (question.proofreader_type_id) {
      for (const p of allProofreaders) {
        if (p.proofreader_type_id === question.proofreader_type_id) profileIds.add(p.id);
      }
      const { data: fromJunction } = await supabase
        .from("profile_proofreader_types")
        .select("profile_id")
        .eq("proofreader_type_id", question.proofreader_type_id);
      for (const r of fromJunction ?? []) profileIds.add(r.profile_id);
    } else {
      for (const p of allProofreaders) profileIds.add(p.id);
    }
    if (profileIds.size === 0) {
      return { ok: false, error: question.proofreader_type_id
        ? "לא נמצאו מגיהים בקטגוריה הרלוונטית לשאלה. הוסף מגיה/ה עם הסוג המתאים או סמן סוג הגהה לשאלה."
        : "לא נמצאו מגיהים במערכת. הוסף מגיה/ה בניהול צוות וסמן סוג הגהה." };
    }
    const ids = Array.from(profileIds);
    const emails: string[] = [];
    for (const id of ids) {
      const { data: u } = await supabase.auth.admin.getUserById(id);
      if (u?.user?.email?.trim()) emails.push(u.user.email.trim());
    }
    if (emails.length === 0) return { ok: false, error: "לא נמצא אימייל למגיהים" };

    console.log("[sendReminderToProofreaders] נשלחת תזכורת לכתובות:", emails);

    for (const to of emails) {
      await sendInactivityReminder(to, "proofreader", question.content?.slice(0, 80));
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export type AssignResult = { ok: true } | { ok: false; error: string };

/** Create a question_answer row (one assignment per topic+respondent) and notify (מייל + וואטסאפ לפי העדפה). Does not update questions table. */
export async function assignQuestion(
  questionId: string,
  respondentId: string,
  topicId?: string | null,
  subTopicId?: string | null,
  managerMessage?: string | null
): Promise<AssignResult> {
  try {
    const supabase = getSupabaseAdmin();
    let proofreader_type_id: string | null = null;
    if (topicId) {
      const { data: topic } = await supabase
        .from("topics")
        .select("proofreader_type_id")
        .eq("id", topicId)
        .single();
      proofreader_type_id = topic?.proofreader_type_id ?? null;
    }
    const { error } = await supabase.from("question_answers").insert({
      question_id: questionId,
      topic_id: topicId || null,
      sub_topic_id: subTopicId || null,
      assigned_respondent_id: respondentId,
      proofreader_type_id,
      stage: "with_respondent",
      updated_at: new Date().toISOString(),
    });

    if (error) return { ok: false, error: error.message };

    try {
      const { data: qRow } = await supabase
        .from("questions")
        .select("short_id")
        .eq("id", questionId)
        .single();
      const questionLabel = (qRow as { short_id?: string | null } | null)?.short_id ?? null;

      let topicName: string | null = null;
      let subTopicName: string | null = null;
      if (topicId) {
        const { data: t } = await supabase.from("topics").select("name_he").eq("id", topicId).single();
        topicName = t?.name_he ?? null;
      }
      if (subTopicId) {
        const { data: s } = await supabase.from("sub_topics").select("name_he").eq("id", subTopicId).single();
        subTopicName = s?.name_he ?? null;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name_he, communication_preference, gender, phone")
        .eq("id", respondentId)
        .single();
      if (profile) {
        await sendRespondentAssignmentNotifications({
          supabase,
          respondentId,
          questionId,
          questionLabel,
          topicName,
          subTopicName,
          managerMessage: managerMessage?.trim() || null,
          profile: {
            full_name_he: profile.full_name_he as string | null,
            communication_preference: profile.communication_preference as string | null,
            gender: profile.gender as string | null,
            phone: profile.phone as string | null,
          },
          whatsappIdempotencyKey: `respondent_assign_${questionId}_${respondentId}`,
        });
      }
    } catch (mailErr) {
      console.error("assignQuestion: assignment notification failed", mailErr);
    }
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

/** Replace respondent/topic for an existing question_answer (שינוי שיבוץ במקום יצירת שיבוץ נוסף). */
export async function replaceQuestionAssignment(
  answerId: string,
  respondentId: string,
  topicId?: string | null,
  subTopicId?: string | null,
  managerMessage?: string | null
): Promise<AssignResult> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: answer, error: fetchErr } = await supabase
      .from("question_answers")
      .select("question_id")
      .eq("id", answerId)
      .single();
    if (fetchErr || !answer) return { ok: false, error: "שיבוץ לא נמצא" };
    const questionId = (answer as { question_id: string }).question_id;

    let proofreader_type_id: string | null = null;
    if (topicId) {
      const { data: topic } = await supabase
        .from("topics")
        .select("proofreader_type_id")
        .eq("id", topicId)
        .single();
      proofreader_type_id = topic?.proofreader_type_id ?? null;
    }

    const { error } = await supabase
      .from("question_answers")
      .update({
        topic_id: topicId || null,
        sub_topic_id: subTopicId || null,
        assigned_respondent_id: respondentId,
        proofreader_type_id,
        stage: "with_respondent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", answerId);
    if (error) return { ok: false, error: error.message };

    // שליחת מייל לשיבוץ החדש – בדומה ל-assignQuestion
    try {
      const { data: qRow } = await supabase
        .from("questions")
        .select("short_id, content")
        .eq("id", questionId)
        .single();
      const questionLabel = (qRow as { short_id?: string | null } | null)?.short_id ?? null;

      let topicName: string | null = null;
      let subTopicName: string | null = null;
      if (topicId) {
        const { data: t } = await supabase.from("topics").select("name_he").eq("id", topicId).single();
        topicName = t?.name_he ?? null;
      }
      if (subTopicId) {
        const { data: s } = await supabase.from("sub_topics").select("name_he").eq("id", subTopicId).single();
        subTopicName = s?.name_he ?? null;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name_he, communication_preference, gender, phone")
        .eq("id", respondentId)
        .single();
      if (profile) {
        await sendRespondentAssignmentNotifications({
          supabase,
          respondentId,
          questionId,
          questionLabel,
          topicName,
          subTopicName,
          managerMessage: managerMessage?.trim() || null,
          profile: {
            full_name_he: profile.full_name_he as string | null,
            communication_preference: profile.communication_preference as string | null,
            gender: profile.gender as string | null,
            phone: profile.phone as string | null,
          },
          whatsappIdempotencyKey: `respondent_reassign_${answerId}_${respondentId}`,
        });
      }
    } catch (mailErr) {
      console.error("replaceQuestionAssignment: assignment notification failed", mailErr);
    }

    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export type UpdateStageResult = { ok: true } | { ok: false; error: string };

const VALID_STAGES: QuestionStage[] = [
  "waiting_assignment",
  "with_respondent",
  "in_proofreading_lobby",
  "in_linguistic_review",
  "ready_for_sending",
  "pending_manager",
  "sent_archived",
];

export async function updateQuestionStage(
  questionId: string,
  stage: QuestionStage
): Promise<UpdateStageResult> {
  if (!VALID_STAGES.includes(stage)) {
    return { ok: false, error: "סטטוס לא תקין" };
  }
  try {
    const supabase = getSupabaseAdmin();
    // שלב קודם לפני העדכון – כדי למנוע שליחת מיילים כפולה אם לא באמת השתנה
    const { data: before } = await supabase
      .from("questions")
      .select("stage")
      .eq("id", questionId)
      .single();

    const payload: { stage: QuestionStage; updated_at: string; sent_at?: string } = {
      stage,
      updated_at: new Date().toISOString(),
    };
    if (stage === "sent_archived") {
      payload.sent_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("questions")
      .update(payload)
      .eq("id", questionId);
    if (error) return { ok: false, error: error.message };

    // שליחת מיילים בהתאם לשינוי סטטוס
    if (before?.stage !== stage) {
      if (stage === "in_proofreading_lobby") {
        // מייל למגיהים כששאלה נכנסת ללובי
        await notifyLobbyNewQuestion(questionId).catch(() => {});
      } else if (stage === "in_linguistic_review") {
        // מייל לעורכים לשוניים כששאלה נכנסת לעריכה לשונית
        await notifyLinguisticNewQuestion(questionId).catch(() => {});
      }
      // לשלב המשיב – המייל הראשוני נשלח דרך assignQuestion, לכן לא שולחים כאן שוב
    }

    revalidatePath("/admin");
    revalidatePath("/admin/archive");
    revalidatePath("/admin/trash");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export interface QuestionAnswerRow {
  id: string;
  question_id: string;
  topic_id: string | null;
  sub_topic_id: string | null;
  assigned_respondent_id: string | null;
  assigned_proofreader_id: string | null;
  stage: QuestionStage;
  response_text: string | null;
  proofreader_note: string | null;
  pdf_url: string | null;
  pdf_generated_at: string | null;
  proofreader_type_id: string | null;
  topic_name_he?: string | null;
  sub_topic_name_he?: string | null;
  respondent_name?: string | null;
  proofreader_name?: string | null;
}

/** Load all question_answers for a question (for modal when question has multiple answers). */
export async function getQuestionAnswers(questionId: string): Promise<QuestionAnswerRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("question_answers")
      .select(
        "id, question_id, topic_id, sub_topic_id, assigned_respondent_id, assigned_proofreader_id, stage, response_text, proofreader_note, pdf_url, pdf_generated_at, proofreader_type_id, topics(name_he), sub_topics(name_he)"
      )
      .eq("question_id", questionId)
      .order("created_at", { ascending: true });
    if (error) return [];
    const rows = (data ?? []) as (QuestionAnswerRow & { topics?: { name_he?: string } | null; sub_topics?: { name_he?: string } | null })[];
    const profileIds = [...new Set(rows.flatMap((r) => [r.assigned_respondent_id, r.assigned_proofreader_id]).filter(Boolean))] as string[];
    let names: Record<string, string> = {};
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name_he").in("id", profileIds);
      if (profiles) names = Object.fromEntries(profiles.map((p) => [p.id, p.full_name_he ?? ""]));
    }
    return rows.map((r) => ({
      id: r.id,
      question_id: r.question_id,
      topic_id: r.topic_id ?? null,
      sub_topic_id: r.sub_topic_id ?? null,
      assigned_respondent_id: r.assigned_respondent_id ?? null,
      assigned_proofreader_id: r.assigned_proofreader_id ?? null,
      stage: r.stage,
      response_text: r.response_text ?? null,
      proofreader_note: r.proofreader_note ?? null,
      pdf_url: r.pdf_url ?? null,
      pdf_generated_at: r.pdf_generated_at ?? null,
      proofreader_type_id: r.proofreader_type_id ?? null,
      topic_name_he: r.topics?.name_he ?? null,
      sub_topic_name_he: r.sub_topics?.name_he ?? null,
      respondent_name: r.assigned_respondent_id ? (names[r.assigned_respondent_id]?.trim() || null) : null,
      proofreader_name: r.assigned_proofreader_id ? (names[r.assigned_proofreader_id]?.trim() || null) : null,
    }));
  } catch {
    return [];
  }
}

/** Update stage of a single question_answer (for modal when row is from question_answers). */
export async function updateQuestionAnswerStage(
  answerId: string,
  stage: QuestionStage
): Promise<UpdateStageResult> {
  if (!VALID_STAGES.includes(stage)) return { ok: false, error: "סטטוס לא תקין" };
  try {
    const supabase = getSupabaseAdmin();
    const { data: answer, error: fetchErr } = await supabase
      .from("question_answers")
      .select("question_id")
      .eq("id", answerId)
      .single();
    if (fetchErr || !answer) return { ok: false, error: "תשובה לא נמצאה" };
    const questionId = (answer as { question_id: string }).question_id;

    const { data: before } = await supabase.from("question_answers").select("stage").eq("id", answerId).single();
    const payload: { stage: QuestionStage; updated_at: string } = {
      stage,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("question_answers").update(payload).eq("id", answerId);
    if (error) return { ok: false, error: error.message };

    if (before?.stage !== stage) {
      if (stage === "in_proofreading_lobby") await notifyLobbyNewQuestion(questionId).catch(() => {});
      else if (stage === "in_linguistic_review") await notifyLinguisticNewQuestion(questionId).catch(() => {});
    }
    revalidatePath("/admin");
    revalidatePath("/admin/archive");
    revalidatePath("/admin/trash");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export type DeleteQuestionResult = { ok: true } | { ok: false; error: string };
export type DeleteQuestionAnswerResult = { ok: true } | { ok: false; error: string };
export type PermanentlyDeleteQuestionAnswerResult = { ok: true } | { ok: false; error: string };
export type RestoreQuestionAnswerResult = { ok: true } | { ok: false; error: string };

export async function deleteQuestion(questionId: string): Promise<DeleteQuestionResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("questions")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", questionId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/admin/trash");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

/** Soft-delete a single answer (question_answers row) without moving the whole question to trash. */
export async function deleteQuestionAnswer(answerId: string): Promise<DeleteQuestionAnswerResult> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("question_answers")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", answerId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/admin/trash");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

/** Restore a single answer from trash (clear deleted_at). */
export async function restoreQuestionAnswer(answerId: string): Promise<RestoreQuestionAnswerResult> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("question_answers")
      .update({ deleted_at: null, updated_at: now })
      .eq("id", answerId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/admin/trash");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export async function restoreQuestion(questionId: string): Promise<UpdateStageResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("questions")
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq("id", questionId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/admin/trash");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export type PermanentlyDeleteQuestionResult = { ok: true } | { ok: false; error: string };

export async function permanentlyDeleteQuestion(questionId: string): Promise<PermanentlyDeleteQuestionResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("questions").delete().eq("id", questionId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/admin/trash");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

/** Permanently delete a single answer row from question_answers. */
export async function permanentlyDeleteQuestionAnswer(answerId: string): Promise<PermanentlyDeleteQuestionAnswerResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("question_answers").delete().eq("id", answerId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/admin/trash");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export interface CategoryOption {
  id: string;
  name_he: string;
  slug: string;
}

export async function getCategories(): Promise<CategoryOption[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name_he, slug")
      .order("name_he");
    if (error) return [];
    return (data ?? []) as CategoryOption[];
  } catch {
    return [];
  }
}

/** Inserts default categories if missing. Call from admin when "אין קטגוריות במערכת". */
export async function seedDefaultCategories(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  try {
    const supabase = getSupabaseAdmin();
    const defaults = [
      { name_he: "הלכה", slug: "halacha" },
      { name_he: "ייעוץ ורגשות", slug: "counseling" },
      { name_he: "משפחה וזוגיות", slug: "family" },
      { name_he: "כללי", slug: "general" },
    ];
    const { data: existing } = await supabase
      .from("categories")
      .select("slug")
      .in("slug", defaults.map((d) => d.slug));
    const existingSlugs = new Set((existing ?? []).map((r) => r.slug));
    const toInsert = defaults.filter((d) => !existingSlugs.has(d.slug));
    if (toInsert.length === 0) return { ok: true, count: 0 };
    const { error } = await supabase.from("categories").insert(toInsert);
    if (error) return { ok: false, error: error.message };
    return { ok: true, count: toInsert.length };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

// ---- Proofreader types (סוגי הגהה) ----
export interface ProofreaderTypeOption {
  id: string;
  name_he: string;
  slug: string;
  sort_order: number;
}

export async function getProofreaderTypes(): Promise<ProofreaderTypeOption[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("proofreader_types")
      .select("id, name_he, slug, sort_order")
      .order("sort_order");
    if (error) return [];
    return (data ?? []) as ProofreaderTypeOption[];
  } catch {
    return [];
  }
}

export async function createProofreaderType(data: {
  name_he: string;
  slug: string;
  sort_order?: number;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: row, error } = await supabase
      .from("proofreader_types")
      .insert({
        name_he: data.name_he.trim(),
        slug: data.slug.trim() || data.name_he.trim().replace(/\s+/g, "-"),
        sort_order: data.sort_order ?? 0,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidateAdminTopics();
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export async function updateProofreaderType(
  id: string,
  data: { name_he?: string; slug?: string; sort_order?: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const payload: Record<string, unknown> = {};
    if (data.name_he !== undefined) payload.name_he = data.name_he.trim();
    if (data.slug !== undefined) payload.slug = data.slug.trim();
    if (data.sort_order !== undefined) payload.sort_order = data.sort_order;
    const { error } = await supabase.from("proofreader_types").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateAdminTopics();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export async function deleteProofreaderType(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("proofreader_types").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateAdminTopics();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

// ---- Topics & sub-topics (נושאים ותת-נושאים) ----
export interface SubTopicOption {
  id: string;
  topic_id: string;
  name_he: string;
}

export interface TopicOption {
  id: string;
  name_he: string;
  slug: string;
  proofreader_type_id: string;
  proofreader_type_name_he?: string;
  sub_topics: SubTopicOption[];
}

export async function getTopicsWithSubTopics(): Promise<TopicOption[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: topics, error: te } = await supabase
      .from("topics")
      .select("id, name_he, slug, proofreader_type_id")
      .order("name_he");
    if (te || !topics?.length) {
      const { data: types } = await supabase.from("proofreader_types").select("id, name_he");
      const typeMap = Object.fromEntries((types ?? []).map((t: { id: string; name_he: string }) => [t.id, t.name_he]));
      return (topics ?? []).map((t) => ({
        ...t,
        proofreader_type_name_he: typeMap[t.proofreader_type_id],
        sub_topics: [],
      }));
    }
    const typeIds = [...new Set(topics.map((t) => t.proofreader_type_id))];
    const { data: types } = await supabase.from("proofreader_types").select("id, name_he");
    const typeMap = Object.fromEntries((types ?? []).map((t: { id: string; name_he: string }) => [t.id, t.name_he]));
    const { data: subTopics } = await supabase
      .from("sub_topics")
      .select("id, topic_id, name_he")
      .in("topic_id", topics.map((t) => t.id));
    const byTopic: Record<string, SubTopicOption[]> = {};
    for (const t of topics) byTopic[t.id] = [];
    for (const s of subTopics ?? []) {
      if (byTopic[s.topic_id]) byTopic[s.topic_id].push(s);
    }
    return topics.map((t) => ({
      id: t.id,
      name_he: t.name_he,
      slug: t.slug,
      proofreader_type_id: t.proofreader_type_id,
      proofreader_type_name_he: typeMap[t.proofreader_type_id],
      sub_topics: byTopic[t.id] ?? [],
    }));
  } catch {
    return [];
  }
}

export async function createTopic(data: {
  name_he: string;
  slug?: string;
  proofreader_type_id: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const slug = data.slug?.trim() || data.name_he.trim().replace(/\s+/g, "-");
    const { data: row, error } = await supabase
      .from("topics")
      .insert({
        name_he: data.name_he.trim(),
        slug,
        proofreader_type_id: data.proofreader_type_id,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidateAdminTopics();
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export async function updateTopic(
  id: string,
  data: { name_he?: string; slug?: string; proofreader_type_id?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const payload: Record<string, unknown> = {};
    if (data.name_he !== undefined) payload.name_he = data.name_he.trim();
    if (data.slug !== undefined) payload.slug = data.slug.trim();
    if (data.proofreader_type_id !== undefined) payload.proofreader_type_id = data.proofreader_type_id;
    const { error } = await supabase.from("topics").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateAdminTopics();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export async function deleteTopic(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("topics").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateAdminTopics();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

/** מזהי המשיבים המשויכים לנושא */
export async function getTopicRespondentIds(topicId: string): Promise<string[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("respondent_topics").select("profile_id").eq("topic_id", topicId);
    return (data ?? []).map((r: { profile_id: string }) => r.profile_id);
  } catch {
    return [];
  }
}

/** עדכון שיוך משיבים לנושא */
export async function setTopicRespondents(
  topicId: string,
  profileIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("respondent_topics").delete().eq("topic_id", topicId);
    const ids = profileIds.filter(Boolean);
    if (ids.length > 0) {
      const { error } = await supabase.from("respondent_topics").insert(
        ids.map((profile_id) => ({ profile_id, topic_id: topicId }))
      );
      if (error) return { ok: false, error: error.message };
    }
    revalidateAdminTopics();
    revalidatePath("/admin/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export async function createSubTopic(data: { topic_id: string; name_he: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: row, error } = await supabase
      .from("sub_topics")
      .insert({ topic_id: data.topic_id, name_he: data.name_he.trim() })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidateAdminTopics();
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export async function updateSubTopic(id: string, data: { name_he?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    if (data.name_he === undefined) return { ok: true };
    const { error } = await supabase.from("sub_topics").update({ name_he: data.name_he.trim() }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateAdminTopics();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export async function deleteSubTopic(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("sub_topics").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateAdminTopics();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

/** Used by respondent when submitting answer: get proofreader_type_id from question's topic or first type */
export async function getProofreaderTypeIdForQuestion(questionId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: q } = await supabase.from("questions").select("topic_id").eq("id", questionId).single();
    if (q?.topic_id) {
      const { data: topic } = await supabase.from("topics").select("proofreader_type_id").eq("id", q.topic_id).single();
      if (topic?.proofreader_type_id) return topic.proofreader_type_id;
    }
    const { data: first } = await supabase.from("proofreader_types").select("id").order("sort_order").limit(1).single();
    return first?.id ?? null;
  } catch {
    return null;
  }
}

export interface TeamProfileRow {
  id: string;
  full_name_he: string | null;
  email: string | null;
  phone: string | null;
  gender: "M" | "F";
  is_respondent: boolean;
  is_proofreader: boolean;
  is_linguistic_editor: boolean;
  is_technical_lead: boolean;
  proofreader_type_id: string | null;
  proofreader_type_name_he: string | null;
  /** כל סוגי ההגהה של המגיה (מטבלת צירוף) */
  proofreader_type_ids: string[];
  communication_preference: "whatsapp" | "email" | "both";
  concurrency_limit: number;
  cooldown_days: number;
  category_ids: string[];
  /** נושאים שמשויכים למשיב/ה (רק למשיבים) */
  topic_ids: string[];
}

export async function getTeamProfiles(): Promise<TeamProfileRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: profiles, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name_he, gender, is_respondent, is_proofreader, is_linguistic_editor, is_technical_lead, proofreader_type_id, communication_preference, concurrency_limit, cooldown_days, phone"
    )
    .order("full_name_he");

  if (error) return [];

  const ids = (profiles ?? []).map((p) => p.id);
  const emailMap: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const users = authData?.users ?? [];
    for (const u of users) {
      if (u.email) emailMap[u.id] = u.email;
    }
  }

  const { data: ppt } = await supabase.from("profile_proofreader_types").select("profile_id, proofreader_type_id");
  const typeIdsByProfile: Record<string, string[]> = {};
  for (const id of ids) typeIdsByProfile[id] = [];
  for (const row of ppt ?? []) {
    if (typeIdsByProfile[row.profile_id]) typeIdsByProfile[row.profile_id].push(row.proofreader_type_id);
  }
  const allTypeIds = [...new Set((profiles ?? []).map((p) => p.proofreader_type_id).filter(Boolean))] as string[];
  for (const tid of Object.values(typeIdsByProfile).flat()) allTypeIds.push(tid);
  const typeMap: Record<string, string> = {};
  if (allTypeIds.length > 0) {
    const { data: types } = await supabase.from("proofreader_types").select("id, name_he").in("id", [...new Set(allTypeIds)]);
    for (const t of types ?? []) typeMap[t.id] = t.name_he;
  }

  const { data: pc } = await supabase.from("profile_categories").select("profile_id, category_id");
  const categoriesByProfile: Record<string, string[]> = {};
  for (const id of ids) categoriesByProfile[id] = [];
  for (const row of pc ?? []) {
    if (categoriesByProfile[row.profile_id]) categoriesByProfile[row.profile_id].push(row.category_id);
  }

  const { data: rt } = await supabase.from("respondent_topics").select("profile_id, topic_id");
  const topicsByProfile: Record<string, string[]> = {};
  for (const id of ids) topicsByProfile[id] = [];
  for (const row of rt ?? []) {
    if (topicsByProfile[row.profile_id]) topicsByProfile[row.profile_id].push(row.topic_id);
  }

  return (profiles ?? []).map((p) => {
    const typeIds = typeIdsByProfile[p.id]?.length ? typeIdsByProfile[p.id] : (p.proofreader_type_id ? [p.proofreader_type_id] : []);
    const primaryId = p.proofreader_type_id ?? typeIds[0] ?? null;
    const names = typeIds.map((tid) => typeMap[tid]).filter(Boolean);
    return {
      id: p.id,
      full_name_he: p.full_name_he ?? null,
      email: emailMap[p.id] ?? null,
      phone: p.phone ?? null,
      gender: p.gender as "M" | "F",
      is_respondent: p.is_respondent ?? false,
      is_proofreader: p.is_proofreader ?? false,
      is_linguistic_editor: p.is_linguistic_editor ?? false,
      is_technical_lead: (p as { is_technical_lead?: boolean }).is_technical_lead ?? false,
      proofreader_type_id: primaryId,
      proofreader_type_name_he: names.length ? names.join(", ") : (primaryId ? typeMap[primaryId] ?? null : null),
      proofreader_type_ids: typeIds,
      communication_preference: (p.communication_preference ?? "email") as TeamProfileRow["communication_preference"],
      concurrency_limit: p.concurrency_limit ?? 1,
      cooldown_days: p.cooldown_days ?? 0,
      category_ids: categoriesByProfile[p.id] ?? [],
      topic_ids: topicsByProfile[p.id] ?? [],
    };
  });
  } catch {
    return [];
  }
}

export type UpdateTeamMemberResult = { ok: true } | { ok: false; error: string };

export async function updateTeamMember(
  profileId: string,
  data: {
    full_name_he: string | null;
    gender: "M" | "F";
    is_respondent: boolean;
    is_proofreader: boolean;
    is_linguistic_editor: boolean;
    is_technical_lead: boolean;
    proofreader_type_id: string | null;
    proofreader_type_ids: string[];
    communication_preference: "whatsapp" | "email" | "both";
    phone: string | null;
    concurrency_limit: number;
    cooldown_days: number;
    category_ids: string[];
    topic_ids: string[];
  }
): Promise<UpdateTeamMemberResult> {
  try {
    const supabase = getSupabaseAdmin();
    const typeIds = (data.proofreader_type_ids ?? []).filter(Boolean);
    const proofreader_type_id = data.is_proofreader && typeIds.length > 0 ? typeIds[0] : null;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name_he: data.full_name_he || null,
        gender: data.gender,
        is_respondent: data.is_respondent,
        is_proofreader: data.is_proofreader,
        is_linguistic_editor: data.is_linguistic_editor,
        is_technical_lead: data.is_technical_lead,
        proofreader_type_id,
        communication_preference: data.communication_preference,
        phone: data.phone?.trim() || null,
        concurrency_limit: data.concurrency_limit,
        cooldown_days: data.cooldown_days,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId);

    if (error) return { ok: false, error: error.message };

    await supabase.from("profile_proofreader_types").delete().eq("profile_id", profileId);
    if (typeIds.length > 0) {
      await supabase.from("profile_proofreader_types").insert(
        typeIds.map((proofreader_type_id) => ({ profile_id: profileId, proofreader_type_id }))
      );
    }

    await supabase.from("profile_categories").delete().eq("profile_id", profileId);
    if (data.category_ids.length > 0) {
      await supabase.from("profile_categories").insert(
        data.category_ids.map((category_id) => ({ profile_id: profileId, category_id }))
      );
    }
    await supabase.from("respondent_topics").delete().eq("profile_id", profileId);
    if (data.topic_ids?.length) {
      await supabase.from("respondent_topics").insert(
        data.topic_ids.map((topic_id) => ({ profile_id: profileId, topic_id }))
      );
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export type CreateTeamMemberResult = { ok: true; userId: string } | { ok: false; error: string };

export async function createTeamMember(data: {
  email: string;
  password: string;
  full_name_he: string | null;
  gender: "M" | "F";
  is_respondent: boolean;
  is_proofreader: boolean;
  is_linguistic_editor: boolean;
  is_technical_lead: boolean;
  proofreader_type_ids: string[];
  communication_preference: "whatsapp" | "email" | "both";
  phone: string | null;
  concurrency_limit: number;
  cooldown_days: number;
  category_ids: string[];
  topic_ids: string[];
}): Promise<CreateTeamMemberResult> {
  try {
    const supabase = getSupabaseAdmin();
    const normalizedEmail = data.email.trim().toLowerCase();

    // מנסים ליצור משתמש חדש ב-auth; אם כבר קיים, נאתר אותו לפי האימייל ונמשיך ליצירת פרופיל
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: data.password,
      email_confirm: true,
    });

    let userId = authData.user?.id as string | undefined;

    if (authError) {
      const message = authError.message || "";
      const isAlreadyRegistered =
        message.includes("already registered") ||
        message.includes("User already exists") ||
        message.includes("User already registered");

      // אם זו לא שגיאה של "משתמש כבר קיים" – מחזירים שגיאה רגילה
      if (!isAlreadyRegistered) {
        return { ok: false, error: authError.message };
      }

      // המשתמש כבר קיים ב-auth – מחפשים אותו לפי אימייל
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (listError) {
        return { ok: false, error: authError.message };
      }
      const existing = (listData?.users ?? []).find(
        (u) => u.email && u.email.trim().toLowerCase() === normalizedEmail
      );
      userId = existing?.id;
    }

    if (!userId) return { ok: false, error: "לא נוצר משתמש" };

    const typeIds = (data.proofreader_type_ids ?? []).filter(Boolean);
    const proofreader_type_id = data.is_proofreader && typeIds.length > 0 ? typeIds[0] : null;
    const profileRow = {
      id: userId,
      full_name_he: data.full_name_he || null,
      gender: data.gender,
      is_respondent: data.is_respondent,
      is_proofreader: data.is_proofreader,
      is_linguistic_editor: data.is_linguistic_editor,
      is_technical_lead: data.is_technical_lead,
      proofreader_type_id,
      communication_preference: data.communication_preference,
      phone: data.phone?.trim() || null,
      concurrency_limit: data.concurrency_limit,
      cooldown_days: data.cooldown_days,
    };
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(profileRow, { onConflict: "id" });

    if (profileError) return { ok: false, error: profileError.message };

    if (typeIds.length > 0) {
      await supabase.from("profile_proofreader_types").insert(
        typeIds.map((proofreader_type_id) => ({ profile_id: userId, proofreader_type_id }))
      );
    }

    if (data.category_ids.length > 0) {
      await supabase.from("profile_categories").insert(
        data.category_ids.map((category_id) => ({ profile_id: userId, category_id }))
      );
    }
    if (data.topic_ids?.length) {
      await supabase.from("respondent_topics").insert(
        data.topic_ids.map((topic_id) => ({ profile_id: userId, topic_id }))
      );
    }
    return { ok: true, userId };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export type DeleteTeamMemberResult = { ok: true } | { ok: false; error: string };

export async function deleteTeamMember(profileId: string): Promise<DeleteTeamMemberResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.auth.admin.deleteUser(profileId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

/** שאלות שלא עודכנו מעל 5 ימים (עיכוב באותו סטטוס) — לסרגל עיכובים */
export interface DelayedQuestionItem {
  id: string;
  short_id: string | null;
  title: string | null;
  stage: QuestionStage;
  /** כשהשורה מגיעה מ־question_answers — ל־key ייחודי ברשימה */
  answer_id?: string | null;
}

/** עיכובים: אותה לוגיקת סטטוס כמו טבלת לוח הבקרה (כולל question_answers), לפי זמן עדכון הרלוונטי */
export async function getDelayedQuestions(): Promise<DelayedQuestionItem[]> {
  try {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const rows = await getActiveQuestions();
    return rows
      .filter((r) => {
        const t = r.delay_source_updated_at;
        if (!t) return false;
        return new Date(t) < fiveDaysAgo;
      })
      .sort(
        (a, b) =>
          new Date(a.delay_source_updated_at ?? 0).getTime() -
          new Date(b.delay_source_updated_at ?? 0).getTime()
      )
      .map((r) => ({
        id: r.id,
        short_id: r.short_id ?? null,
        title: r.title ?? null,
        stage: r.stage,
        answer_id: r.answer_id ?? null,
      }));
  } catch {
    return [];
  }
}

/** שאלות לפי אימייל שואל — לחלון התראה שימוש חוזר */
export interface QuestionByEmailItem {
  id: string;
  short_id: string | null;
  title: string | null;
  stage: QuestionStage;
  created_at: string;
}

export async function getQuestionsByEmail(email: string): Promise<QuestionByEmailItem[]> {
  try {
    const supabase = getSupabaseAdmin();
    const e = (email ?? "").trim().toLowerCase();
    if (!e) return [];
    const { data, error } = await supabase
      .from("questions")
      .select("id, short_id, title, stage, created_at")
      .ilike("asker_email", e)
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []).map((r) => ({
      id: r.id,
      short_id: r.short_id ?? null,
      title: r.title ?? null,
      stage: r.stage as QuestionStage,
      created_at: r.created_at,
    }));
  } catch {
    return [];
  }
}

/** כמות שאלות לכל אימייל (להתראת שימוש חוזר מעל 5) */
export async function getEmailCounts(emails: string[]): Promise<Record<string, number>> {
  try {
    const supabase = getSupabaseAdmin();
    const normalized = [...new Set(emails.map((e) => (e ?? "").trim().toLowerCase()).filter(Boolean))];
    if (normalized.length === 0) return {};
    const out: Record<string, number> = {};
    for (const email of normalized) {
      const { count, error } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .ilike("asker_email", email);
      if (!error && count != null) out[email] = count;
    }
    return out;
  } catch {
    return {};
  }
}

/** נתונים לדיאגרמות: שאלות שנכנסו ותשובות שנשלחו לפי יום */
export interface AnalyticsDayRow {
  date: string;
  count: number;
}

export interface AnalyticsChartData {
  createdByDay: AnalyticsDayRow[];
  sentByDay: AnalyticsDayRow[];
}

/** נתונים לדיאגרמת עוגה: כמות שאלות לפי נושא */
export interface AnalyticsTopicRow {
  topic_id: string | null;
  topic_name_he: string;
  count: number;
}

export async function getAnalyticsByTopic(filters: AnalyticsFilters = {}): Promise<AnalyticsTopicRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    const days = Math.min(365, Math.max(7, filters.days ?? 100));
    const from = new Date();
    from.setDate(from.getDate() - days + 1);
    from.setHours(0, 0, 0, 0);
    const fromIso = from.toISOString();

    let query = supabase
      .from("questions")
      .select("topic_id, topics(name_he)")
      .gte("created_at", fromIso)
      .is("deleted_at", null);

    if (filters.topicId) query = query.eq("topic_id", filters.topicId);
    if (filters.subTopicId) query = query.eq("sub_topic_id", filters.subTopicId);
    if (filters.respondentId) query = query.eq("assigned_respondent_id", filters.respondentId);
    if (filters.proofreaderId) query = query.eq("assigned_proofreader_id", filters.proofreaderId);
    if (filters.emailFilter?.trim()) query = query.ilike("asker_email", `%${filters.emailFilter.trim()}%`);

    const { data: rows } = await query;
    const byTopic: Record<string, number> = {};
    const nameByTopic: Record<string, string> = { _ללא_נושא_: "ללא נושא" };
    type TopicRow = { topic_id: string | null; topics?: { name_he: string } | { name_he: string }[] | null };
    for (const r of (rows ?? []) as TopicRow[]) {
      const id = r.topic_id ?? "_ללא_נושא_";
      byTopic[id] = (byTopic[id] ?? 0) + 1;
      const topicName = r.topics == null ? null : Array.isArray(r.topics) ? r.topics[0]?.name_he : r.topics.name_he;
      if (id !== "_ללא_נושא_" && topicName && !nameByTopic[id]) nameByTopic[id] = topicName;
    }
    const topicIds = Object.keys(byTopic).filter((k) => k !== "_ללא_נושא_");
    if (topicIds.length > 0 && Object.keys(nameByTopic).length - 1 < topicIds.length) {
      const { data: topics } = await supabase.from("topics").select("id, name_he").in("id", topicIds);
      if (topics) for (const t of topics) nameByTopic[t.id] = t.name_he ?? "אחר";
    }
    return Object.entries(byTopic)
      .map(([topic_id, count]) => ({
        topic_id: topic_id === "_ללא_נושא_" ? null : topic_id,
        topic_name_he: nameByTopic[topic_id] ?? "אחר",
        count,
      }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export interface AnalyticsFilters {
  days?: number;
  topicId?: string | null;
  subTopicId?: string | null;
  respondentId?: string | null;
  proofreaderId?: string | null;
  emailFilter?: string | null;
}

/** שורת שאלה לטבלת הסינון בנתונים — כל השדות הרלוונטיים */
export interface AnalyticsQuestionRow {
  id: string;
  short_id: string | null;
  title: string | null;
  content: string;
  stage: QuestionStage;
  created_at: string;
  sent_at: string | null;
  asker_email: string | null;
  topic_name_he: string | null;
  sub_topic_name_he: string | null;
  respondent_name: string | null;
  proofreader_name: string | null;
  response_type: "short" | "detailed" | null;
  publication_consent: string | null;
}

const ANALYTICS_QUESTIONS_SELECT =
  "id, short_id, title, content, stage, created_at, sent_at, asker_email, response_type, publication_consent, assigned_respondent_id, assigned_proofreader_id, topic_id, sub_topic_id, topics(name_he), sub_topics(name_he)";

/** שאלות מסוננות לטבלה — רק הסינון העליון; הדיאגרמות לא תלויות בזה */
export async function getAnalyticsFilteredQuestions(
  filters: AnalyticsFilters
): Promise<AnalyticsQuestionRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    const days = Math.min(365, Math.max(1, filters.days ?? 100));
    const from = new Date();
    from.setDate(from.getDate() - days + 1);
    from.setHours(0, 0, 0, 0);
    const fromIso = from.toISOString();

    let query = supabase
      .from("questions")
      .select(ANALYTICS_QUESTIONS_SELECT)
      .gte("created_at", fromIso)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (filters.topicId) query = query.eq("topic_id", filters.topicId);
    if (filters.subTopicId) query = query.eq("sub_topic_id", filters.subTopicId);
    if (filters.respondentId) query = query.eq("assigned_respondent_id", filters.respondentId);
    if (filters.proofreaderId) query = query.eq("assigned_proofreader_id", filters.proofreaderId);
    if (filters.emailFilter?.trim()) query = query.ilike("asker_email", `%${filters.emailFilter.trim()}%`);

    const { data: rows, error } = await query;
    if (error) return [];
    type Row = Record<string, unknown> & {
      id: string;
      short_id: string | null;
      title: string | null;
      content: string;
      stage: QuestionStage;
      created_at: string;
      sent_at: string | null;
      asker_email: string | null;
      response_type: "short" | "detailed" | null;
      publication_consent: string | null;
      assigned_respondent_id: string | null;
      assigned_proofreader_id: string | null;
      topics?: { name_he: string } | { name_he: string }[] | null;
      sub_topics?: { name_he: string } | { name_he: string }[] | null;
    };
    const list = (rows ?? []) as Row[];
    const nameFromRelation = (v: Row["topics"]): string | null =>
      v == null ? null : Array.isArray(v) ? v[0]?.name_he ?? null : v.name_he ?? null;
    const respondentIds = [...new Set(list.map((r) => r.assigned_respondent_id).filter(Boolean))] as string[];
    const proofreaderIds = [...new Set(list.map((r) => r.assigned_proofreader_id).filter(Boolean))] as string[];
    const profileIds = [...new Set([...respondentIds, ...proofreaderIds])];
    let profileNames: Record<string, string> = {};
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name_he")
        .in("id", profileIds);
      if (profiles) profileNames = Object.fromEntries(profiles.map((p) => [p.id, p.full_name_he ?? ""]));
    }
    return list.map((r) => ({
      id: r.id,
      short_id: r.short_id ?? null,
      title: r.title ?? null,
      content: r.content,
      stage: r.stage,
      created_at: r.created_at,
      sent_at: r.sent_at ?? null,
      asker_email: r.asker_email ?? null,
      topic_name_he: nameFromRelation(r.topics),
      sub_topic_name_he: nameFromRelation(r.sub_topics),
      respondent_name: r.assigned_respondent_id ? (profileNames[r.assigned_respondent_id]?.trim() || null) : null,
      proofreader_name: r.assigned_proofreader_id ? (profileNames[r.assigned_proofreader_id]?.trim() || null) : null,
      response_type: r.response_type ?? null,
      publication_consent: r.publication_consent ?? null,
    }));
  } catch {
    return [];
  }
}

export async function getAnalyticsChartData(filters: AnalyticsFilters = {}): Promise<AnalyticsChartData> {
  try {
    const supabase = getSupabaseAdmin();
    const days = Math.min(365, Math.max(7, filters.days ?? 100));
    const from = new Date();
    from.setDate(from.getDate() - days + 1);
    from.setHours(0, 0, 0, 0);
    const fromIso = from.toISOString();

    let createdQuery = supabase
      .from("questions")
      .select("created_at")
      .gte("created_at", fromIso)
      .is("deleted_at", null);
    let sentQuery = supabase
      .from("questions")
      .select("sent_at")
      .eq("stage", "sent_archived")
      .not("sent_at", "is", null)
      .gte("sent_at", fromIso);

    if (filters.topicId) {
      createdQuery = createdQuery.eq("topic_id", filters.topicId);
      sentQuery = sentQuery.eq("topic_id", filters.topicId);
    }
    if (filters.subTopicId) {
      createdQuery = createdQuery.eq("sub_topic_id", filters.subTopicId);
      sentQuery = sentQuery.eq("sub_topic_id", filters.subTopicId);
    }
    if (filters.respondentId) {
      createdQuery = createdQuery.eq("assigned_respondent_id", filters.respondentId);
      sentQuery = sentQuery.eq("assigned_respondent_id", filters.respondentId);
    }
    if (filters.proofreaderId) {
      createdQuery = createdQuery.eq("assigned_proofreader_id", filters.proofreaderId);
      sentQuery = sentQuery.eq("assigned_proofreader_id", filters.proofreaderId);
    }
    if (filters.emailFilter?.trim()) {
      createdQuery = createdQuery.ilike("asker_email", `%${filters.emailFilter.trim()}%`);
      sentQuery = sentQuery.ilike("asker_email", `%${filters.emailFilter.trim()}%`);
    }

    const [createdRes, sentRes] = await Promise.all([createdQuery, sentQuery]);
    const createdRows = (createdRes.data ?? []) as { created_at: string }[];
    const sentRows = (sentRes.data ?? []) as { sent_at: string | null }[];

    const createdByDay: Record<string, number> = {};
    const sentByDay: Record<string, number> = {};
    for (let d = 0; d < days; d++) {
      const date = new Date(from);
      date.setDate(date.getDate() + d);
      const key = date.toISOString().slice(0, 10);
      createdByDay[key] = 0;
      sentByDay[key] = 0;
    }
    for (const r of createdRows) {
      const key = r.created_at.slice(0, 10);
      if (createdByDay[key] != null) createdByDay[key]++;
    }
    for (const r of sentRows) {
      if (!r.sent_at) continue;
      const key = r.sent_at.slice(0, 10);
      if (sentByDay[key] != null) sentByDay[key]++;
    }

    return {
      createdByDay: Object.entries(createdByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
      sentByDay: Object.entries(sentByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
    };
  } catch {
    return { createdByDay: [], sentByDay: [] };
  }
}

/** שמירת תשובה מעורך לשוני – משתמש ב-service role כדי לעבור RLS (גם למגיהים לשוניים). */
export async function saveLinguisticResponse(
  questionId: string,
  answerId: string | null,
  responseText: string,
  linguisticSignature?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const trimmed = String(responseText ?? "").trim();
    if (answerId) {
      const { error } = await supabase
        .from("question_answers")
        .update({ response_text: trimmed || null, updated_at: new Date().toISOString() })
        .eq("id", answerId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase
        .from("questions")
        .update({ response_text: trimmed || null, updated_at: new Date().toISOString() })
        .eq("id", questionId);
      if (error) return { ok: false, error: error.message };
    }
    const sigTrim = sanitizeLinguisticSignatureStored(linguisticSignature).trim();
    const { error: sigError } = await supabase
      .from("questions")
      .update({ linguistic_signature: sigTrim || null, updated_at: new Date().toISOString() })
      .eq("id", questionId);
    if (sigError) {
      const msg = (sigError.message ?? "").toLowerCase();
      if (msg.includes("linguistic_signature")) {
        return {
          ok: false,
          error:
            "עמודת החתימה חסרה במסד הנתונים. הרץ את המיגרציה (linguistic_signature) ב-Supabase.",
        };
      }
      return { ok: false, error: sigError.message };
    }
    return { ok: true };
  } catch (e) {
    console.error("saveLinguisticResponse", e);
    return { ok: false, error: e instanceof Error ? e.message : "שגיאה בשמירה" };
  }
}

// =========================
// WhatsApp intake drafts (admin approval)
// =========================

export type DraftStatus = "in_progress" | "waiting_admin_approval" | "approved" | "cancelled";

export interface QuestionIntakeDraftItem {
  id: string;
  phone: string;
  status: DraftStatus;
  created_at: string;
  asker_gender: "M" | "F" | null;
  asker_age: number | null;
  title: string | null;
  content_preview: string;
  response_type: "short" | "detailed" | null;
  publication_consent: "publish" | "blur" | "none" | null;
  delivery_preference: "whatsapp" | "email" | "both" | null;
  asker_email: string | null;
  edit_count: number;
}

export interface DraftInboxMessageItem {
  id: string;
  received_at: string;
  message_type: string | null;
  text_body: string | null;
  provider_message_id: string;
}

export interface QuestionIntakeDraftDetails extends QuestionIntakeDraftItem {
  content: string;
  inbound_messages: DraftInboxMessageItem[];
}

export async function getWaitingQuestionIntakeDrafts(): Promise<QuestionIntakeDraftItem[]> {
  const supabase = getSupabaseAdmin();
  try {
    const { data, error } = await supabase
      .from("question_intake_drafts")
      .select("id, phone, status, created_at, asker_gender, asker_age, title, content, response_type, publication_consent, delivery_preference, asker_email, edit_count")
      .eq("status", "waiting_admin_approval")
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []).map((d) => ({
      id: d.id,
      phone: d.phone,
      status: d.status as DraftStatus,
      created_at: d.created_at,
      asker_gender: (d.asker_gender as "M" | "F" | null) ?? null,
      asker_age: d.asker_age ?? null,
      title: d.title ?? null,
      content_preview: (d.content ?? "").slice(0, 120),
      response_type: (d.response_type as any) ?? null,
      publication_consent: (d.publication_consent as any) ?? null,
      delivery_preference: (d.delivery_preference as any) ?? null,
      asker_email: d.asker_email ?? null,
      edit_count: d.edit_count ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function getQuestionIntakeDraftDetails(draftId: string): Promise<QuestionIntakeDraftDetails | null> {
  const supabase = getSupabaseAdmin();
  try {
    const { data: draft, error: dErr } = await supabase
      .from("question_intake_drafts")
      .select("id, phone, status, created_at, asker_gender, asker_age, title, content, response_type, publication_consent, delivery_preference, asker_email, edit_count")
      .eq("id", draftId)
      .maybeSingle();
    if (dErr || !draft) return null;

    const phone = draft.phone as string;
    const createdAt = draft.created_at as string;
    const { data: inbound, error: iErr } = await supabase
      .from("whatsapp_inbound_messages")
      .select("id, received_at, message_type, text_body, provider_message_id")
      .eq("from_phone", phone)
      .gte("received_at", createdAt)
      .order("received_at", { ascending: false })
      .limit(25);

    if (iErr) {
      return {
        id: draft.id,
        phone,
        status: draft.status as DraftStatus,
        created_at: draft.created_at,
        asker_gender: (draft.asker_gender as "M" | "F" | null) ?? null,
        asker_age: draft.asker_age ?? null,
        title: draft.title ?? null,
        content_preview: (draft.content ?? "").slice(0, 120),
        content: draft.content ?? "",
        response_type: (draft.response_type as any) ?? null,
        publication_consent: (draft.publication_consent as any) ?? null,
        delivery_preference: (draft.delivery_preference as any) ?? null,
        asker_email: draft.asker_email ?? null,
        edit_count: draft.edit_count ?? 0,
        inbound_messages: [],
      };
    }

    return {
      id: draft.id,
      phone,
      status: draft.status as DraftStatus,
      created_at: draft.created_at,
      asker_gender: (draft.asker_gender as "M" | "F" | null) ?? null,
      asker_age: draft.asker_age ?? null,
      title: draft.title ?? null,
      content_preview: (draft.content ?? "").slice(0, 120),
      content: draft.content ?? "",
      response_type: (draft.response_type as any) ?? null,
      publication_consent: (draft.publication_consent as any) ?? null,
      delivery_preference: (draft.delivery_preference as any) ?? null,
      asker_email: draft.asker_email ?? null,
      edit_count: draft.edit_count ?? 0,
      inbound_messages: (inbound ?? []) as DraftInboxMessageItem[],
    };
  } catch {
    return null;
  }
}

export async function updateQuestionIntakeDraft(
  draftId: string,
  patch: Partial<{
    asker_gender: "M" | "F" | null;
    asker_age: number | null;
    title: string | null;
    content: string | null;
    response_type: "short" | "detailed" | null;
    publication_consent: "publish" | "blur" | "none" | null;
    delivery_preference: "whatsapp" | "email" | "both" | null;
    asker_email: string | null;
  }>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  try {
    const update: Record<string, unknown> = {};
    if (patch.asker_gender !== undefined) update.asker_gender = patch.asker_gender;
    if (patch.asker_age !== undefined) update.asker_age = patch.asker_age;
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.content !== undefined) update.content = patch.content;
    if (patch.response_type !== undefined) update.response_type = patch.response_type;
    if (patch.publication_consent !== undefined) update.publication_consent = patch.publication_consent;
    if (patch.delivery_preference !== undefined) update.delivery_preference = patch.delivery_preference;
    if (patch.asker_email !== undefined) update.asker_email = patch.asker_email;

    update.updated_at = new Date().toISOString();

    const { error } = await supabase.from("question_intake_drafts").update(update).eq("id", draftId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export async function approveQuestionIntakeDraft(
  draftId: string
): Promise<{ ok: true; short_id?: string } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  try {
    const { data: draft, error: dErr } = await supabase
      .from("question_intake_drafts")
      .select("id, phone, status, asker_gender, asker_age, title, content, response_type, publication_consent, delivery_preference, asker_email")
      .eq("id", draftId)
      .maybeSingle();
    if (dErr || !draft) return { ok: false, error: "טיוטה לא נמצאה" };
    if ((draft as any).status !== "waiting_admin_approval") {
      return { ok: false, error: "אפשר לאשר רק טיוטות שממתינות לאישור" };
    }
    if (!draft.title || !draft.content) return { ok: false, error: "חסרים פרטים בטיוטה" };

    const { data: q, error: qErr } = await supabase
      .from("questions")
      .insert({
        stage: "waiting_assignment",
        title: draft.title,
        content: draft.content,
        asker_email: draft.asker_email ?? null,
        asker_phone: draft.phone,
        asker_gender: draft.asker_gender ?? null,
        asker_age: draft.asker_age != null ? String(draft.asker_age) : null,
        response_type: draft.response_type ?? "short",
        publication_consent: draft.publication_consent ?? "none",
        asker_delivery_preference: draft.delivery_preference ?? null,
        terms_accepted: true,
        updated_at: new Date().toISOString(),
      })
      .select("id, short_id")
      .single();

    if (qErr || !q) return { ok: false, error: qErr?.message ?? "Insert failed" };

    const shortId = (q.short_id ?? null) as string | null;

    const { error: upErr } = await supabase
      .from("question_intake_drafts")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftId);
    if (upErr) {
      // Still return success for insert; but log.
      console.error("approveQuestionIntakeDraft: update draft failed", upErr);
    }

    // Update conversation state to done only if this draft is still the active one.
    // This prevents a late approval of an old draft from closing a conversation
    // that the user has already restarted.
    const { data: conv, error: convErr } = await supabase
      .from("whatsapp_conversations")
      .select("context")
      .eq("phone", draft.phone)
      .maybeSingle();

    const activeDraftId = (conv?.context as any)?.activeDraftId as string | undefined;
    if (convErr) {
      console.error("approveQuestionIntakeDraft: fetch conversation context failed", convErr);
    }

    if (activeDraftId === draftId) {
      await supabase
        .from("whatsapp_conversations")
        .update({
          state: "done",
          // Clear context to avoid keeping a stale activeDraftId forever.
          context: {} as any,
          updated_at: new Date().toISOString(),
        })
        .eq("phone", draft.phone);
    }

    return { ok: true, short_id: shortId ?? undefined };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export async function discardQuestionIntakeDraft(
  draftId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  try {
    const { data: draft, error: dErr } = await supabase
      .from("question_intake_drafts")
      .select("id, phone, status")
      .eq("id", draftId)
      .maybeSingle();
    if (dErr || !draft) return { ok: false, error: "טיוטה לא נמצאה" };
    if ((draft as any).status !== "waiting_admin_approval") {
      return { ok: false, error: "אפשר להשליך רק טיוטות שממתינות לאישור" };
    }

    // If this draft is the active one for the phone conversation, clear it.
    const { data: conv, error: convErr } = await supabase
      .from("whatsapp_conversations")
      .select("context")
      .eq("phone", draft.phone)
      .maybeSingle();

    if (!convErr && conv?.context) {
      const activeDraftId = (conv.context as any)?.activeDraftId as string | undefined;
      if (activeDraftId === draftId) {
        await supabase
          .from("whatsapp_conversations")
          .update({ context: {} as any, updated_at: new Date().toISOString() })
          .eq("phone", draft.phone);
      }
    }

    const { error: upErr } = await supabase
      .from("question_intake_drafts")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", draftId);

    if (upErr) return { ok: false, error: upErr.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}
