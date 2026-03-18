export type Gender = "M" | "F";
export type ResponseType = "short" | "detailed";
export type PublicationConsent = "publish" | "blur" | "none";
export type DeliveryPreference = "whatsapp" | "email" | "both";

export type BotConversationState =
  | "start"
  | "gender"
  | "choose_mode"
  | "age"
  | "body_collect"
  | "title_collect"
  | "response_type"
  | "publication_consent"
  | "delivery_preference"
  | "collect_email"
  | "confirm"
  | "edit_field_choice"
  | "edit_gender"
  | "edit_age"
  | "edit_body"
  | "edit_title"
  | "edit_response_type"
  | "edit_publication_consent"
  | "edit_delivery_preference"
  | "waiting_admin_approval"
  | "done";

export type BotContext = {
  asker_gender?: Gender;
  asker_age?: number;
  bodyParts?: string[];
  title?: string;
  response_type?: ResponseType;
  publication_consent?: PublicationConsent;
  delivery_preference?: DeliveryPreference;
  asker_email?: string;
  edit_count?: number;
  chosen_edit_field?: string;
};

export type InboundBotEvent = {
  text?: string | null;
  buttonId?: string | null;
};

export type OutboundAction =
  | { kind: "text"; text: string }
  | { kind: "buttons"; bodyText: string; buttons: Array<{ id: string; title: string }> };

export type BotFsmResult =
  | {
      ok: true;
      nextState: BotConversationState;
      nextContext: BotContext;
      outbound: OutboundAction[];
      // If true, bot created a draft awaiting admin approval and should not advance automatically further.
      createdDraft?: boolean;
    }
  | { ok: false; error: string };

function safeTrim(s: string | undefined | null): string {
  return (s ?? "").trim();
}

function parseAge(text: string | undefined | null): number | null {
  const t = safeTrim(text);
  if (!t) return null;
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeTextCommand(raw: string | undefined | null): string {
  return safeTrim(raw).replace(/\s+/g, " ");
}

function isNewProcessKeyword(text: string | undefined | null): boolean {
  const t = normalizeTextCommand(text);
  const lower = t.toLowerCase();
  return (
    lower.includes("שאלה חדשה") ||
    lower.includes("שאלה") && lower.includes("חדשה") ||
    lower.includes("התחל מחדש") ||
    lower === "התחל מחדש"
  );
}

export async function runBotFsm(params: {
  toPhoneRaw: string;
  currentState: BotConversationState;
  currentContext: BotContext;
  inbound: InboundBotEvent;
  createDraftFn: (draft: {
    phone: string;
    asker_gender: Gender;
    asker_age: number;
    title: string;
    content: string;
    response_type: ResponseType;
    publication_consent: PublicationConsent;
    delivery_preference: DeliveryPreference;
    asker_email?: string;
    terms_accepted: boolean;
  }) => Promise<{ ok: true; draftId: string } | { ok: false; error: string }>;
}): Promise<BotFsmResult> {
  const { currentState, currentContext, inbound, toPhoneRaw, createDraftFn } = params;
  const text = normalizeTextCommand(inbound.text);
  const buttonId = safeTrim(inbound.buttonId ?? undefined) || null;

  const ctx: BotContext = { ...(currentContext ?? {}) };
  ctx.edit_count = ctx.edit_count ?? 0;
  ctx.bodyParts = ctx.bodyParts ?? [];

  const outbound: OutboundAction[] = [];

  const buttons = (arr: Array<{ id: string; title: string }>): OutboundAction[] => [{ kind: "buttons", bodyText: "", buttons: arr }];

  // Helper: send Meta after decision (webhook will call these for real). Here we return actions only.
  const sendButtons = (bodyText: string, btns: Array<{ id: string; title: string }>) => {
    outbound.push({ kind: "buttons", bodyText, buttons: btns });
  };
  const sendText = (t: string) => outbound.push({ kind: "text", text: t });

  // Global escape to new process
  if (currentState === "waiting_admin_approval" && isNewProcessKeyword(text)) {
    // Start over as a new bot process, ignore current draft.
    sendText("פתחנו פנייה חדשה.\nהפנייה הקודמת עדיין נמצאת בבדיקה אצל מנהל תפעולי.");
    sendText("נא לבחור את המגדר באמצעות הכפתורים: זכר / נקבה");
    return { ok: true, nextState: "gender", nextContext: {}, outbound };
  }

  switch (currentState) {
    case "start": {
      // Bot entry: ask gender
      sendText(
        "שלום רב.\nשמי מערכת “שאל את המערכת”.\nהמספר שממנו נשלחת ההודעה מזוהה לצורך יצירת הקשר ומעקב אחר הבקשה.\nהשירות מיועד לציבור בגיל 18–99.\nנא לבחור את המגדר באמצעות הכפתורים."
      );
      sendButtons("בחר/י מגדר:", [
        { id: "GENDER_M", title: "זכר" },
        { id: "GENDER_F", title: "נקבה" },
      ]);
      return { ok: true, nextState: "gender", nextContext: ctx, outbound };
    }

    case "gender": {
      const g =
        buttonId === "GENDER_M" ? ("M" as const) :
        buttonId === "GENDER_F" ? ("F" as const) :
        (text === "זכר" ? ("M" as const) : text === "נקבה" ? ("F" as const) : null);
      if (!g) {
        sendText("לא זיהיתי בחירה תקינה.\nנא לבחור את המגדר באמצעות הכפתורים: `זכר` או `נקבה`.");
        sendButtons("בחירה:", [
          { id: "GENDER_M", title: "זכר" },
          { id: "GENDER_F", title: "נקבה" },
        ]);
        return { ok: true, nextState: "gender", nextContext: ctx, outbound };
      }
      ctx.asker_gender = g;
      sendText("תודה.\nכיצד תרצה/י להתנהל מול המענה?");
      sendButtons("", [
        { id: "MODE_BOT", title: "מענה באמצעות הבוט" },
        { id: "MODE_HUMAN", title: "נציג אנושי" },
      ]);
      return { ok: true, nextState: "choose_mode", nextContext: ctx, outbound };
    }

    case "choose_mode": {
      if (buttonId === "MODE_HUMAN" || text === "נציג אנושי" || text === "נציג" || text === "אדם") {
        sendText("פנייתך הועברה לטיפול נציג אנושי.\nניצור עמך קשר בהקדם האפשרי.");
        return { ok: true, nextState: "done", nextContext: ctx, outbound };
      }
      // Default to bot flow
      ctx.delivery_preference = ctx.delivery_preference ?? "whatsapp";
      sendText("נא להזין את הגיל שלך באמצעות מספר בלבד (טווח 18–99).");
      return { ok: true, nextState: "age", nextContext: ctx, outbound };
    }

    case "age": {
      const n = parseAge(text);
      if (n == null || n < 18 || n > 99) {
        // Track attempts via a simple counter in context
        const prevBad = (ctx as any).age_bad_count ?? 0;
        const badCount = prevBad + 1;
        (ctx as any).age_bad_count = badCount;
        if (badCount >= 2) {
          sendText("השירות אינו מיועד למישהו בגילך.\nתודה על פנייתך. השיחה תיסגר כעת.");
          return { ok: true, nextState: "done", nextContext: ctx, outbound };
        }
        sendText("הגיל שהוזן אינו בטווח הנדרש או שאינו מספר.\nנא להזין גיל מספרי בין 18 ל־99.");
        return { ok: true, nextState: "age", nextContext: ctx, outbound };
      }
      ctx.asker_age = n;
      ctx.bodyParts = [];
      sendText("כעת נא לכתוב את השאלה שלך.\nניתן לשלוח את התוכן במספר הודעות.\nלאחר שתסיים/י, לחץ/י על `סיימתי`.");
      sendButtons("סיימת?", [
        { id: "BODY_ADD_MORE", title: "הוסף עוד" },
        { id: "BODY_DONE", title: "סיימתי" },
      ]);
      return { ok: true, nextState: "body_collect", nextContext: ctx, outbound };
    }

    case "body_collect": {
      // If user sends text: append
      if (text) ctx.bodyParts = [...(ctx.bodyParts ?? []), text];

      if (buttonId === "BODY_DONE" || text === "סיימתי") {
        const content = (ctx.bodyParts ?? []).join("\n").trim();
        if (!content) {
          sendText("לא נקלט תוכן שאלה תקין.\nנא לכתוב את השאלה באופן ברור.");
          sendButtons("המשך", [
            { id: "BODY_ADD_MORE", title: "הוסף עוד" },
            { id: "BODY_DONE", title: "סיימתי" },
          ]);
          return { ok: true, nextState: "body_collect", nextContext: ctx, outbound };
        }
        ctx.bodyParts = [];
        sendText("נא להזין כותרת קצרה לשאלה.");
        sendButtons("כותרת", [
          { id: "TITLE_DONE", title: "סיימתי" },
          { id: "TITLE_ADD_MORE", title: "הוסף עוד" },
        ]);
        // Store content temporarily in ctx.title? we'll keep in ctx as `content` later through next step
        (ctx as any).content = content;
        return { ok: true, nextState: "title_collect", nextContext: ctx, outbound };
      }

      // Add more: just keep state
      if (buttonId === "BODY_ADD_MORE" || text === "הוסף עוד") {
        sendText("מצוין. המשך/י לכתוב את השאלה (אפשר במספר הודעות).");
        sendButtons("המשך?", [
          { id: "BODY_ADD_MORE", title: "הוסף עוד" },
          { id: "BODY_DONE", title: "סיימתי" },
        ]);
        return { ok: true, nextState: "body_collect", nextContext: ctx, outbound };
      }

      // If no buttons, allow typing; stay in same state.
      sendText("המשך/י לכתוב את תוכן השאלה. בסיום לחץ/י `סיימתי`.");
      return { ok: true, nextState: "body_collect", nextContext: ctx, outbound };
    }

    case "title_collect": {
      if (text) {
        // Single title field: replace with latest unless user asks to add more
        const prevTitle = ctx.title ?? "";
        const addMore = buttonId === "TITLE_ADD_MORE" || text === "הוסף עוד";
        if (addMore && prevTitle) ctx.title = `${prevTitle}\n${text}`.trim();
        else ctx.title = text;
      }

      if (buttonId === "TITLE_DONE" || text === "סיימתי") {
        const title = (ctx.title ?? "").trim();
        const content = ((ctx as any).content ?? "").trim() as string;
        if (!content) {
          sendText("חלה תקלה פנימית: חסר תוכן השאלה.\nנא להתחיל מחדש.");
          return { ok: false, error: "missing_content" };
        }
        if (!title) {
          sendText("נא להזין כותרת לשאלה.");
          return { ok: true, nextState: "title_collect", nextContext: ctx, outbound };
        }
        sendText("באיזו רמת פירוט תרצה/י לקבל מענה?");
        sendButtons("בחירה", [
          { id: "RESP_SHORT", title: "קצר ולעניין" },
          { id: "RESP_DETAILED", title: "מורחב" },
        ]);
        return { ok: true, nextState: "response_type", nextContext: ctx, outbound };
      }

      // stay
      sendText("אפשר לשלוח את הכותרת. בסיום לחץ/י `סיימתי`.");
      return { ok: true, nextState: "title_collect", nextContext: ctx, outbound };
    }

    case "response_type": {
      const rt =
        buttonId === "RESP_SHORT" ? ("short" as const) :
        buttonId === "RESP_DETAILED" ? ("detailed" as const) :
        (text === "קצר" || text === "קצר ולעניין" ? ("short" as const) : text === "מורחב" ? ("detailed" as const) : null);
      if (!rt) {
        sendText("לא זיהיתי בחירה.\nנא לבחור: קצר ולעניין / מורחב.");
        sendButtons("בחירה", [
          { id: "RESP_SHORT", title: "קצר ולעניין" },
          { id: "RESP_DETAILED", title: "מורחב" },
        ]);
        return { ok: true, nextState: "response_type", nextContext: ctx, outbound };
      }
      ctx.response_type = rt;
      sendText("נא לבחור אפשרות לפרסום התשובה:\nאפשר לפרסם / פרסום בטשטוש / ללא פרסום");
      sendButtons("פרסום", [
        { id: "PUB_PUBLISH", title: "אפשר לפרסם" },
        { id: "PUB_BLUR", title: "פרסום בטשטוש" },
        { id: "PUB_NONE", title: "ללא פרסום" },
      ]);
      return { ok: true, nextState: "publication_consent", nextContext: ctx, outbound };
    }

    case "publication_consent": {
      const pc =
        buttonId === "PUB_PUBLISH" ? ("publish" as const) :
        buttonId === "PUB_BLUR" ? ("blur" as const) :
        buttonId === "PUB_NONE" ? ("none" as const) :
        (text === "אפשר לפרסם" || text === "פרסום" ? ("publish" as const) :
          text === "פרסום בטשטוש" ? ("blur" as const) :
          text === "ללא פרסום" ? ("none" as const) : null);
      if (!pc) {
        sendText("לא זיהיתי בחירה תקינה בפרסום.\nנא לבחור שוב.");
        sendButtons("פרסום", [
          { id: "PUB_PUBLISH", title: "אפשר לפרסם" },
          { id: "PUB_BLUR", title: "פרסום בטשטוש" },
          { id: "PUB_NONE", title: "ללא פרסום" },
        ]);
        return { ok: true, nextState: "publication_consent", nextContext: ctx, outbound };
      }
      ctx.publication_consent = pc;
      sendText("כיצד תרצה/י לקבל את התשובה?");
      sendButtons("ערוץ", [
        { id: "DELIV_WHATSAPP", title: "וואטסאפ" },
        { id: "DELIV_EMAIL", title: "אימייל" },
        { id: "DELIV_BOTH", title: "גם וואטסאפ וגם אימייל" },
      ]);
      return { ok: true, nextState: "delivery_preference", nextContext: ctx, outbound };
    }

    case "delivery_preference": {
      const dp =
        buttonId === "DELIV_WHATSAPP" ? ("whatsapp" as const) :
        buttonId === "DELIV_EMAIL" ? ("email" as const) :
        buttonId === "DELIV_BOTH" ? ("both" as const) :
        (text === "וואטסאפ" ? ("whatsapp" as const) :
          text === "אימייל" ? ("email" as const) :
          text === "גם וואטסאפ וגם אימייל" ? ("both" as const) : null);
      if (!dp) {
        sendText("לא זיהיתי בחירה בערוץ.\nנא לבחור: וואטסאפ / אימייל / גם וגם.");
        sendButtons("ערוץ", [
          { id: "DELIV_WHATSAPP", title: "וואטסאפ" },
          { id: "DELIV_EMAIL", title: "אימייל" },
          { id: "DELIV_BOTH", title: "גם וואטסאפ וגם אימייל" },
        ]);
        return { ok: true, nextState: "delivery_preference", nextContext: ctx, outbound };
      }
      ctx.delivery_preference = dp;
      if (dp === "email") {
        sendText("נא להזין כתובת אימייל לקבלת התשובה.");
        return { ok: true, nextState: "collect_email", nextContext: ctx, outbound };
      }
      if (dp === "both") {
        sendText("נא להזין כתובת אימייל לקבלת התשובה.");
        return { ok: true, nextState: "collect_email", nextContext: ctx, outbound };
      }
      // whatsapp only
      return showConfirm(outbound, ctx);
    }

    case "collect_email": {
      const em = safeTrim(text);
      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        sendText("כתובת האימייל שהוזנה אינה תקינה.\nנא להזין כתובת אימייל תקינה.");
        return { ok: true, nextState: "collect_email", nextContext: ctx, outbound };
      }
      ctx.asker_email = em;
      return showConfirm(outbound, ctx);
    }

    case "confirm": {
      const wantsEdit =
        buttonId === "CONFIRM_EDIT" ||
        text === "שנה משהו" ||
        text === "שינויים" ||
        text === "עריכה";
      const wantsDone =
        buttonId === "CONFIRM_DONE" ||
        text === "סיום ואישור פנייה" ||
        text === "זהו" ||
        text === "מאשר" ||
        text === "אישור";

      if (wantsEdit) {
        // Can't show 8 options as quick buttons (limit 3) => text list
        sendText("איזה שדה תרצה/י לשנות? נא השב/י באחד מהבאים:");
        sendText("מגדר / גיל / שאלה / כותרת / מסלול מענה / פרסום / ערוץ קבלת תשובה");
        return { ok: true, nextState: "edit_field_choice", nextContext: ctx, outbound };
      }
      if (wantsDone) {
        // Create draft
        const asker_gender = ctx.asker_gender as Gender | undefined;
        const asker_age = ctx.asker_age as number | undefined;
        const title = (ctx.title ?? "").trim();
        const content = (((ctx as any).content ?? "") as string).trim();
        const response_type = ctx.response_type as ResponseType | undefined;
        const publication_consent = ctx.publication_consent as PublicationConsent | undefined;
        const delivery_preference = ctx.delivery_preference as DeliveryPreference | undefined;
        if (!asker_gender || !asker_age || !title || !content || !response_type || !publication_consent || !delivery_preference) {
          return { ok: false, error: "missing_fields" };
        }
        const createRes = await createDraftFn({
          phone: toPhoneRaw,
          asker_gender,
          asker_age,
          title,
          content,
          response_type,
          publication_consent,
          delivery_preference,
          asker_email: ctx.asker_email,
          terms_accepted: true,
        });
        if (!createRes.ok) return { ok: false, error: createRes.error };

        sendText("תודה.\nהפנייה שלך התקבלה והועברה לאישור מנהל תפעולי.\nנעדכן אותך לאחר האישור.");
        return { ok: true, nextState: "waiting_admin_approval", nextContext: ctx, outbound, createdDraft: true };
      }

      // Default: re-show confirm
      return showConfirm(outbound, ctx);
    }

    case "edit_field_choice": {
      const field = text;
      const allowed = ["מגדר", "גיל", "שאלה", "כותרת", "מסלול מענה", "פרסום", "ערוץ קבלת תשובה"];
      if (!allowed.includes(field)) {
        sendText("לא זיהיתי שדה.\nנא לבחור אחד מהאפשרויות הרשומות:");
        sendText("מגדר / גיל / שאלה / כותרת / מסלול מענה / פרסום / ערוץ קבלת תשובה");
        return { ok: true, nextState: "edit_field_choice", nextContext: ctx, outbound };
      }
      ctx.chosen_edit_field = field;

      if (field === "מגדר") {
        sendText("נא להזין מחדש את המגדר באמצעות הכפתורים: זכר או נקבה.");
        sendButtons("מגדר", [
          { id: "GENDER_M", title: "זכר" },
          { id: "GENDER_F", title: "נקבה" },
        ]);
        return { ok: true, nextState: "edit_gender", nextContext: ctx, outbound };
      }
      if (field === "גיל") {
        sendText("נא להזין גיל מספרי בין 18 ל־99.");
        return { ok: true, nextState: "edit_age", nextContext: ctx, outbound };
      }
      if (field === "שאלה") {
        ctx.bodyParts = [];
        sendText("נא לכתוב את תוכן השאלה החדש.\nניתן לשלוח במספר הודעות.\nבסיום לחץ/י `סיימתי`.");
        sendButtons("סיימת?", [
          { id: "BODY_ADD_MORE", title: "הוסף עוד" },
          { id: "BODY_DONE", title: "סיימתי" },
        ]);
        return { ok: true, nextState: "edit_body", nextContext: ctx, outbound };
      }
      if (field === "כותרת") {
        sendText("נא להזין כותרת חדשה לשאלה.");
        return { ok: true, nextState: "edit_title", nextContext: ctx, outbound };
      }
      if (field === "מסלול מענה") {
        sendText("באיזו רמת פירוט תרצה/י לקבל מענה?");
        sendButtons("מסלול", [
          { id: "RESP_SHORT", title: "קצר ולעניין" },
          { id: "RESP_DETAILED", title: "מורחב" },
        ]);
        return { ok: true, nextState: "edit_response_type", nextContext: ctx, outbound };
      }
      if (field === "פרסום") {
        sendText("נא לבחור אפשרות לפרסום:");
        sendButtons("פרסום", [
          { id: "PUB_PUBLISH", title: "אפשר לפרסם" },
          { id: "PUB_BLUR", title: "פרסום בטשטוש" },
          { id: "PUB_NONE", title: "ללא פרסום" },
        ]);
        return { ok: true, nextState: "edit_publication_consent", nextContext: ctx, outbound };
      }
      // ערוץ קבלת תשובה
      sendText("כיצד תרצה/י לקבל את התשובה?");
      sendButtons("ערוץ", [
        { id: "DELIV_WHATSAPP", title: "וואטסאפ" },
        { id: "DELIV_EMAIL", title: "אימייל" },
        { id: "DELIV_BOTH", title: "גם וואטסאפ וגם אימייל" },
      ]);
      return { ok: true, nextState: "edit_delivery_preference", nextContext: ctx, outbound };
    }

    case "edit_gender": {
      const g =
        buttonId === "GENDER_M" ? ("M" as const) :
        buttonId === "GENDER_F" ? ("F" as const) :
        (text === "זכר" ? ("M" as const) : text === "נקבה" ? ("F" as const) : null);
      if (!g) {
        sendText("לא זיהיתי בחירה. נא לבחור באמצעות הכפתורים: זכר / נקבה.");
        sendButtons("מגדר", [
          { id: "GENDER_M", title: "זכר" },
          { id: "GENDER_F", title: "נקבה" },
        ]);
        return { ok: true, nextState: "edit_gender", nextContext: ctx, outbound };
      }
      ctx.asker_gender = g;
      ctx.edit_count = (ctx.edit_count ?? 0) + 1;
      return showConfirm(outbound, ctx);
    }

    case "edit_age": {
      const n = parseAge(text);
      if (n == null || n < 18 || n > 99) {
        sendText("נא להזין גיל מספרי בין 18 ל־99.");
        return { ok: true, nextState: "edit_age", nextContext: ctx, outbound };
      }
      ctx.asker_age = n;
      ctx.edit_count = (ctx.edit_count ?? 0) + 1;
      // After edit, go back confirm
      return showConfirm(outbound, ctx);
    }

    case "edit_body": {
      if (text) ctx.bodyParts = [...(ctx.bodyParts ?? []), text];
      if (buttonId === "BODY_DONE" || text === "סיימתי") {
        const content = (ctx.bodyParts ?? []).join("\n").trim();
        if (!content) {
          sendText("לא נקלט תוכן שאלה תקין.\nנא לכתוב את השאלה באופן ברור.");
          return { ok: true, nextState: "edit_body", nextContext: ctx, outbound };
        }
        (ctx as any).content = content;
        ctx.bodyParts = [];
        ctx.edit_count = (ctx.edit_count ?? 0) + 1;
        return showConfirm(outbound, ctx);
      }
      sendText("המשך/י לכתוב את תוכן השאלה החדש. בסיום לחץ/י `סיימתי`.");
      return { ok: true, nextState: "edit_body", nextContext: ctx, outbound };
    }

    case "edit_title": {
      if (!text) {
        sendText("נא להזין כותרת חדשה.");
        return { ok: true, nextState: "edit_title", nextContext: ctx, outbound };
      }
      ctx.title = text;
      ctx.edit_count = (ctx.edit_count ?? 0) + 1;
      return showConfirm(outbound, ctx);
    }

    case "edit_response_type": {
      const rt =
        buttonId === "RESP_SHORT" ? ("short" as const) :
        buttonId === "RESP_DETAILED" ? ("detailed" as const) :
        (text === "קצר ולעניין" || text === "קצר" ? ("short" as const) : text === "מורחב" ? ("detailed" as const) : null);
      if (!rt) {
        sendText("לא זיהיתי בחירה. נא לבחור שוב.");
        sendButtons("מסלול", [
          { id: "RESP_SHORT", title: "קצר ולעניין" },
          { id: "RESP_DETAILED", title: "מורחב" },
        ]);
        return { ok: true, nextState: "edit_response_type", nextContext: ctx, outbound };
      }
      ctx.response_type = rt;
      ctx.edit_count = (ctx.edit_count ?? 0) + 1;
      return showConfirm(outbound, ctx);
    }

    case "edit_publication_consent": {
      const pc =
        buttonId === "PUB_PUBLISH" ? ("publish" as const) :
        buttonId === "PUB_BLUR" ? ("blur" as const) :
        buttonId === "PUB_NONE" ? ("none" as const) :
        (text === "אפשר לפרסם" ? ("publish" as const) :
          text === "פרסום בטשטוש" ? ("blur" as const) :
          text === "ללא פרסום" ? ("none" as const) : null);
      if (!pc) {
        sendText("לא זיהיתי בחירה. נא לבחור שוב.");
        sendButtons("פרסום", [
          { id: "PUB_PUBLISH", title: "אפשר לפרסם" },
          { id: "PUB_BLUR", title: "פרסום בטשטוש" },
          { id: "PUB_NONE", title: "ללא פרסום" },
        ]);
        return { ok: true, nextState: "edit_publication_consent", nextContext: ctx, outbound };
      }
      ctx.publication_consent = pc;
      ctx.edit_count = (ctx.edit_count ?? 0) + 1;
      return showConfirm(outbound, ctx);
    }

    case "edit_delivery_preference": {
      const dp =
        buttonId === "DELIV_WHATSAPP" ? ("whatsapp" as const) :
        buttonId === "DELIV_EMAIL" ? ("email" as const) :
        buttonId === "DELIV_BOTH" ? ("both" as const) :
        (text === "וואטסאפ" ? ("whatsapp" as const) :
          text === "אימייל" ? ("email" as const) :
          text === "גם וואטסאפ וגם אימייל" ? ("both" as const) : null);
      if (!dp) {
        sendText("לא זיהיתי בחירה. נא לבחור שוב.");
        sendButtons("ערוץ", [
          { id: "DELIV_WHATSAPP", title: "וואטסאפ" },
          { id: "DELIV_EMAIL", title: "אימייל" },
          { id: "DELIV_BOTH", title: "גם וואטסאפ וגם אימייל" },
        ]);
        return { ok: true, nextState: "edit_delivery_preference", nextContext: ctx, outbound };
      }
      ctx.delivery_preference = dp;
      ctx.asker_email = undefined;
      if (dp === "email" || dp === "both") {
        sendText("נא להזין כתובת אימייל לקבלת התשובה.");
        return { ok: true, nextState: "collect_email", nextContext: ctx, outbound };
      }
      ctx.edit_count = (ctx.edit_count ?? 0) + 1;
      return showConfirm(outbound, ctx);
    }

    case "waiting_admin_approval": {
      // In this phase, do not auto-update draft. Provide a short message unless user starts a new process.
      sendText("קיבלנו הודעה נוספת.\nהיא תועבר לעיון מנהל תפעולי.\nלא נבצע עדכונים אוטומטיים עד לסיום הבדיקה והאישור.");
      return { ok: true, nextState: "waiting_admin_approval", nextContext: ctx, outbound };
    }

    case "done": {
      // No further action.
      sendText("תודה. אם יש צורך, פנה/י שוב.");
      return { ok: true, nextState: "done", nextContext: ctx, outbound };
    }
  }

  // If we ever fall through:
  return { ok: false, error: "unhandled_state" };
}

function showConfirm(outbound: OutboundAction[], ctx: BotContext): BotFsmResult {
  const content = (((ctx as any).content ?? "") as string).trim();
  const title = (ctx.title ?? "").trim();
  const asker_email = (ctx.asker_email ?? "").trim();
  const delivery_preference = ctx.delivery_preference ?? "whatsapp";
  const pub = ctx.publication_consent ?? "none";
  const rt = ctx.response_type ?? "short";
  const gender = ctx.asker_gender ?? "—";
  const age = ctx.asker_age != null ? String(ctx.asker_age) : "—";

  const genderLabel = gender === "M" ? "זכר" : gender === "F" ? "נקבה" : gender;
  const rtLabel = rt === "short" ? "קצר ולעניין" : "מורחב";
  const pubLabel = pub === "publish" ? "אפשר לפרסם" : pub === "blur" ? "פרסום בטשטוש" : "ללא פרסום";
  const delLabel = delivery_preference === "whatsapp" ? "וואטסאפ" : delivery_preference === "email" ? "אימייל" : "גם וואטסאפ וגם אימייל";

  const show: string[] = [];
  show.push("תודה.");
  show.push("להלן סיכום פרטי הפנייה:");
  show.push(`מגדר: ${genderLabel}`);
  show.push(`גיל: ${age}`);
  show.push(`כותרת: ${title}`);
  show.push("תוכן השאלה:");
  show.push(content);
  show.push(`מסלול מענה: ${rtLabel}`);
  show.push(`אפשרות פרסום: ${pubLabel}`);
  show.push(`ערוץ קבלת תשובה: ${delLabel}`);
  if (asker_email) show.push(`אימייל: ${asker_email}`);
  show.push("");
  show.push("האם ברצונך לשנות או להוסיף משהו?");
  show.push("אם אין צורך בשינויים — נא לאשר את הפנייה.");

  outbound.push({ kind: "text", text: show.join("\n") });
  // Quick buttons limit => just two buttons for confirm
  outbound.push({
    kind: "buttons",
    bodyText: "בחירה",
    buttons: [
      { id: "CONFIRM_EDIT", title: "שינוי משהו" },
      { id: "CONFIRM_DONE", title: "זהו (אישור)" },
    ],
  });

  // Respect max edits
  if ((ctx.edit_count ?? 0) >= 4) {
    outbound.push({
      kind: "text",
      text: "הגעת למספר השינויים המקסימלי האפשרי. באפשרותך לאשר את הפנייה כפי שהיא כעת.",
    });
    // Still let CONFIRM_DONE through; CONFIRM_EDIT is allowed but ignored.
  }

  return { ok: true, nextState: "confirm", nextContext: ctx, outbound };
}

