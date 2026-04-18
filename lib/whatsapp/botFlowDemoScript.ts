/**
 * Static happy-path demo for admin "WhatsApp bot conversation" preview.
 * Uses the same `renderBotText` + MD as production; button labels mirror `botFsm.ts`.
 */
import { ASKER_AGE_RANGE_LABELS } from "@/lib/asker-age-ranges";
import { renderBotText, type Gender, type RenderVars } from "@/lib/whatsapp/botTexts";
import { WA_INTERACTIVE_BODY_BUTTONS_ONLY } from "@/lib/whatsapp/waInteractive";

const RESPONSE_SHORT_SUMMARY = "תשובה קצרה, מתומצתת ומעשית";
const RESPONSE_DETAILED_SUMMARY = "תשובה מקיפה, ארוכה ומורחבת";
const PUBLICATION_PUBLISH_SUMMARY = "אפשר לפרסם";
const DELIVERY_WHATSAPP_SUMMARY = "וואטסאפ";

/** Labels on quick-reply buttons (≤20 chars in Meta). */
const BTN = {
  genderM: "זכר",
  genderF: "נקבה",
  modeBot: "שאלה במוקד",
  modeHuman: "הודעה כללית",
  bodyAdd: "להוסיף עוד",
  bodyDone: "סיימתי",
  titleAdd: "להוסיף עוד",
  titleDone: "סיימתי",
  respShort: "קצר ולעניין",
  respDetailed: "מורחב",
  pubPublish: "אפשר לפרסם",
  pubBlur: "בטשטוש",
  pubNone: "ללא פרסום",
  delivWa: "וואטסאפ",
  delivEmail: "אימייל",
  delivBoth: "שניהם",
  confirmChange: "שינוי",
  confirmCancel: "ביטול",
  confirmDone: "אישור",
} as const;

export type DemoBubble =
  | { side: "bot"; kind: "text"; body: string }
  | { side: "bot"; kind: "buttons"; body: string; buttons: { id: string; title: string }[] }
  | {
      side: "bot";
      kind: "list";
      body: string;
      buttonText: string;
      sectionTitle: string;
      rows: { id: string; title: string }[];
    }
  | { side: "user"; kind: "text"; body: string };

const DEMO_TITLE = "שאלה לדוגמה";
const DEMO_CONTENT = `שורה ראשונה בגוף השאלה.
שורה שנייה עם פירוט.`;
const DEMO_AGE_ROW = "27-34";

function demoVars(gender: Gender): RenderVars {
  const asker_gender = gender === "M" ? "זכר" : "נקבה";
  return {
    asker_gender,
    asker_age: DEMO_AGE_ROW,
    title: DEMO_TITLE,
    content: DEMO_CONTENT,
    response_type: RESPONSE_SHORT_SUMMARY,
    publication_consent: PUBLICATION_PUBLISH_SUMMARY,
    delivery_preference: DELIVERY_WHATSAPP_SUMMARY,
    asker_email: null,
  };
}

function rt(stateKey: string, gender: Gender): string {
  return renderBotText(stateKey, gender, demoVars(gender)).trimEnd();
}

/**
 * Full bot flow: gender → mode (bot) → age list → body → title → response → publication → delivery (whatsapp) → confirm.
 */
export function buildWhatsAppBotDemoBubbles(gender: Gender): DemoBubble[] {
  const v = demoVars(gender);
  const bubbles: DemoBubble[] = [];

  bubbles.push({
    side: "bot",
    kind: "buttons",
    body: rt("start", gender),
    buttons: [
      { id: "GENDER_M", title: BTN.genderM },
      { id: "GENDER_F", title: BTN.genderF },
    ],
  });
  bubbles.push({ side: "user", kind: "text", body: gender === "M" ? BTN.genderM : BTN.genderF });

  bubbles.push({
    side: "bot",
    kind: "buttons",
    body: rt("choose_mode", gender),
    buttons: [
      { id: "MODE_BOT", title: BTN.modeBot },
      { id: "MODE_HUMAN", title: BTN.modeHuman },
    ],
  });
  bubbles.push({ side: "user", kind: "text", body: BTN.modeBot });

  bubbles.push({
    side: "bot",
    kind: "list",
    body: rt("age", gender),
    buttonText: "בחירת גיל",
    sectionTitle: "טווח גיל",
    rows: ASKER_AGE_RANGE_LABELS.map((label) => ({
      id: `AGE_RANGE_${label.replace(/\+/g, "PLUS").replace(/-/g, "_")}`,
      title: label,
    })),
  });
  bubbles.push({ side: "user", kind: "text", body: DEMO_AGE_ROW });

  bubbles.push({ side: "bot", kind: "text", body: rt("body_collect", gender) });
  bubbles.push({ side: "user", kind: "text", body: DEMO_CONTENT });

  bubbles.push({
    side: "bot",
    kind: "buttons",
    body: WA_INTERACTIVE_BODY_BUTTONS_ONLY,
    buttons: [
      { id: "BODY_ADD_MORE", title: BTN.bodyAdd },
      { id: "BODY_DONE", title: BTN.bodyDone },
    ],
  });
  bubbles.push({ side: "user", kind: "text", body: BTN.bodyDone });

  bubbles.push({ side: "bot", kind: "text", body: rt("title_collect", gender) });
  bubbles.push({ side: "user", kind: "text", body: DEMO_TITLE });

  bubbles.push({
    side: "bot",
    kind: "buttons",
    body: rt("title_collect_followup", gender),
    buttons: [
      { id: "TITLE_DONE", title: BTN.titleDone },
      { id: "TITLE_ADD_MORE", title: BTN.titleAdd },
    ],
  });
  bubbles.push({ side: "user", kind: "text", body: BTN.titleDone });

  bubbles.push({
    side: "bot",
    kind: "buttons",
    body: rt("response_type", gender),
    buttons: [
      { id: "RESP_SHORT", title: BTN.respShort },
      { id: "RESP_DETAILED", title: BTN.respDetailed },
    ],
  });
  bubbles.push({ side: "user", kind: "text", body: BTN.respShort });

  bubbles.push({
    side: "bot",
    kind: "buttons",
    body: rt("publication_consent", gender),
    buttons: [
      { id: "PUB_PUBLISH", title: BTN.pubPublish },
      { id: "PUB_BLUR", title: BTN.pubBlur },
      { id: "PUB_NONE", title: BTN.pubNone },
    ],
  });
  bubbles.push({ side: "user", kind: "text", body: BTN.pubPublish });

  bubbles.push({
    side: "bot",
    kind: "buttons",
    body: rt("delivery_preference", gender),
    buttons: [
      { id: "DELIV_WHATSAPP", title: BTN.delivWa },
      { id: "DELIV_EMAIL", title: BTN.delivEmail },
      { id: "DELIV_BOTH", title: BTN.delivBoth },
    ],
  });
  bubbles.push({ side: "user", kind: "text", body: BTN.delivWa });

  bubbles.push({
    side: "bot",
    kind: "buttons",
    body: rt("confirm", gender),
    buttons: [
      { id: "CONFIRM_CHANGE", title: BTN.confirmChange },
      { id: "CANCEL_REFERRAL", title: BTN.confirmCancel },
      { id: "CONFIRM_DONE", title: BTN.confirmDone },
    ],
  });

  return bubbles;
}
