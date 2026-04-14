import { ASKER_AGE_RANGE_LABELS, normalizeAskerAgeRangeInput, type AskerAgeRangeLabel } from "@/lib/asker-age-ranges";
import { renderBotText } from "@/lib/whatsapp/botTexts";
import { WA_INTERACTIVE_BODY_BUTTONS_ONLY } from "@/lib/whatsapp/waInteractive";

export type Gender = "M" | "F";
export type ResponseType = "short" | "detailed";
export type PublicationConsent = "publish" | "blur" | "none";
export type DeliveryPreference = "whatsapp" | "email" | "both";

export type BotConversationState =
  | "start"
  | "gender"
  | "choose_mode"
  | "human_message_collect"
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
  asker_age?: AskerAgeRangeLabel;
  bodyParts?: string[];
  humanParts?: string[];
  humanPromptShown?: boolean;
  title?: string;
  response_type?: ResponseType;
  publication_consent?: PublicationConsent;
  delivery_preference?: DeliveryPreference;
  asker_email?: string;
  edit_count?: number;
  chosen_edit_field?: string;
  // When a draft is created, we keep its id here so admin approval won't close
  // a conversation that the user has already restarted.
  activeDraftId?: string;
};

export type InboundBotEvent = {
  text?: string | null;
  buttonId?: string | null;
  listReplyId?: string | null;
};

export type OutboundAction =
  | { kind: "text"; text: string }
  | { kind: "buttons"; bodyText: string; buttons: Array<{ id: string; title: string }> }
  | {
      kind: "list";
      bodyText: string;
      buttonText: string;
      sectionTitle: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    };

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

function parseAgeRangeFromInbound(inbound: InboundBotEvent): AskerAgeRangeLabel | null {
  const id = safeTrim(inbound.listReplyId ?? undefined);
  if (id && id.startsWith("AGE_RANGE_")) {
    const suffix = id.slice("AGE_RANGE_".length);
    const fromId = normalizeAskerAgeRangeInput(suffix.replace(/_/g, "-"));
    if (fromId) return fromId;
  }

  const btn = safeTrim(inbound.buttonId ?? undefined);
  if (btn && btn.startsWith("AGE_RANGE_")) {
    const suffix = btn.slice("AGE_RANGE_".length);
    const fromBtn = normalizeAskerAgeRangeInput(suffix.replace(/_/g, "-"));
    if (fromBtn) return fromBtn;
  }

  return normalizeAskerAgeRangeInput(inbound.text);
}

function sendAgeRangeList(outbound: OutboundAction[], ctx: BotContext, prefixBody?: string) {
  const ageBody = renderText("age", ctx).trimEnd();
  const bodyText = prefixBody?.trim() ? `${prefixBody.trimEnd()}\n\n${ageBody}` : ageBody;
  outbound.push({
    kind: "list",
    bodyText,
    buttonText: "בחירת גיל",
    sectionTitle: "טווח גיל",
    rows: ASKER_AGE_RANGE_LABELS.map((label) => ({
      id: `AGE_RANGE_${label.replace(/\+/g, "PLUS").replace(/-/g, "_")}`,
      title: label,
    })),
  });
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

const RESPONSE_SHORT_BUTTON_TITLE = "תשובה קצרה, מתומצתת ומעשית";
const RESPONSE_DETAILED_BUTTON_TITLE = "תשובה מקיפה, ארוכה ומורחבת";

const PUBLICATION_PUBLISH_BUTTON_TITLE = "אפשר לפרסם";
const PUBLICATION_BLUR_BUTTON_TITLE = "פרסום בטשטוש פרטים מזהים";
const PUBLICATION_NONE_BUTTON_TITLE = "לא לפרסום";

const DELIVERY_WHATSAPP_BUTTON_TITLE = "וואטסאפ";
const DELIVERY_EMAIL_BUTTON_TITLE = "אימייל";
const DELIVERY_BOTH_BUTTON_TITLE = "גם וואטסאפ וגם אימייל";

/**
 * WhatsApp Cloud API (Graph): quick-reply button `title` max 20 characters.
 * Wording in the message body / סיכום אישור נשאר ב-*_BUTTON_TITLE הארוכים למעלה.
 */
const WA_REPLY_MODE_BOT = "שאלה במוקד";
const WA_REPLY_MODE_HUMAN = "נציג אנושי";
const WA_REPLY_RESP_SHORT = "קצר ולעניין";
const WA_REPLY_RESP_DETAILED = "מורחב";
const WA_REPLY_PUB_PUBLISH = "אפשר לפרסם";
const WA_REPLY_PUB_BLUR = "בטשטוש";
const WA_REPLY_PUB_NONE = "ללא פרסום";
const WA_REPLY_DELIV_BOTH = "שניהם";
const WA_REPLY_CONFIRM_DONE = "אישור";
const WA_REPLY_CONFIRM_CHANGE = "שינוי";
const WA_REPLY_EDIT_DELIVERY = "שינוי ערוץ";
const CANCEL_REFERRAL_BUTTON_ID = "CANCEL_REFERRAL";
const WA_REPLY_CANCEL_REFERRAL = "ביטול";

// Category menu displayed on the `confirm` screen (instead of 3 separate button messages).
// Each WhatsApp quick-reply message is limited to ~3 buttons, so we show 3 categories first.
const EDIT_CAT_PERSONAL_BUTTON_ID = "EDIT_CAT_PERSONAL";
const EDIT_CAT_CONTENT_BUTTON_ID = "EDIT_CAT_CONTENT";
const EDIT_CAT_ANSWER_BUTTON_ID = "EDIT_CAT_ANSWER";
const WA_REPLY_EDIT_CAT_PERSONAL = "פרטים אישיים";
const WA_REPLY_EDIT_CAT_CONTENT = "תוכן השאלה";
const WA_REPLY_EDIT_CAT_ANSWER = "הגדרות תשובה";

// Human handoff (collecting a free-form message from the user).
const HUMAN_ADD_MORE_BUTTON_ID = "HUMAN_ADD_MORE";
const WA_REPLY_HUMAN_ADD_MORE = "המשך עוד";
const HUMAN_DONE_BUTTON_ID = "HUMAN_DONE";
const WA_REPLY_HUMAN_DONE = "סיימתי";
/** Quick-reply label (≤20 chars). Same wording for body and title “add more”. */
const WA_REPLY_ADD_MORE = "להוסיף עוד";

const CONFIRM_DONE_BUTTON_ID = "CONFIRM_DONE";
const CONFIRM_CHANGE_BUTTON_ID = "CONFIRM_CHANGE";

function responseTypeLabel(rt: ResponseType): string {
  return rt === "short" ? RESPONSE_SHORT_BUTTON_TITLE : RESPONSE_DETAILED_BUTTON_TITLE;
}

function publicationConsentLabel(pc: PublicationConsent): string {
  if (pc === "publish") return PUBLICATION_PUBLISH_BUTTON_TITLE;
  if (pc === "blur") return PUBLICATION_BLUR_BUTTON_TITLE;
  return PUBLICATION_NONE_BUTTON_TITLE;
}

function deliveryPreferenceLabel(dp: DeliveryPreference): string {
  if (dp === "whatsapp") return DELIVERY_WHATSAPP_BUTTON_TITLE;
  if (dp === "email") return DELIVERY_EMAIL_BUTTON_TITLE;
  return DELIVERY_BOTH_BUTTON_TITLE;
}

function varsFromCtx(ctx: BotContext) {
  const gender = ctx.asker_gender ?? "M";
  const asker_gender = gender === "M" ? "זכר" : "נקבה";
  const asker_age = ctx.asker_age != null ? String(ctx.asker_age) : "";
  const title = (ctx.title ?? "").trim();
  const content = (((ctx as any).content ?? "") as string).trim();
  const response_type = ctx.response_type ? responseTypeLabel(ctx.response_type) : "";
  const publication_consent = ctx.publication_consent ? publicationConsentLabel(ctx.publication_consent) : "";
  const delivery_preference = ctx.delivery_preference ? deliveryPreferenceLabel(ctx.delivery_preference) : "";
  return {
    asker_gender,
    asker_age,
    title,
    content,
    response_type,
    publication_consent,
    delivery_preference,
    asker_email: ctx.asker_email ?? null,
  };
}

function renderText(stateKey: string, ctx: BotContext, genderOverride?: Gender): string {
  const gender = genderOverride ?? (ctx.asker_gender ?? "M");
  return renderBotText(stateKey, gender, varsFromCtx(ctx));
}

export async function runBotFsm(params: {
  toPhoneRaw: string;
  currentState: BotConversationState;
  currentContext: BotContext;
  inbound: InboundBotEvent;
  createDraftFn: (draft: {
    phone: string;
    asker_gender: Gender;
    asker_age: AskerAgeRangeLabel;
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
  const listReplyId = safeTrim(inbound.listReplyId ?? undefined) || null;

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

  switch (currentState) {
    case "start": {
      // Bot entry: ask gender
      sendButtons(renderText("start", ctx).trimEnd(), [
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
        sendButtons(renderText("gender_invalid_first", ctx).trimEnd(), [
          { id: "GENDER_M", title: "זכר" },
          { id: "GENDER_F", title: "נקבה" },
        ]);
        return { ok: true, nextState: "gender", nextContext: ctx, outbound };
      }
      ctx.asker_gender = g;
      sendButtons(renderText("choose_mode", ctx).trimEnd(), [
        { id: "MODE_BOT", title: WA_REPLY_MODE_BOT },
        { id: "MODE_HUMAN", title: WA_REPLY_MODE_HUMAN },
      ]);
      return { ok: true, nextState: "choose_mode", nextContext: ctx, outbound };
    }

    case "choose_mode": {
      if (
        buttonId === "MODE_HUMAN" ||
        text === "נציג אנושי" ||
        text === "נציג" ||
        text === "אדם" ||
        text === "להשאיר הודעה לנציג אנושי" ||
        text === WA_REPLY_MODE_HUMAN
      ) {
        // Collect the user's message for the human agent.
        ctx.humanParts = [];
      ctx.humanPromptShown = true;
        sendText(renderText("human_message_collect", ctx).trimEnd());
        return { ok: true, nextState: "human_message_collect", nextContext: ctx, outbound };
      }
      // Default to bot flow
      ctx.delivery_preference = ctx.delivery_preference ?? "whatsapp";
      sendAgeRangeList(outbound, ctx);
      return { ok: true, nextState: "age", nextContext: ctx, outbound };
    }

    case "human_message_collect": {
      const normalizedText = text ?? "";

      // Finish button (also allow typing "סיימתי" as text).
      if (
        buttonId === HUMAN_DONE_BUTTON_ID ||
        normalizedText === WA_REPLY_HUMAN_DONE ||
        normalizedText === "סיימתי"
      ) {
        ctx.humanParts = [];
        sendText(renderText("human_handoff", ctx).trimEnd());
        return { ok: true, nextState: "done", nextContext: ctx, outbound };
      }

      // Continue button (also allow typing "המשך עוד" as text).
      if (
        buttonId === HUMAN_ADD_MORE_BUTTON_ID ||
        normalizedText === WA_REPLY_HUMAN_ADD_MORE ||
        normalizedText === "המשך עוד"
      ) {
        sendText(renderText("human_message_collect", ctx).trimEnd());
        return { ok: true, nextState: "human_message_collect", nextContext: ctx, outbound };
      }

      // User typed free-form message.
      if (text) {
        ctx.humanParts = [...(ctx.humanParts ?? []), text];

        // Buttons should only appear after the user sent at least one message.
        sendButtons("מה הלאה?", [
          { id: HUMAN_ADD_MORE_BUTTON_ID, title: WA_REPLY_HUMAN_ADD_MORE },
          { id: HUMAN_DONE_BUTTON_ID, title: WA_REPLY_HUMAN_DONE },
        ]);
        return { ok: true, nextState: "human_message_collect", nextContext: ctx, outbound };
      }

      // Fallback: re-show prompt.
      // Prevent duplicate prompt spam when the user already received the instruction once.
      if (!ctx.humanPromptShown) {
        ctx.humanPromptShown = true;
        sendText(renderText("human_message_collect", ctx).trimEnd());
      }
      return { ok: true, nextState: "human_message_collect", nextContext: ctx, outbound };
    }

    case "age": {
      const picked = parseAgeRangeFromInbound({ ...inbound, text, buttonId, listReplyId });
      if (!picked) {
        // Track attempts via a simple counter in context
        const prevBad = (ctx as any).age_bad_count ?? 0;
        const badCount = prevBad + 1;
        (ctx as any).age_bad_count = badCount;
        if (badCount >= 2) {
          sendText(renderText("age_invalid_second", ctx).trimEnd());
          return { ok: true, nextState: "done", nextContext: ctx, outbound };
        }
        sendAgeRangeList(outbound, ctx, renderText("age_invalid_first", ctx).trimEnd());
        return { ok: true, nextState: "age", nextContext: ctx, outbound };
      }
      ctx.asker_age = picked;
      ctx.bodyParts = [];
      sendText(renderText("body_collect", ctx).trimEnd());
      return { ok: true, nextState: "body_collect", nextContext: ctx, outbound };
    }

    case "body_collect": {
      // If user sends text: append
      if (text) ctx.bodyParts = [...(ctx.bodyParts ?? []), text];

      if (buttonId === "BODY_DONE" || text === "סיימתי") {
        const content = (ctx.bodyParts ?? []).join("\n").trim();
        if (!content) {
          sendButtons(renderText("body_invalid_or_empty", ctx).trimEnd(), [
            { id: "BODY_ADD_MORE", title: WA_REPLY_ADD_MORE },
            { id: "BODY_DONE", title: "סיימתי" },
          ]);
          return { ok: true, nextState: "body_collect", nextContext: ctx, outbound };
        }
        ctx.bodyParts = [];
        sendText(renderText("title_collect", ctx).trimEnd());
        // Store content temporarily in ctx.title? we'll keep in ctx as `content` later through next step
        (ctx as any).content = content;
        return { ok: true, nextState: "title_collect", nextContext: ctx, outbound };
      }

      // Add more: just keep state (buttons only — intro was already sent)
      if (buttonId === "BODY_ADD_MORE" || text === "הוסף עוד" || text === WA_REPLY_ADD_MORE) {
        sendButtons(WA_INTERACTIVE_BODY_BUTTONS_ONLY, [
          { id: "BODY_ADD_MORE", title: WA_REPLY_ADD_MORE },
          { id: "BODY_DONE", title: "סיימתי" },
        ]);
        return { ok: true, nextState: "body_collect", nextContext: ctx, outbound };
      }

      // User typed free text: keep collecting; buttons only (WhatsApp does not persist prior buttons).
      sendButtons(WA_INTERACTIVE_BODY_BUTTONS_ONLY, [
        { id: "BODY_ADD_MORE", title: WA_REPLY_ADD_MORE },
        { id: "BODY_DONE", title: "סיימתי" },
      ]);
      return { ok: true, nextState: "body_collect", nextContext: ctx, outbound };
    }

    case "title_collect": {
      if (text) {
        // Single title field: replace with latest unless user asks to add more
        const prevTitle = ctx.title ?? "";
        const addMore =
          buttonId === "TITLE_ADD_MORE" || text === "הוסף עוד" || text === WA_REPLY_ADD_MORE;
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
          sendButtons(renderText("title_collect", ctx).trimEnd(), [
            { id: "TITLE_DONE", title: "סיימתי" },
            { id: "TITLE_ADD_MORE", title: WA_REPLY_ADD_MORE },
          ]);
          return { ok: true, nextState: "title_collect", nextContext: ctx, outbound };
        }
        sendButtons(renderText("response_type", ctx).trimEnd(), [
          { id: "RESP_SHORT", title: WA_REPLY_RESP_SHORT },
          { id: "RESP_DETAILED", title: WA_REPLY_RESP_DETAILED },
        ]);
        return { ok: true, nextState: "response_type", nextContext: ctx, outbound };
      }

      // User typed title text; one interactive bubble (WhatsApp does not persist prior buttons).
      sendButtons(renderText("title_collect_followup", ctx).trimEnd(), [
        { id: "TITLE_DONE", title: "סיימתי" },
        { id: "TITLE_ADD_MORE", title: WA_REPLY_ADD_MORE },
      ]);
      return { ok: true, nextState: "title_collect", nextContext: ctx, outbound };
    }

    case "response_type": {
      const rt =
        buttonId === "RESP_SHORT" ? ("short" as const) :
        buttonId === "RESP_DETAILED" ? ("detailed" as const) :
        (text === "קצר" || text === "קצר ולעניין" || text === "קצר ומעשי" || text === WA_REPLY_RESP_SHORT || text === RESPONSE_SHORT_BUTTON_TITLE
          ? ("short" as const)
          : text === "מורחב" || text === RESPONSE_DETAILED_BUTTON_TITLE ? ("detailed" as const) : null);
      if (!rt) {
        sendButtons("לא זיהיתי בחירה.\nנא לבחור: קצר ולעניין / מורחב.", [
          { id: "RESP_SHORT", title: WA_REPLY_RESP_SHORT },
          { id: "RESP_DETAILED", title: WA_REPLY_RESP_DETAILED },
        ]);
        return { ok: true, nextState: "response_type", nextContext: ctx, outbound };
      }
      ctx.response_type = rt;
      sendButtons(renderText("publication_consent", ctx).trimEnd(), [
        { id: "PUB_PUBLISH", title: WA_REPLY_PUB_PUBLISH },
        { id: "PUB_BLUR", title: WA_REPLY_PUB_BLUR },
        { id: "PUB_NONE", title: WA_REPLY_PUB_NONE },
      ]);
      return { ok: true, nextState: "publication_consent", nextContext: ctx, outbound };
    }

    case "publication_consent": {
      const pc =
        buttonId === "PUB_PUBLISH" ? ("publish" as const) :
        buttonId === "PUB_BLUR" ? ("blur" as const) :
        buttonId === "PUB_NONE" ? ("none" as const) :
        (text === "אפשר לפרסם" || text === "פרסום" || text === "ניתן לפרסם" ? ("publish" as const) :
          text === "פרסום בטשטוש" || text === "פרסום בטשטוש פרטים מזהים" || text === "בטשטוש" ? ("blur" as const) :
          text === "ללא פרסום" ? ("none" as const) : null);
      if (!pc) {
        sendButtons("לא זיהיתי בחירה תקינה בפרסום.\nנא לבחור שוב.", [
          { id: "PUB_PUBLISH", title: WA_REPLY_PUB_PUBLISH },
          { id: "PUB_BLUR", title: WA_REPLY_PUB_BLUR },
          { id: "PUB_NONE", title: WA_REPLY_PUB_NONE },
        ]);
        return { ok: true, nextState: "publication_consent", nextContext: ctx, outbound };
      }
      ctx.publication_consent = pc;
      sendButtons(renderText("delivery_preference", ctx).trimEnd(), [
        { id: "DELIV_WHATSAPP", title: DELIVERY_WHATSAPP_BUTTON_TITLE },
        { id: "DELIV_EMAIL", title: DELIVERY_EMAIL_BUTTON_TITLE },
        { id: "DELIV_BOTH", title: WA_REPLY_DELIV_BOTH },
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
          (text === "גם וואטסאפ וגם אימייל" || text === "שניהם" || text === WA_REPLY_DELIV_BOTH)
            ? ("both" as const)
            : null);
      if (!dp) {
        sendButtons("לא זיהיתי בחירה בערוץ.\nנא לבחור: וואטסאפ / אימייל / גם וגם.", [
          { id: "DELIV_WHATSAPP", title: "וואטסאפ" },
          { id: "DELIV_EMAIL", title: "אימייל" },
          { id: "DELIV_BOTH", title: WA_REPLY_DELIV_BOTH },
        ]);
        return { ok: true, nextState: "delivery_preference", nextContext: ctx, outbound };
      }
      ctx.delivery_preference = dp;
      if (dp === "email") {
        sendText(renderText("collect_email", ctx).trimEnd());
        return { ok: true, nextState: "collect_email", nextContext: ctx, outbound };
      }
      if (dp === "both") {
        sendText(renderText("collect_email", ctx).trimEnd());
        return { ok: true, nextState: "collect_email", nextContext: ctx, outbound };
      }
      // whatsapp only
      return showConfirm(outbound, ctx);
    }

    case "collect_email": {
      const em = safeTrim(text);
      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        sendText(renderText("email_invalid", ctx).trimEnd());
        return { ok: true, nextState: "collect_email", nextContext: ctx, outbound };
      }
      ctx.asker_email = em;
      return showConfirm(outbound, ctx);
    }

    case "confirm": {
      if (
        buttonId === CANCEL_REFERRAL_BUTTON_ID ||
        text === WA_REPLY_CANCEL_REFERRAL ||
        text === "ביטול" ||
        text === "ביטול פנייה"
      ) {
        sendText(renderText("cancel_referral", ctx).trimEnd());
        return { ok: true, nextState: "done", nextContext: ctx, outbound };
      }

      if (
        buttonId === CONFIRM_DONE_BUTTON_ID ||
        text === "אישור" ||
        text === "סיום ואישור פנייה" ||
        text === "סיום ואישור" ||
        text === WA_REPLY_CONFIRM_DONE
      ) {
        // Create draft
        const asker_gender = ctx.asker_gender as Gender | undefined;
        const asker_age = ctx.asker_age as AskerAgeRangeLabel | undefined;
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

        // Keep the draft id so admin approval won't close a conversation that already restarted.
        ctx.activeDraftId = createRes.draftId;

        sendText(renderText("waiting_admin_approval", ctx).trimEnd());
        // Treat waiting_admin_approval as "informational only": after sending it, the FSM ends.
        // Any subsequent inbound message will restart the flow from scratch (via `done`).
        return { ok: true, nextState: "done", nextContext: ctx, outbound, createdDraft: true };
      }

      // Edit selection buttons (from showConfirm)
      switch (buttonId) {
        case CONFIRM_CHANGE_BUTTON_ID:
          if ((ctx.edit_count ?? 0) >= 4) {
            sendButtons(renderText("max_edits_reached", ctx).trimEnd(), [
              { id: CANCEL_REFERRAL_BUTTON_ID, title: WA_REPLY_CANCEL_REFERRAL },
              { id: CONFIRM_DONE_BUTTON_ID, title: WA_REPLY_CONFIRM_DONE },
            ]);
            return { ok: true, nextState: "confirm", nextContext: ctx, outbound };
          }
          sendButtons("בחר תחום לשינוי", [
            { id: EDIT_CAT_PERSONAL_BUTTON_ID, title: WA_REPLY_EDIT_CAT_PERSONAL },
            { id: EDIT_CAT_CONTENT_BUTTON_ID, title: WA_REPLY_EDIT_CAT_CONTENT },
            { id: EDIT_CAT_ANSWER_BUTTON_ID, title: WA_REPLY_EDIT_CAT_ANSWER },
          ]);
          return { ok: true, nextState: "confirm", nextContext: ctx, outbound };

        case EDIT_CAT_PERSONAL_BUTTON_ID:
          // Up to 3 buttons per WhatsApp quick-reply message.
          sendButtons("בחירה", [
            { id: "EDIT_GENDER", title: "שינוי מגדר" },
            { id: "EDIT_AGE", title: "שינוי גיל" },
          ]);
          return { ok: true, nextState: "confirm", nextContext: ctx, outbound };

        case EDIT_CAT_CONTENT_BUTTON_ID:
          sendButtons("בחירה", [
            { id: "EDIT_BODY", title: "שינוי שאלה" },
            { id: "EDIT_TITLE", title: "שינוי כותרת" },
          ]);
          return { ok: true, nextState: "confirm", nextContext: ctx, outbound };

        case EDIT_CAT_ANSWER_BUTTON_ID:
          sendButtons("בחירה", [
            { id: "EDIT_RESPONSE_TYPE", title: "שינוי מסלול מענה" },
            { id: "EDIT_PUBLICATION_CONSENT", title: "שינוי אפשרות פרסום" },
            { id: "EDIT_DELIVERY_PREFERENCE", title: WA_REPLY_EDIT_DELIVERY },
          ]);
          return { ok: true, nextState: "confirm", nextContext: ctx, outbound };

        case "EDIT_GENDER":
          sendButtons(renderText("edit_gender", ctx).trimEnd(), [
            { id: "GENDER_M", title: "זכר" },
            { id: "GENDER_F", title: "נקבה" },
          ]);
          return { ok: true, nextState: "edit_gender", nextContext: ctx, outbound };
        case "EDIT_AGE":
          sendAgeRangeList(outbound, ctx, renderText("edit_age", ctx).trimEnd());
          return { ok: true, nextState: "edit_age", nextContext: ctx, outbound };
        case "EDIT_BODY":
          ctx.bodyParts = [];
          sendText(renderText("edit_body", ctx).trimEnd());
          return { ok: true, nextState: "edit_body", nextContext: ctx, outbound };
        case "EDIT_TITLE":
          sendText(renderText("edit_title", ctx).trimEnd());
          return { ok: true, nextState: "edit_title", nextContext: ctx, outbound };
        case "EDIT_RESPONSE_TYPE":
          sendButtons(renderText("edit_response_type", ctx).trimEnd(), [
            { id: "RESP_SHORT", title: WA_REPLY_RESP_SHORT },
            { id: "RESP_DETAILED", title: WA_REPLY_RESP_DETAILED },
          ]);
          return { ok: true, nextState: "edit_response_type", nextContext: ctx, outbound };
        case "EDIT_PUBLICATION_CONSENT":
          sendButtons(renderText("edit_publication_consent", ctx).trimEnd(), [
            { id: "PUB_PUBLISH", title: WA_REPLY_PUB_PUBLISH },
            { id: "PUB_BLUR", title: WA_REPLY_PUB_BLUR },
            { id: "PUB_NONE", title: WA_REPLY_PUB_NONE },
          ]);
          return { ok: true, nextState: "edit_publication_consent", nextContext: ctx, outbound };
        case "EDIT_DELIVERY_PREFERENCE":
          sendButtons(renderText("edit_delivery_preference", ctx).trimEnd(), [
            { id: "DELIV_WHATSAPP", title: DELIVERY_WHATSAPP_BUTTON_TITLE },
            { id: "DELIV_EMAIL", title: DELIVERY_EMAIL_BUTTON_TITLE },
            { id: "DELIV_BOTH", title: WA_REPLY_DELIV_BOTH },
          ]);
          return { ok: true, nextState: "edit_delivery_preference", nextContext: ctx, outbound };
      }

      // Default: re-show confirm
      return showConfirm(outbound, ctx);
    }

    case "edit_field_choice": {
      const field = text;
      const allowed = ["מגדר", "גיל", "שאלה", "כותרת", "מסלול מענה", "פרסום", "ערוץ קבלת תשובה"];
      if (!allowed.includes(field)) {
        sendText(
          "לא זיהיתי שדה.\nנא לבחור אחד מהאפשרויות הרשומות:\nמגדר / גיל / שאלה / כותרת / מסלול מענה / פרסום / ערוץ קבלת תשובה"
        );
        return { ok: true, nextState: "edit_field_choice", nextContext: ctx, outbound };
      }
      ctx.chosen_edit_field = field;

      if (field === "מגדר") {
        sendButtons(renderText("edit_gender", ctx).trimEnd(), [
          { id: "GENDER_M", title: "זכר" },
          { id: "GENDER_F", title: "נקבה" },
        ]);
        return { ok: true, nextState: "edit_gender", nextContext: ctx, outbound };
      }
      if (field === "גיל") {
        sendAgeRangeList(outbound, ctx, renderText("edit_age", ctx).trimEnd());
        return { ok: true, nextState: "edit_age", nextContext: ctx, outbound };
      }
      if (field === "שאלה") {
        ctx.bodyParts = [];
        sendText(renderText("edit_body", ctx).trimEnd());
        return { ok: true, nextState: "edit_body", nextContext: ctx, outbound };
      }
      if (field === "כותרת") {
        sendText(renderText("edit_title", ctx).trimEnd());
        return { ok: true, nextState: "edit_title", nextContext: ctx, outbound };
      }
      if (field === "מסלול מענה") {
        sendButtons(renderText("edit_response_type", ctx).trimEnd(), [
          { id: "RESP_SHORT", title: WA_REPLY_RESP_SHORT },
          { id: "RESP_DETAILED", title: WA_REPLY_RESP_DETAILED },
        ]);
        return { ok: true, nextState: "edit_response_type", nextContext: ctx, outbound };
      }
      if (field === "פרסום") {
        sendButtons(renderText("edit_publication_consent", ctx).trimEnd(), [
          { id: "PUB_PUBLISH", title: WA_REPLY_PUB_PUBLISH },
          { id: "PUB_BLUR", title: WA_REPLY_PUB_BLUR },
          { id: "PUB_NONE", title: WA_REPLY_PUB_NONE },
        ]);
        return { ok: true, nextState: "edit_publication_consent", nextContext: ctx, outbound };
      }
      // ערוץ קבלת תשובה
      sendButtons(renderText("edit_delivery_preference", ctx).trimEnd(), [
        { id: "DELIV_WHATSAPP", title: "וואטסאפ" },
        { id: "DELIV_EMAIL", title: "אימייל" },
        { id: "DELIV_BOTH", title: WA_REPLY_DELIV_BOTH },
      ]);
      return { ok: true, nextState: "edit_delivery_preference", nextContext: ctx, outbound };
    }

    case "edit_gender": {
      const g =
        buttonId === "GENDER_M" ? ("M" as const) :
        buttonId === "GENDER_F" ? ("F" as const) :
        (text === "זכר" ? ("M" as const) : text === "נקבה" ? ("F" as const) : null);
      if (!g) {
        sendButtons("לא זיהיתי בחירה. נא לבחור באמצעות הכפתורים: זכר / נקבה.", [
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
      const picked = parseAgeRangeFromInbound({ ...inbound, text, buttonId, listReplyId });
      if (!picked) {
        sendAgeRangeList(outbound, ctx, renderText("edit_age", ctx).trimEnd());
        return { ok: true, nextState: "edit_age", nextContext: ctx, outbound };
      }
      ctx.asker_age = picked;
      ctx.edit_count = (ctx.edit_count ?? 0) + 1;
      // After edit, go back confirm
      return showConfirm(outbound, ctx);
    }

    case "edit_body": {
      if (text) ctx.bodyParts = [...(ctx.bodyParts ?? []), text];
      if (buttonId === "BODY_DONE" || text === "סיימתי") {
        const content = (ctx.bodyParts ?? []).join("\n").trim();
        if (!content) {
          sendButtons(renderText("body_invalid_or_empty", ctx).trimEnd(), [
            { id: "BODY_ADD_MORE", title: WA_REPLY_ADD_MORE },
            { id: "BODY_DONE", title: "סיימתי" },
          ]);
          return { ok: true, nextState: "edit_body", nextContext: ctx, outbound };
        }
        (ctx as any).content = content;
        ctx.bodyParts = [];
        ctx.edit_count = (ctx.edit_count ?? 0) + 1;
        return showConfirm(outbound, ctx);
      }
      if (buttonId === "BODY_ADD_MORE" || text === "הוסף עוד" || text === WA_REPLY_ADD_MORE) {
        sendButtons(WA_INTERACTIVE_BODY_BUTTONS_ONLY, [
          { id: "BODY_ADD_MORE", title: WA_REPLY_ADD_MORE },
          { id: "BODY_DONE", title: "סיימתי" },
        ]);
        return { ok: true, nextState: "edit_body", nextContext: ctx, outbound };
      }
      sendButtons(WA_INTERACTIVE_BODY_BUTTONS_ONLY, [
        { id: "BODY_ADD_MORE", title: WA_REPLY_ADD_MORE },
        { id: "BODY_DONE", title: "סיימתי" },
      ]);
      return { ok: true, nextState: "edit_body", nextContext: ctx, outbound };
    }

    case "edit_title": {
      if (text) {
        ctx.title = text.trim();
        sendButtons(renderText("edit_title", ctx).trimEnd(), [{ id: "EDIT_TITLE_DONE", title: "סיימתי" }]);
        return { ok: true, nextState: "edit_title", nextContext: ctx, outbound };
      }
      if (buttonId === "EDIT_TITLE_DONE" || text === "סיימתי") {
        if (!ctx.title || !ctx.title.trim()) {
          sendButtons(renderText("edit_title", ctx).trimEnd(), [{ id: "EDIT_TITLE_DONE", title: "סיימתי" }]);
          return { ok: true, nextState: "edit_title", nextContext: ctx, outbound };
        }
        ctx.edit_count = (ctx.edit_count ?? 0) + 1;
        return showConfirm(outbound, ctx);
      }
      sendButtons(renderText("edit_title", ctx).trimEnd(), [{ id: "EDIT_TITLE_DONE", title: "סיימתי" }]);
      return { ok: true, nextState: "edit_title", nextContext: ctx, outbound };
    }

    case "edit_response_type": {
      const rt =
        buttonId === "RESP_SHORT" ? ("short" as const) :
        buttonId === "RESP_DETAILED" ? ("detailed" as const) :
        (text === "קצר ולעניין" || text === "קצר" || text === "קצר ומעשי" || text === WA_REPLY_RESP_SHORT || text === RESPONSE_SHORT_BUTTON_TITLE
          ? ("short" as const)
          : text === "מורחב" || text === RESPONSE_DETAILED_BUTTON_TITLE ? ("detailed" as const) : null);
      if (!rt) {
        sendButtons("לא זיהיתי בחירה. נא לבחור שוב.", [
          { id: "RESP_SHORT", title: WA_REPLY_RESP_SHORT },
          { id: "RESP_DETAILED", title: WA_REPLY_RESP_DETAILED },
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
        (text === "אפשר לפרסם" || text === "ניתן לפרסם" ? ("publish" as const) :
          text === "פרסום בטשטוש" || text === "פרסום בטשטוש פרטים מזהים" || text === "בטשטוש" ? ("blur" as const) :
          text === "ללא פרסום" ? ("none" as const) : null);
      if (!pc) {
        sendButtons("לא זיהיתי בחירה. נא לבחור שוב.", [
          { id: "PUB_PUBLISH", title: WA_REPLY_PUB_PUBLISH },
          { id: "PUB_BLUR", title: WA_REPLY_PUB_BLUR },
          { id: "PUB_NONE", title: WA_REPLY_PUB_NONE },
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
          (text === "גם וואטסאפ וגם אימייל" || text === "שניהם" || text === WA_REPLY_DELIV_BOTH)
            ? ("both" as const)
            : null);
      if (!dp) {
        sendButtons("לא זיהיתי בחירה. נא לבחור שוב.", [
          { id: "DELIV_WHATSAPP", title: "וואטסאפ" },
          { id: "DELIV_EMAIL", title: "אימייל" },
          { id: "DELIV_BOTH", title: WA_REPLY_DELIV_BOTH },
        ]);
        return { ok: true, nextState: "edit_delivery_preference", nextContext: ctx, outbound };
      }
      ctx.delivery_preference = dp;
      ctx.asker_email = undefined;
      if (dp === "email" || dp === "both") {
        sendText(renderText("collect_email", ctx).trimEnd());
        return { ok: true, nextState: "collect_email", nextContext: ctx, outbound };
      }
      ctx.edit_count = (ctx.edit_count ?? 0) + 1;
      return showConfirm(outbound, ctx);
    }

    case "waiting_admin_approval": {
      // Backward-compat: if an old conversation was left in this state, restart the process fully.
      const newCtx: BotContext = {};
      sendButtons(renderText("start", newCtx).trimEnd(), [
        { id: "GENDER_M", title: "זכר" },
        { id: "GENDER_F", title: "נקבה" },
      ]);
      return { ok: true, nextState: "gender", nextContext: newCtx, outbound };
    }

    case "done": {
      // Conversation was closed (e.g. human handoff); any new message restarts the bot flow.
      const newCtx: BotContext = {};
      sendButtons(renderText("start", newCtx).trimEnd(), [
        { id: "GENDER_M", title: "זכר" },
        { id: "GENDER_F", title: "נקבה" },
      ]);
      return { ok: true, nextState: "gender", nextContext: newCtx, outbound };
    }
  }

  // If we ever fall through:
  return { ok: false, error: "unhandled_state" };
}

function showConfirm(outbound: OutboundAction[], ctx: BotContext): BotFsmResult {
  const confirmText = renderText("confirm", ctx, (ctx.asker_gender ?? "M") as Gender).trimEnd();

  const maxed = (ctx.edit_count ?? 0) >= 4;
  if (maxed) {
    outbound.push({
      kind: "buttons",
      bodyText: renderText("max_edits_reached", ctx).trimEnd(),
      buttons: [
        { id: CANCEL_REFERRAL_BUTTON_ID, title: WA_REPLY_CANCEL_REFERRAL },
        { id: CONFIRM_DONE_BUTTON_ID, title: WA_REPLY_CONFIRM_DONE },
      ],
    });
    return { ok: true, nextState: "confirm", nextContext: ctx, outbound };
  }

  outbound.push({
    kind: "buttons",
    bodyText: confirmText,
    buttons: [
      { id: CONFIRM_CHANGE_BUTTON_ID, title: WA_REPLY_CONFIRM_CHANGE },
      { id: CANCEL_REFERRAL_BUTTON_ID, title: WA_REPLY_CANCEL_REFERRAL },
      { id: CONFIRM_DONE_BUTTON_ID, title: WA_REPLY_CONFIRM_DONE },
    ],
  });

  return { ok: true, nextState: "confirm", nextContext: ctx, outbound };
}

