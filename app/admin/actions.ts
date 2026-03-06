"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendAssignmentLinkToRespondent, sendInactivityReminder } from "@/lib/email";
import type { QuestionStage } from "@/lib/types";

function revalidateAdminTopics() {
  revalidatePath("/admin/topics");
  revalidatePath("/admin");
}

function safeError(message: string): string {
  return message || "שגיאה לא צפויה";
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

    const { data: lastSent } = await supabase
      .from("questions")
      .select("assigned_respondent_id, sent_at")
      .in("assigned_respondent_id", ids)
      .eq("stage", "sent_archived")
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false });
    const lastSentByRespondent: Record<string, string> = {};
    for (const q of lastSent ?? []) {
      if (q.assigned_respondent_id && q.sent_at && !lastSentByRespondent[q.assigned_respondent_id]) {
        lastSentByRespondent[q.assigned_respondent_id] = q.sent_at;
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

export async function sendReminderToRespondent(questionId: string): Promise<SendReminderResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: q, error: qe } = await supabase
      .from("questions")
      .select("content, assigned_respondent_id")
      .eq("id", questionId)
      .single();
    if (qe || !q?.assigned_respondent_id) return { ok: false, error: "שאלה או משיב לא נמצאו" };
    const { data: authUser } = await supabase.auth.admin.getUserById(q.assigned_respondent_id);
    const email = authUser?.user?.email?.trim();
    if (!email) return { ok: false, error: "לא נמצא אימייל למשיב/ה" };
    const res = await sendInactivityReminder(email, "respondent", q.content?.slice(0, 80));
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export async function sendReminderToProofreaders(questionId: string): Promise<SendReminderResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: q, error: qe } = await supabase
      .from("questions")
      .select("content, proofreader_type_id")
      .eq("id", questionId)
      .single();
    if (qe || !q) return { ok: false, error: "שאלה לא נמצאה" };
    const question = q as { content?: string; proofreader_type_id?: string | null };
    const builder = supabase.from("profiles").select("id").eq("is_proofreader", true);
    const { data: profiles } = question.proofreader_type_id
      ? await builder.eq("proofreader_type_id", question.proofreader_type_id)
      : await builder;
    if (!profiles?.length) return { ok: false, error: "לא נמצאו מגיהים רלוונטיים" };
    const ids = profiles.map((p) => p.id);
    const emails: string[] = [];
    for (const id of ids) {
      const { data: u } = await supabase.auth.admin.getUserById(id);
      if (u?.user?.email?.trim()) emails.push(u.user.email.trim());
    }
    if (emails.length === 0) return { ok: false, error: "לא נמצא אימייל למגיהים" };
    for (const to of emails) {
      await sendInactivityReminder(to, "proofreader", question.content?.slice(0, 80));
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

export type AssignResult = { ok: true } | { ok: false; error: string };

export async function assignQuestion(
  questionId: string,
  respondentId: string,
  topicId?: string | null,
  subTopicId?: string | null
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
    const { error } = await supabase
      .from("questions")
      .update({
        assigned_respondent_id: respondentId,
        stage: "with_respondent",
        topic_id: topicId || null,
        sub_topic_id: subTopicId || null,
        proofreader_type_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", questionId);

    if (error) return { ok: false, error: error.message };

    // שליחת מייל למשיב אם ההעדפה היא email או both
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name_he, admin_note, communication_preference")
        .eq("id", respondentId)
        .single();
      const pref = profile?.communication_preference as string | undefined;
      if (pref === "email" || pref === "both") {
        const { data: authUser } = await supabase.auth.admin.getUserById(respondentId);
        const email = authUser?.user?.email?.trim();
        if (email) {
          await sendAssignmentLinkToRespondent(
            email,
            profile?.full_name_he ?? null,
            profile?.admin_note ?? null
          );
        }
      }
    } catch (mailErr) {
      console.error("assignQuestion: email send failed", mailErr);
      // לא נכשלים בגלל מייל – השיבוץ הצליח
    }
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
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeError((e as Error)?.message) };
  }
}

/** העברה לאשפה (soft delete): מעדכן deleted_at בשאלה */
export async function deleteQuestion(
  questionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
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
  proofreader_type_id: string | null;
  proofreader_type_name_he: string | null;
  communication_preference: "whatsapp" | "email" | "both";
  concurrency_limit: number;
  cooldown_days: number;
  admin_note: string | null;
  category_ids: string[];
}

export async function getTeamProfiles(): Promise<TeamProfileRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: profiles, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name_he, gender, is_respondent, is_proofreader, is_linguistic_editor, proofreader_type_id, communication_preference, concurrency_limit, cooldown_days, admin_note, phone"
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

  const typeIds = [...new Set((profiles ?? []).map((p) => p.proofreader_type_id).filter(Boolean))] as string[];
  const typeMap: Record<string, string> = {};
  if (typeIds.length > 0) {
    const { data: types } = await supabase.from("proofreader_types").select("id, name_he").in("id", typeIds);
    for (const t of types ?? []) typeMap[t.id] = t.name_he;
  }

  const { data: pc } = await supabase.from("profile_categories").select("profile_id, category_id");
  const categoriesByProfile: Record<string, string[]> = {};
  for (const id of ids) categoriesByProfile[id] = [];
  for (const row of pc ?? []) {
    if (categoriesByProfile[row.profile_id]) categoriesByProfile[row.profile_id].push(row.category_id);
  }

  return (profiles ?? []).map((p) => ({
      id: p.id,
      full_name_he: p.full_name_he ?? null,
      email: emailMap[p.id] ?? null,
      phone: p.phone ?? null,
      gender: p.gender as "M" | "F",
      is_respondent: p.is_respondent ?? false,
      is_proofreader: p.is_proofreader ?? false,
      is_linguistic_editor: p.is_linguistic_editor ?? false,
      proofreader_type_id: p.proofreader_type_id ?? null,
      proofreader_type_name_he: p.proofreader_type_id ? typeMap[p.proofreader_type_id] ?? null : null,
      communication_preference: (p.communication_preference ?? "email") as TeamProfileRow["communication_preference"],
      concurrency_limit: p.concurrency_limit ?? 1,
      cooldown_days: p.cooldown_days ?? 0,
      admin_note: p.admin_note ?? null,
      category_ids: categoriesByProfile[p.id] ?? [],
    }));
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
    proofreader_type_id: string | null;
    communication_preference: "whatsapp" | "email" | "both";
    phone: string | null;
    concurrency_limit: number;
    cooldown_days: number;
    admin_note: string | null;
    category_ids: string[];
  }
): Promise<UpdateTeamMemberResult> {
  try {
    const supabase = getSupabaseAdmin();
    const proofreader_type_id = data.is_proofreader ? data.proofreader_type_id : null;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name_he: data.full_name_he || null,
        gender: data.gender,
        is_respondent: data.is_respondent,
        is_proofreader: data.is_proofreader,
        is_linguistic_editor: data.is_linguistic_editor,
        proofreader_type_id,
        communication_preference: data.communication_preference,
        phone: data.phone?.trim() || null,
        concurrency_limit: data.concurrency_limit,
        cooldown_days: data.cooldown_days,
        admin_note: data.admin_note || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId);

    if (error) return { ok: false, error: error.message };

    await supabase.from("profile_categories").delete().eq("profile_id", profileId);
    if (data.category_ids.length > 0) {
      await supabase.from("profile_categories").insert(
        data.category_ids.map((category_id) => ({ profile_id: profileId, category_id }))
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
  proofreader_type_id: string | null;
  communication_preference: "whatsapp" | "email" | "both";
  phone: string | null;
  concurrency_limit: number;
  cooldown_days: number;
  admin_note: string | null;
  category_ids: string[];
}): Promise<CreateTeamMemberResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email.trim(),
      password: data.password,
      email_confirm: true,
    });

    if (authError) return { ok: false, error: authError.message };
    const userId = authData.user?.id;
    if (!userId) return { ok: false, error: "לא נוצר משתמש" };

    const proofreader_type_id = data.is_proofreader ? data.proofreader_type_id : null;
    const profileRow = {
      id: userId,
      full_name_he: data.full_name_he || null,
      gender: data.gender,
      is_respondent: data.is_respondent,
      is_proofreader: data.is_proofreader,
      is_linguistic_editor: data.is_linguistic_editor,
      proofreader_type_id,
      communication_preference: data.communication_preference,
      phone: data.phone?.trim() || null,
      concurrency_limit: data.concurrency_limit,
      cooldown_days: data.cooldown_days,
      admin_note: data.admin_note || null,
    };
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(profileRow, { onConflict: "id" });

    if (profileError) return { ok: false, error: profileError.message };

    if (data.category_ids.length > 0) {
      await supabase.from("profile_categories").insert(
        data.category_ids.map((category_id) => ({ profile_id: userId, category_id }))
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
