import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "מערכת <onboarding@resend.dev>";
/** כתובת להשבה – לחיצה על "השב" במייל מהמערכת תגיע לכאן */
const REPLY_TO_EMAIL = "mokedadiad@gmail.com";
// חשוב: בפרודקשן להגדיר NEXT_PUBLIC_APP_URL לכתובת האתר (למשל https://your-domain.com) כדי שהקישורים במייל ייפתחו.
// אם קישורים במייל לא נפתחים: ב-Resend Dashboard → Domains → הדומיין → כבה "Click tracking" (הקישורים עוברים אז ישירות בלי redirect).
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

/** קישור דרך /api/go – עוקף חסימות של קישורים ישירים במייל (חלק מהדוא"לים/אבטחה חוסמים). */
function goLink(pathWithQuery: string): string {
  return `${APP_URL}/api/go?r=${encodeURIComponent(pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`)}`;
}

const BRAND = {
  primary: "#D81B60",
  primaryHover: "#AD1457",
  success: "#059669",
  successHover: "#047857",
  text: "#2c2c54",
  textMuted: "#75759e",
  bg: "#faf7f9",
  white: "#ffffff",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** כפתור CTA למייל (table-based לתאימות דוא"ל) */
function emailButton(text: string, url: string, primary = true): string {
  const bg = primary ? BRAND.primary : BRAND.success;
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 1.25em 0;">
  <tr>
    <td align="right" dir="rtl">
      <a href="${url}" style="display: inline-block; background: ${bg}; color: ${BRAND.white}; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px; font-family: sans-serif;">
        ${escapeHtml(text)}
      </a>
    </td>
  </tr>
</table>`;
}

/** תבנית מייל מעוצבת: כותרת צבעונית, גוף RTL, כפתור אופציונלי, פוטר */
function emailTemplate(
  headerTitle: string,
  bodyContent: string,
  button?: { text: string; url: string; primary?: boolean }
): string {
  const buttonHtml = button ? emailButton(button.text, button.url, button.primary ?? true) : "";
  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background: ${BRAND.bg}; font-family: 'Segoe UI', Tahoma, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${BRAND.bg}; padding: 24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
          <tr>
            <td style="background: ${BRAND.primary}; color: ${BRAND.white}; padding: 20px 24px; text-align: right; direction: rtl;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700;">${escapeHtml(headerTitle)}</h1>
            </td>
          </tr>
          <tr>
            <td style="background: ${BRAND.white}; padding: 28px 24px; color: ${BRAND.text}; line-height: 1.7; font-size: 16px; text-align: right; direction: rtl;">
              ${bodyContent}
              ${buttonHtml}
            </td>
          </tr>
          <tr>
            <td style="background: ${BRAND.bg}; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: right; direction: rtl; font-size: 13px; color: ${BRAND.textMuted};">
              בברכה,<br/>המערכת
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** שליחת קישור ל-PDF לשואל (שלב 6 - נשלח ואורכב). questionTitle – כותרת השאלה לגוף המייל. */
export async function sendPdfToAsker(
  to: string,
  pdfUrl: string,
  questionTitle?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "RESEND_API_KEY חסר" };
  }
  const titleLine = questionTitle ? `<p style="margin: 0 0 1em; font-weight: 600;">${escapeHtml(questionTitle)}</p>` : "";
  const body = `
    <p style="margin: 0 0 1em;">שלום וברכה,</p>
    <p style="margin: 0 0 1em;">שמחים לעדכן כי צוות אסק מי פלוס השיב לפנייתך בנושא:</p>
    ${titleLine}
    <p style="margin: 0 0 1em;">קובץ התשובה המלא (PDF) מצורף למייל זה לעיונך.</p>
  `;
  const html = emailTemplate("התשובה לשאלתך", body, {
    text: "להורדת התשובה (PDF)",
    url: pdfUrl,
    primary: true,
  });
  const footerNote = `<span style="display: block; margin-bottom: 8px; font-size: 12px; color: ${BRAND.textMuted};">הערה חשובה: המידע בתשובה זו הינו כללי ואינו מהווה תחליף לייעוץ מקצועי אישי.</span>`;
  const htmlWithNote = html.replace("בברכה,<br/>המערכת", `${footerNote}בברכה,<br/>המערכת`);

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: [to.trim()],
    subject: "התשובה לשאלתך",
    html: htmlWithNote,
  });
  if (error) {
    console.error("sendPdfToAsker:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** שליחת קישור למשיב כשנשלח אליו שאלה (שלב 2 - אצל משיב/ה). הקישור מוביל ישירות לחלון השאלה. respondentGender: M=זכר, F=נקבה – להתאמת הלשון. */
export async function sendAssignmentLinkToRespondent(
  to: string,
  respondentName: string | null,
  adminNote?: string | null,
  questionLabel?: string | null,
  questionId?: string | null,
  topicName?: string | null,
  subTopicName?: string | null,
  respondentGender?: "M" | "F" | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "RESEND_API_KEY חסר" };
  }
  const isF = respondentGender === "F";
  const enter = isF ? "היכנסי" : "היכנס";
  const write = isF ? "כתבי" : "כתוב";
  const click = isF ? "לחצי" : "לחץ";
  const greeting = respondentName ? `שלום <strong>${escapeHtml(respondentName)}</strong>` : "שלום";
  const noteBlock = adminNote?.trim()
    ? `<p style="margin: 1em 0; padding: 12px; background: #fef3c7; border-radius: 8px; border-right: 4px solid #f59e0b;"><strong>הערת מנהל:</strong><br/>${escapeHtml(adminNote.trim())}</p>`
    : "";
  const linkUrl = questionId
    ? goLink(`/respondent?open=${encodeURIComponent(questionId)}`)
    : goLink("/respondent");
  const subjectSuffix = questionLabel?.trim() ? ` (משימה ${questionLabel.trim()})` : "";
  const topicPart = [topicName?.trim(), subTopicName?.trim()].filter(Boolean).join(" – ") || "כללי";
  const body = `
    <p style="margin: 0 0 1em;">${greeting},</p>
    <p style="margin: 0 0 0.75em;">שובצה לך שאלה חדשה לטיפול בנושא <strong>${escapeHtml(topicPart)}</strong>.</p>
    <p style="margin: 0 0 1em;">נא ${enter} בהקדם למערכת בכפתור הבא ו${write} את התשובה. ובסיום ${click} על כפתור השליחה להגהה.</p>
    ${noteBlock}
  `;
  const html = emailTemplate("שאלה חדשה", body, {
    text: "כניסה למערכת וכתיבת תשובה",
    url: linkUrl,
    primary: true,
  });
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: [to.trim()],
    subject: `נשלחה אליך שאלה חדשה${subjectSuffix}`,
    html,
  });
  if (error) {
    console.error("sendAssignmentLinkToRespondent:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** הודעה למגיהים כששאלה נכנסת ללובי ההגהה (שלב 3). questionId – קישור ישיר לשאלה. questionLabel – מזהה ייחודי לנושא (למניעת שרשור). */
export async function sendNewQuestionInLobbyToProofreaders(
  toEmails: string[],
  topicName?: string | null,
  questionId?: string | null,
  questionLabel?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured() || toEmails.length === 0) {
    return toEmails.length === 0 ? { ok: true } : { ok: false, error: "RESEND_API_KEY חסר" };
  }
  const topicLine = topicName ? ` (נושא: ${escapeHtml(topicName)})` : "";
  const linkUrl = questionId
    ? goLink(`/proofreader?open=${encodeURIComponent(questionId)}`)
    : goLink("/proofreader");
  const body = `
    <p style="margin: 0 0 1em;">שלום,</p>
    <p style="margin: 0 0 1em;">נכנסה שאלה חדשה ללובי ההגהה${topicLine}. נא להיכנס ולטפל.</p>
  `;
  const html = emailTemplate("שאלה חדשה בלובי ההגהה", body, {
    text: "כניסה ללובי ההגהה",
    url: linkUrl,
    primary: true,
  });
  const subjectSuffix = (questionLabel ?? questionId) ? ` – משימה ${questionLabel ?? questionId}` : "";
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: toEmails.map((e) => e.trim()).filter(Boolean),
    subject: `שאלה חדשה בלובי ההגהה${subjectSuffix}`,
    html,
  });
  if (error) {
    console.error("sendNewQuestionInLobbyToProofreaders:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** הודעה לעורך הלשוני כששאלה עוברת לעריכה לשונית (שלב 4). questionLabel – מזהה ייחודי לנושא (למניעת שרשור). */
export async function sendToLinguisticEditor(
  toEmails: string[],
  questionPreview?: string,
  questionId?: string | null,
  questionLabel?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured() || toEmails.length === 0) {
    return toEmails.length === 0 ? { ok: true } : { ok: false, error: "RESEND_API_KEY חסר" };
  }
  const preview = questionPreview ? ` (תחילת השאלה: ${escapeHtml(questionPreview.slice(0, 60))}…)` : "";
  const linkUrl = questionId
    ? goLink(`/admin/linguistic?open=${encodeURIComponent(questionId)}`)
    : goLink("/admin/linguistic");
  const body = `
    <p style="margin: 0 0 1em;">שלום,</p>
    <p style="margin: 0 0 1em;">שאלה הועברה לעריכה לשונית${preview}. נא להיכנס ולערוך.</p>
  `;
  const html = emailTemplate("שאלה ממתינה לעריכה לשונית", body, {
    text: "כניסה לעריכה לשונית",
    url: linkUrl,
    primary: true,
  });
  const subjectSuffix = (questionLabel ?? questionId) ? ` – משימה ${questionLabel ?? questionId}` : "";
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: toEmails.map((e) => e.trim()).filter(Boolean),
    subject: `שאלה ממתינה לעריכה לשונית${subjectSuffix}`,
    html,
  });
  if (error) {
    console.error("sendToLinguisticEditor:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** תזכורת למשיב/מגיה – משימה ללא עדכון 5 ימים */
export async function sendInactivityReminder(
  to: string,
  role: "respondent" | "proofreader",
  questionPreview?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "RESEND_API_KEY חסר" };
  }
  const roleLabel = role === "respondent" ? "משיב/ה" : "מגיה/ה";
  const link = role === "respondent" ? goLink("/respondent") : goLink("/proofreader");
  const preview = questionPreview ? ` (שאלה: ${escapeHtml(questionPreview.slice(0, 50))}…)` : "";
  const body = `
    <p style="margin: 0 0 1em;">שלום,</p>
    <p style="margin: 0 0 1em;">משימה שהוקצתה אליך כ־${roleLabel} לא עודכנה מזה 5 ימים. נא לטפל בהקדם.</p>
  `;
  const html = emailTemplate(`תזכורת: משימה ממתינה${preview}`, body, {
    text: "כניסה למערכת",
    url: link,
    primary: false,
  });
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: [to.trim()],
    subject: `תזכורת: משימה ממתינה כבר 5 ימים${preview}`,
    html,
  });
  if (error) {
    console.error("sendInactivityReminder:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** תזכורת ידנית למשיב מתוך לוח הבקרה (לא בהכרח אחרי 5 ימים). */
export async function sendManualReminderToRespondent(
  to: string,
  topicName?: string | null,
  subTopicName?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "RESEND_API_KEY חסר" };
  }
  const topicPart = [topicName?.trim(), subTopicName?.trim()].filter(Boolean).join(" – ") || "כללי";
  const linkUrl = goLink("/respondent");
  const body = `
    <p style="margin: 0 0 1em;">שלום,</p>
    <p style="margin: 0 0 1em;">ממתינה אצלך במערכת שאלה לטיפול בנושא ${escapeHtml(topicPart)}. נא להיכנס בהקדם למערכת בכפתור הבא ולהשלים את כתיבת התשובה.</p>
  `;
  const html = emailTemplate("תזכורת: שאלה ממתינה למענה", body, {
    text: "כניסה למערכת וכתיבת תשובה",
    url: linkUrl,
    primary: false,
  });
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: [to.trim()],
    subject: "תזכורת: שאלה ממתינה למענה",
    html,
  });
  if (error) {
    console.error("sendManualReminderToRespondent:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** סיכום יומי למגיהים – משימות ממתינות בלובי לפי סוג */
/** התראה טכנית למנהלים/מובילים טכניים — פרטי השרת לא מוצגים למשתמש קצה */
export async function sendAdminTechnicalAlert(
  toEmails: string[],
  subjectLine: string,
  plainBody: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured() || toEmails.length === 0) {
    return toEmails.length === 0 ? { ok: true } : { ok: false, error: "RESEND_API_KEY חסר" };
  }
  const body = `<pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:14px;text-align:right;direction:rtl;margin:0;">${escapeHtml(plainBody)}</pre>`;
  const html = emailTemplate(subjectLine, body);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: toEmails.map((e) => e.trim()).filter(Boolean),
    subject: `[מערכת – משיב] ${subjectLine}`,
    html,
  });
  if (error) {
    console.error("sendAdminTechnicalAlert:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function sendLobbySummaryToProofreaders(
  toEmails: string[],
  count: number,
  proofreaderTypeName?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured() || toEmails.length === 0) {
    return toEmails.length === 0 ? { ok: true } : { ok: false, error: "RESEND_API_KEY חסר" };
  }
  const typeLine = proofreaderTypeName ? ` (סוג הגהה: ${escapeHtml(proofreaderTypeName)})` : "";
  const body = `
    <p style="margin: 0 0 1em;">שלום,</p>
    <p style="margin: 0 0 1em;">היום יש <strong>${count}</strong> משימה/ות ממתינות בלובי ההגהה${typeLine}.</p>
  `;
  const lobbyUrl = goLink("/proofreader");
  const html = emailTemplate("סיכום לובי הגהה", body, {
    text: "כניסה ללובי ההגהה",
    url: lobbyUrl,
    primary: true,
  });
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: toEmails.map((e) => e.trim()).filter(Boolean),
    subject: `סיכום לובי: ${count} משימה/ות ממתינות${proofreaderTypeName ? ` – ${proofreaderTypeName}` : ""}`,
    html,
  });
  if (error) {
    console.error("sendLobbySummaryToProofreaders:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
