const FOOTNOTES_MARKER = "data-footnotes-json";

export interface ParsedResponse {
  bodyHtml: string;
  footnotes: { id: string; text: string }[];
}

/**
 * Parses stored response (HTML + data-footnotes-json) into body HTML and ordered footnotes.
 * Safe to run in Node (no DOM).
 */
export function parseResponseRich(value: string | null | undefined): ParsedResponse {
  if (!value || !value.trim()) return { bodyHtml: "", footnotes: [] };
  let body = value;
  let footnotes: { id: string; text: string }[] = [];
  const fnMatch = body.match(/data-footnotes-json="([^"]*)"/);
  if (fnMatch) {
    try {
      const decoded = fnMatch[1].replace(/&quot;/g, '"');
      footnotes = JSON.parse(decoded) as { id: string; text: string }[];
    } catch {
      // ignore
    }
    body = body.replace(/<div\s+[^>]*data-footnotes-json[^>]*>[\s\S]*?<\/div>/i, "").trim();
  }
  return { bodyHtml: body, footnotes };
}

const ALLOWED_TAGS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "sup",
  "span",
  "br",
  "ul",
  "ol",
  "li",
  "blockquote",
]);

/** Decode HTML entities so PDF/text doesn't show &amp; # etc. */
export function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ");
}

/**
 * Sanitize HTML to only allow tags used by the rich editor. Strips attributes.
 */
export function sanitizeResponseHtml(html: string): string {
  if (!html.trim()) return "";
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<(\/?)([a-z0-9]+)(\s[^>]*)?>/gi, (_, slash, tag) =>
      ALLOWED_TAGS.has(tag.toLowerCase()) ? `<${slash}${tag.toLowerCase()}>` : ""
    );
}

const SIGNATURE_TAGS = new Set(["b", "strong", "br", "div"]);

/** HTML מותר לשדה חתימה ב-PDF: מודגש ושורות (בלי מאפיינים). */
export function sanitizeSignatureHtml(html: string | null | undefined): string {
  if (html == null || typeof html !== "string") return "";
  if (!html.trim()) return "";
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<(\/?)([a-z0-9]+)(\s[^>]*)?>/gi, (_, slash, tag) => {
      const t = tag.toLowerCase();
      if (t === "br" && slash) return "";
      if (t === "br") return "<br>";
      if (!SIGNATURE_TAGS.has(t)) return "";
      return `<${slash}${t}>`;
    });
}

/** ל-react-pdf: פירוק חתימה למקטעי טקסט עם/בלי מודגש */
export function parseSignatureHtmlSegments(html: string): { bold: boolean; text: string }[] {
  let work = sanitizeSignatureHtml(html).trim();
  if (!work) return [];
  work = work.replace(/<br\s*\/?>/gi, "\n");
  work = work.replace(/<div\s*>/gi, "").replace(/<\/div>/gi, "\n");
  const segments: { bold: boolean; text: string }[] = [];
  let bold = 0;
  let buf = "";
  let pos = 0;

  function flush() {
    if (buf.length) {
      segments.push({ text: decodeHtmlEntities(buf), bold: bold > 0 });
      buf = "";
    }
  }

  while (pos < work.length) {
    if (work[pos] === "<") {
      const slice = work.slice(pos);
      const m = slice.match(/^<(\/)?(b|strong)\s*>/i);
      if (m) {
        flush();
        if (m[1]) bold = Math.max(0, bold - 1);
        else bold++;
        pos += m[0].length;
        continue;
      }
      const skip = slice.match(/^<[^>]+>/);
      if (skip) {
        pos += skip[0].length;
        continue;
      }
    }
    buf += work[pos];
    pos++;
  }
  flush();
  return segments;
}

/**
 * Converts stored response to plain text for display (e.g. list summary).
 * Safe to run in Node (no DOM).
 */
export function responseToPlainText(value: string | null | undefined): string {
  const { bodyHtml, footnotes } = parseResponseRich(value);
  let body = bodyHtml
    .replace(/<\/p>|<\/div>|<\/h2>|<\/h3>|<\/h1>|<\/li>|<\/br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\n /g, "\n")
    .replace(/ \n/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
  body = decodeHtmlEntities(body);
  if (footnotes.length === 0) return body;
  const notes = footnotes
    .map((fn, i) => `${i + 1}. ${decodeHtmlEntities((fn.text ?? "").trim())}`)
    .filter((s) => s.length > 2);
  return notes.length ? `${body}\n\nהערות שוליים:\n${notes.join("\n")}` : body;
}

/** For PDF: body and footnotes as separate strings so we can render RTL correctly. */
export function responseToStructured(value: string | null | undefined): {
  bodyPlain: string;
  footnotes: string[];
} {
  const { bodyHtml, footnotes } = parseResponseRich(value);
  let body = bodyHtml
    .replace(/<\/p>|<\/div>|<\/h2>|<\/h3>|<\/h1>|<\/li>|<\/br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\n /g, "\n")
    .replace(/ \n/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
  body = decodeHtmlEntities(body);
  const noteLines = footnotes
    .map((fn, i) => `${i + 1}. ${decodeHtmlEntities((fn.text ?? "").trim())}`)
    .filter((s) => s.length > 2);
  return { bodyPlain: body, footnotes: noteLines };
}

/** מספרי הערה ב־sup עשויים לכלול רווחים בין הסוגריים לספרה */
const SUP_FN_REF = /<sup\s[^>]*data-fn-id="[^"]*"[^>]*>\s*\[\s*(\d+)\s*\]\s*<\/sup>/gi;

const DATA_FN_ID = /data-fn-id="([^"]+)"/gi;

/** מחזיר את רשימת מזהי ההערות לפי סדר הופעה ב-bodyHtml */
export function getFootnoteIdsInOrder(bodyHtml: string): string[] {
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  DATA_FN_ID.lastIndex = 0;
  while ((m = DATA_FN_ID.exec(bodyHtml)) !== null) ids.push(m[1]!);
  return ids;
}

/**
 * מחליף מזהי הערות שוליים ב-body וברשימת ההערות ב-prefix ייחודי (למיזוג כמה תשובות בלי התנגשויות).
 */
export function rewriteFootnoteIds(
  bodyHtml: string,
  footnotes: { id: string; text: string }[],
  prefix: string
): { bodyHtml: string; footnotes: { id: string; text: string }[] } {
  const fnMap = new Map(footnotes.map((f) => [f.id, f.text ?? ""]));
  const orderedIds = getFootnoteIdsInOrder(bodyHtml);
  if (orderedIds.length === 0) return { bodyHtml, footnotes: [] };
  const newBodyHtml = bodyHtml.replace(/data-fn-id="([^"]+)"/gi, (_, id: string) => `data-fn-id="${prefix}${id}"`);
  const newFootnotes = orderedIds.map((id) => ({ id: `${prefix}${id}`, text: fnMap.get(id) ?? "" }));
  return { bodyHtml: newBodyHtml, footnotes: newFootnotes };
}

/**
 * בונה את המחרוזת השמורה (HTML + data-footnotes-json) מגוף ומערך הערות.
 * לשימוש במיזוג תשובות – שומר עיצוב וערות שוליים.
 */
export function buildStoredResponse(
  bodyHtml: string,
  footnotes: { id: string; text: string }[]
): string {
  const fnMap = new Map(footnotes.map((f) => [f.id, f.text ?? ""]));
  const orderedIds = getFootnoteIdsInOrder(bodyHtml);
  const arr = orderedIds.map((id) => ({ id, text: fnMap.get(id) ?? "" }));
  const json = JSON.stringify(arr).replace(/"/g, "&quot;");
  return `${bodyHtml}<div data-footnotes-json="${json}" style="display:none"></div>`;
}

/**
 * For PDF: preserves body structure (p, h2, h3, etc.) and converts footnote refs
 * to superscript numbers without brackets. Returns HTML safe to inject and footnote lines.
 */
export function responseToStructuredForPdf(value: string | null | undefined): {
  bodyHtmlForPdf: string;
  footnotes: string[];
} {
  const { bodyHtml, footnotes } = parseResponseRich(value);
  const body = bodyHtml.replace(SUP_FN_REF, (_, num) => `<sup class="fn-ref">${num}</sup>`);
  const noteLines = footnotes
    .map((fn, i) => `${i + 1}. ${decodeHtmlEntities((fn.text ?? "").trim())}`)
    .filter((s) => s.length > 2);
  return { bodyHtmlForPdf: body, footnotes: noteLines };
}
