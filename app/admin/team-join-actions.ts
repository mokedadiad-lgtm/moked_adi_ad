"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createTeamMember } from "@/app/admin/actions";
import { decryptTeamJoinPassword } from "@/lib/team-join-crypto";
import { generatePlainToken, hashTeamJoinToken } from "@/lib/team-join-token";
import { ASKER_AGE_RANGE_LABELS, type AskerAgeRangeLabel } from "@/lib/asker-age-ranges";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export type TeamJoinFormKind = "respondent" | "proofreader";

function isUuid(s: string | undefined | null): s is string {
  if (!s || typeof s !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

export interface TeamJoinSubmissionRow {
  id: string;
  form_kind: TeamJoinFormKind;
  status: "pending" | "approved" | "rejected";
  payload: Record<string, unknown>;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface TeamJoinTokenRow {
  id: string;
  form_kind: TeamJoinFormKind;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  /** URL מלא להעתקה — הטוקן הגלוי לא נשמר בשרת אחרי יצירה */
  join_url?: string;
}

export async function generateTeamJoinLink(
  formKind: TeamJoinFormKind,
  createdByProfileId?: string | null
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const plain = generatePlainToken();
    const token_hash = hashTeamJoinToken(plain);
    const { error } = await supabase.from("team_join_link_tokens").insert({
      token_hash,
      form_kind: formKind,
      is_active: true,
      ...(isUuid(createdByProfileId) ? { created_by: createdByProfileId.trim() } : {}),
    });
    if (error) return { ok: false, error: error.message };
    const url = `${APP_URL}/join-team/${formKind}?t=${encodeURIComponent(plain)}`;
    revalidatePath("/admin/team");
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function listTeamJoinTokens(): Promise<TeamJoinTokenRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("team_join_link_tokens")
      .select("id, form_kind, is_active, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return [];
    return (data ?? []) as TeamJoinTokenRow[];
  } catch {
    return [];
  }
}

export async function deactivateTeamJoinToken(
  tokenId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUuid(tokenId)) return { ok: false, error: "מזהה לא תקין" };
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("team_join_link_tokens")
      .update({ is_active: false })
      .eq("id", tokenId.trim());
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function listPendingTeamJoinSubmissions(): Promise<TeamJoinSubmissionRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("team_join_submissions")
      .select("id, form_kind, status, payload, admin_note, created_at, reviewed_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as TeamJoinSubmissionRow[];
  } catch {
    return [];
  }
}

export async function approveTeamJoinSubmission(
  submissionId: string,
  reviewerProfileId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: row, error: fetchErr } = await supabase
      .from("team_join_submissions")
      .select("id, form_kind, status, payload, password_ciphertext")
      .eq("id", submissionId)
      .maybeSingle();
    if (fetchErr || !row) return { ok: false, error: "בקשה לא נמצאה" };
    if (row.status !== "pending") return { ok: false, error: "הבקשה כבר טופלה" };
    if (!row.password_ciphertext) return { ok: false, error: "חסר נתון סיסמה" };

    let password: string;
    try {
      password = decryptTeamJoinPassword(row.password_ciphertext as string);
    } catch {
      return { ok: false, error: "פענוח סיסמה נכשל (בדקו TEAM_JOIN_SECRET)" };
    }

    const p = row.payload as Record<string, unknown>;
    const email = String(p.email ?? "").trim().toLowerCase();
    if (!email) return { ok: false, error: "חסר אימייל בבקשה" };

    const kind = row.form_kind as TeamJoinFormKind;

    const comm = (v: unknown): "whatsapp" | "email" | "both" =>
      v === "whatsapp" || v === "email" || v === "both" ? v : "email";

    if (kind === "respondent") {
      const topic_ids = Array.isArray(p.topic_ids) ? (p.topic_ids as string[]).filter(Boolean) : [];
      const respondent_age_ranges = Array.isArray(p.respondent_age_ranges)
        ? (p.respondent_age_ranges as string[]).filter((v): v is AskerAgeRangeLabel =>
            (ASKER_AGE_RANGE_LABELS as readonly string[]).includes(v)
          )
        : [];
      const result = await createTeamMember({
        email,
        password,
        full_name_he: p.full_name_he ? String(p.full_name_he) : null,
        gender: p.gender === "F" || p.gender === "M" ? p.gender : "M",
        is_respondent: true,
        is_proofreader: false,
        is_linguistic_editor: false,
        is_technical_lead: false,
        proofreader_type_ids: [],
        communication_preference: comm(p.communication_preference),
        phone: p.phone ? String(p.phone).trim() || null : null,
        concurrency_limit: Math.max(0, Number(p.concurrency_limit) || 1),
        cooldown_days: Math.max(0, Number(p.cooldown_days) || 7),
        category_ids: [],
        topic_ids,
        respondent_age_ranges,
      });
      if (!result.ok) return { ok: false, error: result.error };
    } else {
      const proofreader_type_ids = Array.isArray(p.proofreader_type_ids)
        ? (p.proofreader_type_ids as string[]).filter(Boolean)
        : [];
      if (proofreader_type_ids.length === 0) {
        return { ok: false, error: "בבקשה חסרים סוגי הגהה" };
      }
      const result = await createTeamMember({
        email,
        password,
        full_name_he: p.full_name_he ? String(p.full_name_he) : null,
        gender: p.gender === "F" || p.gender === "M" ? p.gender : "M",
        is_respondent: false,
        is_proofreader: true,
        is_linguistic_editor: false,
        is_technical_lead: false,
        proofreader_type_ids,
        communication_preference: comm(p.communication_preference),
        phone: p.phone ? String(p.phone).trim() || null : null,
        concurrency_limit: Math.max(0, Number(p.concurrency_limit) || 1),
        cooldown_days: Math.max(0, Number(p.cooldown_days) || 0),
        category_ids: Array.isArray(p.category_ids) ? (p.category_ids as string[]).filter(Boolean) : [],
        topic_ids: [],
        respondent_age_ranges: [],
      });
      if (!result.ok) return { ok: false, error: result.error };
    }

    const { error: upErr } = await supabase
      .from("team_join_submissions")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: isUuid(reviewerProfileId) ? reviewerProfileId!.trim() : null,
        password_ciphertext: null,
      })
      .eq("id", submissionId);
    if (upErr) return { ok: false, error: upErr.message };

    revalidatePath("/admin/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function rejectTeamJoinSubmission(
  submissionId: string,
  adminNote?: string,
  reviewerProfileId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("team_join_submissions")
      .update({
        status: "rejected",
        admin_note: adminNote?.trim() || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: isUuid(reviewerProfileId) ? reviewerProfileId!.trim() : null,
        password_ciphertext: null,
      })
      .eq("id", submissionId)
      .eq("status", "pending");
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שגיאה" };
  }
}
