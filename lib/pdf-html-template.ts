import { sanitizeResponseHtml } from "./response-text";

/**
 * תבנית HTML ל-PDF: עברית RTL, גופן Heebo, ב"ה, שאלה, תשובה (מבנה + כותרות), קו והערות שוליים.
 * מיועד לרינדור בדפדפן (Puppeteer) כדי שהעברית תוצג נכון.
 * אם מועבר fontFaceCss (גופנים מוטמעים base64) – אין תלות ברשת והטקסט יצא תקין.
 */
export function buildPdfHtml(options: {
  questionContent: string;
  bodyHtmlForPdf: string;
  footnotes: string[];
  createdAt?: string;
  /** אופציונלי: @font-face עם גופני Heebo כ-base64 – מונע בעיות כשגופנים לא נטענים מהרשת */
  fontFaceCss?: string;
}): string {
  const { questionContent, bodyHtmlForPdf, footnotes, createdAt, fontFaceCss } = options;
  const safeBody = sanitizeResponseHtml(bodyHtmlForPdf);

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

  const footerText = `<span class="footer-line1">אסק מי פלוס – מענה אנונימי מטעם ארגון "עדי עד"</span><br><span class="footer-line2">אתר עדי עד: www.adeyad.org</span><br>המידע בתשובה זו הינו כללי ואינו מהווה תחליף לייעוץ מקצועי אישי.`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  ${fontFaceCss ? "" : '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">'}
  <style>
    ${fontFaceCss ? fontFaceCss : ""}
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: 'Heebo', sans-serif;
      font-size: 14px;
      line-height: 1.7;
      color: #1F2937;
      background: #F9FAFB;
      display: flex;
      flex-direction: column;
      min-height: 297mm;
      padding: 0 44px;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
    .header {
      background: #EEF2FF;
      border-bottom: 2px solid #4F46E5;
      padding: 14px 44px;
      margin: 0 -44px 0 -44px;
      position: relative;
      min-height: 48px;
      display: flex;
      align-items: center;
    }
    .b-h {
      font-size: 14px;
      font-weight: 600;
      color: #4338CA;
      margin: 0;
      position: absolute;
      right: 44px;
      top: 50%;
      transform: translateY(-50%);
    }
    .header-date {
      position: absolute;
      left: 44px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 13px;
      font-weight: 500;
      color: #4B5563;
    }
    .content {
      background: #fff;
      padding: 24px 0;
      margin-top: 20px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .content-body { flex: 1; }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      margin: 18px 0 10px;
      text-align: center;
    }
    .section-title.question-title { color: #6B7280; }
    .section-title.answer-title { color: #000; }
    .section-title:first-child { margin-top: 0; }
    .question-content {
      white-space: pre-wrap;
      margin-bottom: 16px;
      text-align: justify;
      color: #6B7280;
      padding: 0 3cm;
      font-size: 14px;
      line-height: 1.7;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .body {
      text-align: justify;
      padding: 0 1cm;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .body p, .body div { margin: 0 0 10px; text-align: justify; }
    .body p:last-child, .body div:last-child { margin-bottom: 0; }
    .body h2 { font-size: 16px; font-weight: 700; color: #374151; margin: 18px 0 8px; text-align: justify; }
    .body h3 { font-size: 15px; font-weight: 700; color: #4B5563; margin: 14px 0 6px; text-align: justify; }
    .body .answer-heading { margin-top: 1.2em; color: #4338CA; }
    .body .answer-sep { height: 0; border-bottom: 1px solid #E5E7EB; margin: 1em 0; }
    .body sup {
      font-size: 0.75em;
      vertical-align: super;
      line-height: 0;
    }
    .footnotes-area { margin-top: auto; padding-top: 1rem; }
    .footnote-line { margin: 0 0 8px; text-align: justify; padding: 0 1cm; }
    .footnote-sep-wrap { text-align: right; margin: 18px 1cm 12px; }
    .footnote-sep {
      display: inline-block;
      width: 5cm;
      height: 0;
      border-bottom: 1px solid #94A3B8;
    }
    .footnotes { padding: 0 1cm; }
    .footer {
      background: #EEF2FF;
      border-top: 1px solid #C7D2FE;
      padding: 14px 44px;
      margin: 0 -44px 0 -44px;
      font-size: 10px;
      color: #4B5563;
      text-align: center;
      line-height: 1.6;
    }
    .footer-line1 { font-weight: 700; }
    .footer-line2 { color: #DB2777; }
  </style>
</head>
<body>
  <header class="header">
    ${dateStr ? `<span class="header-date">נוצר ב: ${escapeHtml(dateStr)}</span>` : ""}
    <p class="b-h">ב"ה</p>
  </header>
  <main class="content">
    <div class="content-body">
      <h2 class="section-title question-title">שאלה</h2>
      <div class="question-content">${escapeHtml(questionContent || "—")}</div>
      <h2 class="section-title answer-title">תשובה</h2>
      <div class="body">${safeBody}</div>
    </div>
    ${footnotesHtml}
  </main>
  <footer class="footer">${footerText}</footer>
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
