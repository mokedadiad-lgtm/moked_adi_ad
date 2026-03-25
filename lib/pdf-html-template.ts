import { sanitizeResponseHtml, sanitizeSignatureHtml } from "./response-text";

/**
 * תבנית HTML ל-PDF: עברית RTL, גופן Heebo, ב"ה, מסגרת ורודה סביב שאלה+תשובה+חתימה,
 * רצועות רקע ורוד (#FAF7F9) למעלה/למטה, עמוד 2+ עם שוליים עליונים 2cm (ב־@page), הערות שוליים בתוך מסגרת הטקסט.
 * Puppeteer: `preferCSSPageSize: true` + פוטר ב־`displayHeaderFooter`.
 */
export function buildPdfHtml(options: {
  questionContent: string;
  bodyHtmlForPdf: string;
  footnotes: string[];
  createdAt?: string;
  /** חתימה (HTML מצומצם: b/strong/br) — מוצגת מיושרת לשמאל */
  linguisticSignature?: string | null;
  /** אופציונלי: @font-face עם גופני Heebo כ-base64 – מונע בעיות כשגופנים לא נטענים מהרשת */
  fontFaceCss?: string;
  /** לוגו מוטמע (data URI) – מ־public/brand/logo-full.png */
  logoDataUri?: string;
}): string {
  const { questionContent, bodyHtmlForPdf, footnotes, createdAt, linguisticSignature, fontFaceCss, logoDataUri } = options;
  const safeBody = sanitizeResponseHtml(bodyHtmlForPdf);
  const sigSan = sanitizeSignatureHtml(linguisticSignature ?? "").trim();
  const signatureHtml = sigSan
    ? `<div class="pdf-signature-block" dir="ltr">${sigSan}</div>`
    : "";

  const footnotesHtml =
    footnotes.length > 0
      ? `
    <div class="footnotes-area">
      <div class="footnote-sep-wrap"><div class="footnote-sep" aria-hidden="true"></div></div>
      <div class="footnotes">
        ${footnotes.map((line) => `<p class="footnote-line">${escapeHtml(line)}</p>`).join("\n")}
      </div>
    </div>`
      : "";

  const dateStr = createdAt ? formatHebrewDateLetters(createdAt) : "";

  /* פוטר בעמודים: מוטמע ב-Puppeteer (displayHeaderFooter) — לא כאן */

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  ${fontFaceCss ? "" : '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">'}
  <style>
    ${fontFaceCss ? fontFaceCss : ""}
    /* תחתית: מקום לפוטר בלבד — שטח גוף העמוד מקסימלי (פחות ריק ללא טקסט) */
    @page {
      size: A4;
      margin: 2cm 0 25mm 0;
      background: #FAF7F9;
    }
    @page :first {
      margin-top: 0;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; }
    html {
      background: #FAF7F9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Heebo', sans-serif;
      font-size: 14px;
      line-height: 1.7;
      color: #2C2C54;
      background: #FAF7F9;
      display: block;
      min-height: auto;
      padding: 0 44px;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pdf-branded-top {
      background: #FAF7F9;
      margin: 0 -44px 0 -44px;
      padding: calc(6px + 5mm) 44px 10px;
    }
    /* שורה אחת: תאריך (שמאל) | לוגו (מרכז) | ב"ה (ימין) — dir=ltr ליישור פיזי */
    .pdf-header-row {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-height: 72px;
      direction: ltr;
    }
    .pdf-header-date {
      justify-self: start;
      text-align: left;
      font-size: 12px;
      font-weight: 500;
      color: #75759E;
      line-height: 1.3;
      max-width: 42%;
    }
    .pdf-header-logo-wrap {
      justify-self: center;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pdf-logo {
      max-height: 80px;
      max-width: 220px;
      width: auto;
      height: auto;
      display: block;
      vertical-align: middle;
    }
    .pdf-header-bh {
      justify-self: end;
      text-align: right;
      font-size: 14px;
      font-weight: 600;
      color: #2C2C54;
      margin: 0;
    }
    /* רצועות ורודות (רקע דף) למעלה ולמטה — כמו בין הכותרת לתוכן */
    .content {
      background: transparent;
      padding: 14px 0 0;
      margin-top: 0;
      position: relative;
      z-index: 2;
    }
    .pdf-qa-frame {
      background: #FFFFFF;
      border: 1px solid #E8B4C8;
      border-radius: 12px;
      padding: 22px 16px 18px;
      box-shadow: 0 0 0 1px rgba(232, 180, 200, 0.25);
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      margin: 18px 0 10px;
      text-align: center;
    }
    .section-title.question-title { color: #75759E; }
    .section-title.answer-title { color: #2C2C54; }
    .section-title:first-child { margin-top: 0; }
    .question-content {
      white-space: pre-wrap;
      margin-bottom: 16px;
      text-align: justify;
      color: #75759E;
      padding: 0 1cm;
      font-size: 14px;
      line-height: 1.7;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .body {
      text-align: justify;
      padding: 0 0.65cm;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .body strong, .body b {
      font-weight: 700;
      font-family: 'Heebo', sans-serif;
    }
    .body em, .body i { font-style: italic; }
    .body u { text-decoration: underline; }
    .body p, .body div { margin: 0 0 10px; text-align: justify; }
    .body p:last-child, .body div:last-child { margin-bottom: 0; }
    .body h1 { font-size: 17px; font-weight: 700; color: #2C2C54; margin: 20px 0 10px; text-align: justify; }
    .body h2 { font-size: 16px; font-weight: 700; color: #2C2C54; margin: 18px 0 8px; text-align: justify; }
    .body h3 { font-size: 15px; font-weight: 700; color: #3F3D56; margin: 14px 0 6px; text-align: justify; }
    .body ul, .body ol {
      margin: 0 0 10px;
      padding-inline-start: 1.5em;
    }
    .body li { margin: 0 0 6px; text-align: justify; }
    .body blockquote {
      margin: 10px 0;
      padding: 8px 12px;
      border-right: 3px solid #E8E0E5;
      color: #5C5C78;
    }
    .pdf-signature-block {
      text-align: left;
      white-space: pre-wrap;
      margin-top: 1.25rem;
      padding: 0 0.65cm;
      font-size: 14px;
      line-height: 1.6;
      color: #2C2C54;
      unicode-bidi: plaintext;
    }
    .pdf-signature-block b,
    .pdf-signature-block strong {
      font-weight: 700;
    }
    .body .answer-heading { margin-top: 1.2em; color: #AD1457; }
    .body .answer-sep { height: 0; border-bottom: 1px solid #E5E7EB; margin: 1em 0; }
    .body sup {
      font-size: 0.75em;
      vertical-align: super;
      line-height: 0;
    }
    .footnotes-area {
      margin-top: 1.35rem;
      padding-top: 0.5rem;
      position: relative;
      z-index: 2;
    }
    .footnote-line { margin: 0 0 8px; text-align: justify; padding: 0 0.65cm; }
    .footnote-sep-wrap { text-align: right; margin: 18px 1cm 12px; }
    .footnote-sep {
      display: inline-block;
      width: 5cm;
      height: 0;
      border-bottom: 1px solid #94A3B8;
    }
    .footnotes { padding: 0 0.65cm; }
    @media print {
      main.content {
        padding-bottom: 0 !important;
      }
      .footnotes-area {
        margin-bottom: 0;
      }
    }
  </style>
</head>
<body>
  <div class="pdf-branded-top">
    <div class="pdf-header-row">
      <span class="pdf-header-date">${dateStr ? `נוצר ב: ${escapeHtml(dateStr)}` : "\u00A0"}</span>
      <div class="pdf-header-logo-wrap">
        ${logoDataUri ? `<img class="pdf-logo" src="${logoDataUri}" alt="" />` : ""}
      </div>
      <p class="pdf-header-bh">ב"ה</p>
    </div>
  </div>
  <main class="content">
    <div class="pdf-qa-frame">
      <h2 class="section-title question-title">שאלה</h2>
      <div class="question-content">${escapeHtml(questionContent || "—")}</div>
      <h2 class="section-title answer-title">תשובה</h2>
      <div class="body">${safeBody}</div>
      ${signatureHtml}
      ${footnotesHtml}
    </div>
  </main>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** תאריך עברי עם יום ושנה באותיות (למשל: כ"ג באדר ה'תשפ"ו) */
function formatHebrewDateLetters(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    const fmt = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const parts = fmt.formatToParts(d);
    const dayVal = parts.find((p) => (p.type as string) === "day" || (p.type as string) === "integer")?.value ?? "1";
    const monthVal = parts.find((p) => p.type === "month")?.value ?? "";
    const yearVal = parts.find((p) => p.type === "year")?.value ?? "5780";
    const dayNum = Math.min(30, Math.max(1, parseInt(dayVal, 10) || 1));
    const yearNum = parseInt(yearVal, 10) || 5780;
    const dayLetters = numToHebLetters(dayNum);
    const yearLetters = yearNum >= 5000 ? "ה'" + numToHebLetters(yearNum - 5000) : numToHebLetters(yearNum);
    if (!monthVal) return `${dayLetters} ${yearLetters}`;
    return `${dayLetters} ב${monthVal} ${yearLetters}`;
  } catch {
    return new Date(isoDate).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
  }
}

const HEBREW_ONES = "אבגדהוזחט";
const HEBREW_TENS = "יכלמנסעפצ";
const HEBREW_HUNDREDS = "קרשת";

function numToHebLetters(n: number): string {
  if (n < 1 || n > 999) return String(n);
  if (n <= 10) return HEBREW_ONES[n - 1]!;
  if (n === 15) return 'ט"ו';
  if (n === 16) return 'ט"ז';
  if (n < 20) return 'י"' + HEBREW_ONES[n - 11]!;
  if (n === 20) return "כ";
  if (n < 30) return 'כ"' + HEBREW_ONES[(n % 10) - 1]!;
  if (n === 30) return "ל";
  let out = "";
  let x = n;
  while (x >= 400) {
    out += "ת";
    x -= 400;
  }
  while (x >= 300) {
    out += "ש";
    x -= 300;
  }
  while (x >= 200) {
    out += "ר";
    x -= 200;
  }
  while (x >= 100) {
    out += "ק";
    x -= 100;
  }
  if (x >= 10) {
    out += HEBREW_TENS[Math.floor(x / 10) - 1]!;
    x %= 10;
  }
  if (x > 0) {
    if (out.length > 0) out += '"';
    out += HEBREW_ONES[x - 1]!;
  }
  return out;
}
