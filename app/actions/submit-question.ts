"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendAdminInboxPush } from "@/lib/push/send-admin-inbox-push";

export type SubmitState = { ok: true } | { ok: false; error: string };

export async function submitQuestion(formData: FormData): Promise<SubmitState> {
  const email = String(formData.get("asker_email") ?? "").trim();
  const asker_gender = formData.get("asker_gender") as string | null;
  const asker_age = String(formData.get("asker_age") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const response_type = formData.get("response_type") as string | null;
  const publication_consent = formData.get("publication_consent") as string | null;
  const terms_accepted = formData.get("terms_accepted") === "on";

  if (!email) return { ok: false, error: "נא להזין אימייל לקבלת מענה." };
  if (!title) return { ok: false, error: "נא להזין כותרת השאלה." };
  if (!content) return { ok: false, error: "נא להזין את פירוט השאלה." };
  if (!response_type || !["short", "detailed"].includes(response_type))
    return { ok: false, error: "נא לבחור מסלול מענה." };
  if (!publication_consent || !["publish", "blur", "none"].includes(publication_consent))
    return { ok: false, error: "נא לבחור אפשרות פרסום." };
  if (!terms_accepted) return { ok: false, error: "נא לאשר את תנאי השימוש." };

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("questions")
      .insert({
        stage: "waiting_assignment",
        title: title || null,
        content,
        asker_email: email || null,
        asker_gender: asker_gender === "M" || asker_gender === "F" ? asker_gender : null,
        asker_age: asker_age || null,
        response_type: response_type as "short" | "detailed",
        publication_consent: publication_consent as "publish" | "blur" | "none",
        terms_accepted: true,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    // Push notification for admins (inbox bell/settings)
    void sendAdminInboxPush({
      title: "דואר נכנס",
      body: "שאלה חדשה נכנסה דרך הטופס",
      url: `/admin?open=${encodeURIComponent(data?.id ?? "")}`,
    }).catch((e) => console.error("submitQuestion: push notify failed", e));

    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "שגיאה בשמירה. נא לנסות שוב." };
  }
}
