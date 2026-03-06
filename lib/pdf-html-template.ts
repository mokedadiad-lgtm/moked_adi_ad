import { sanitizeResponseHtml } from "./response-text";

/**
 * תבנית HTML ל-PDF: עברית RTL, גופן Heebo, ב"ה, שאלה, תשובה (מבנה + כותרות), קו והערות שוליים.
 * מיועד לרינדור בדפדפן (Puppeteer) כדי שהעברית תוצג נכון.
 */
export function buildPdfHtml(options: {
  questionContent: string;
  bodyHtmlForPdf: string;
  footnotes: string[];
  createdAt?: string;
}): string {
  const { questionContent, bodyHtmlForPdf, footnotes, createdAt } = options;
  const safeBody = sanitizeResponseHtml(bodyHtmlForPdf);

  const footnotesHtml =
    footnotes.length > 0
      ? `
    <div class="footnote-sep-wrap"><div class="footnote-sep" aria-hidden="true"></div></div>
    <div class="footnotes">
      ${footnotes.map((line) => `<p class="footnote-line">${escapeHtml(line)}</p>`).join("\n")}
    </div>`
      : "";

  const dateStr = createdAt
    ? new Date(createdAt).toLocaleDateString("he-IL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px 44px 12px;
      font-family: 'Heebo', sans-serif;
      font-size: 11px;
      line-height: 1.7;
      color: #1F2937;
      background: #F9FAFB;
    }
    .header {
      background: #EEF2FF;
      border-bottom: 2px solid #4F46E5;
      padding: 8px 0 10px;
      margin: -12px -44px 0 -44px;
    }
    .b-h { font-size: 9px; color: #4338CA; margin: 0; text-align: right; }
    .content {
      background: #fff;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 20px 24px;
      margin-top: 20px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #374151;
      margin: 16px 0 8px;
    }
    .section-title:first-child { margin-top: 0; }
    .body {
      text-align: right;
    }
    .body p, .body div { margin: 0 0 6px; text-align: right; }
    .body p:last-child, .body div:last-child { margin-bottom: 0; }
    .body h2 { font-size: 14px; font-weight: 700; color: #374151; margin: 16px 0 8px; text-align: right; }
    .body h3 { font-size: 12px; font-weight: 700; color: #4B5563; margin: 12px 0 6px; text-align: right; }
    .body sup {
      font-size: 0.75em;
      vertical-align: super;
      line-height: 0;
    }
    .footnote-line { margin: 0 0 6px; text-align: right; }
    .footnote-sep-wrap { text-align: right; margin: 16px 0 12px; }
    .footnote-sep {
      display: inline-block;
      width: 5cm;
      height: 0;
      border-bottom: 1px solid #94A3B8;
    }
    .footnotes { margin-top: 4px; }
    .question-content { white-space: pre-wrap; margin-bottom: 12px; }
    .footer {
      background: #EEF2FF;
      border-top: 1px solid #C7D2FE;
      padding: 10px 0 12px;
      margin: 24px -44px -12px -44px;
      font-size: 9px;
      color: #4B5563;
      text-align: center;
    }
  </style>
</head>
<body>
  <header class="header">
    <p class="b-h">ב"ה</p>
  </header>
  <main class="content">
    <h2 class="section-title">שאלה</h2>
    <div class="question-content">${escapeHtml(questionContent || "—")}</div>
    <h2 class="section-title">תשובה</h2>
    <div class="body">${safeBody}</div>
    ${footnotesHtml}
  </main>
  ${dateStr ? `<footer class="footer">נוצר בתאריך: ${dateStr}</footer>` : ""}
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
