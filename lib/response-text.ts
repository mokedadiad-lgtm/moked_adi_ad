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
    // Some editors/paste sources represent bold as <span style="font-weight:...">.
    // Convert these spans to <strong> so bold survives attribute stripping.
    .replace(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi, (full, attrs: string, inner: string) => {
      const styleMatch = attrs.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const style = (styleMatch?.[1] ?? styleMatch?.[2] ?? styleMatch?.[3] ?? "").toLowerCase();
      const classMatch = attrs.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const klass = (classMatch?.[1] ?? classMatch?.[2] ?? classMatch?.[3] ?? "").toLowerCase();
      const isBold =
        /\bfont-weight\s*:\s*bold\b/i.test(style) ||
        /\bfont-weight\s*:\s*([6-9]00)\b/i.test(style);
      const isBoldClass = /\b(font-bold|font-semibold|fw-bold|bold)\b/i.test(klass);
      return isBold || isBoldClass ? `<strong>${inner}</strong>` : full;
    })
    .replace(/<(\/?)([a-z0-9]+)(\s[^>]*)?>/gi, (_, slash, tag) =>
      ALLOWED_TAGS.has(tag.toLowerCase()) ? `<${slash}${tag.toLowerCase()}>` : ""
    );
}

/**
 * תצוגת תור (מצומצמת) ללובי המגיהים: ממיר h1–h3 ל־p/div עם data-rte-q כדי לעצב בלי תגי כותרת "כבדים".
 * — h = כותרת קצרה (נשארת מודגשת קל); b = גוף שנכתב בטעות בכותרת (נראה כמו פיסקה רגילה).
 * — מטפל בכמה בלוקים, ובמקרה בלי תג סגירה.
 */
export function compactResponseHtmlForQueue(html: string): string {
  if (!html.trim()) return "";

  const blockInside = (inner: string) =>
    /<(p|div|ul|ol|li|blockquote|h1|h2|h3)\b/i.test(inner);

  const headingKind = (inner: string): "h" | "b" => {
    const plain = inner.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const textLen = plain.length;
    const wordCount = plain ? plain.split(/\s+/).length : 0;
    const hasLineBreak = /<br\s*\/?>/i.test(inner);
    const hasBlockInside = /<(p|div|ul|ol|li|blockquote|h1|h2|h3)\b/i.test(inner);
    const hasSentencePunctuation = /[.!?,;:]/.test(plain);
    const looksLikeShortTitle =
      textLen > 0 &&
      textLen <= 60 &&
      wordCount <= 8 &&
      !hasSentencePunctuation &&
      !hasLineBreak &&
      !hasBlockInside;
    return looksLikeShortTitle ? "h" : "b";
  };

  const looksLikeShortTitleText = (plain: string): boolean => {
    const p = plain.replace(/\s+/g, " ").trim();
    if (!p) return false;
    const textLen = p.length;
    const wordCount = p.split(/\s+/).length;
    const hasSentencePunctuation = /[.!?,;:]/.test(p);
    return textLen <= 60 && wordCount <= 8 && !hasSentencePunctuation;
  };

  const openQueueHeadingBlock = (wrapper: "p" | "div", kind: "h" | "b") => {
    const style =
      kind === "h"
        ? 'style="font-weight:600;color:var(--foreground)"'
        : 'style="font-weight:400;color:inherit"';
    return `<${wrapper} data-rte-q="${kind}" ${style}>`;
  };

  const replaceOneHeadingPair = (_full: string, _tag: string, inner: string) => {
    const wrapper = blockInside(inner) ? "div" : "p";
    const kind = headingKind(inner);
    return `${openQueueHeadingBlock(wrapper, kind)}${inner}</${wrapper}>`;
  };

  let s = html;
  let prev = "";
  while (s !== prev) {
    prev = s;
    s = s.replace(/<h([1-3])>([\s\S]*?)<\/h\1>/gi, replaceOneHeadingPair);
  }

  s = s.replace(/<h[1-3]>([\s\S]*)$/i, (full, inner: string) => {
    if (/<\/h[1-3]>/i.test(inner)) return full;
    const wrapper = blockInside(inner) ? "div" : "p";
    const kind = headingKind(inner);
    return `${openQueueHeadingBlock(wrapper, kind)}${inner}</${wrapper}>`;
  });

  // מודגש: inline כדי שלא יידרס ע"י שרשרת CSS חיצונית / Tailwind שלא נטען
  s = s.replace(/<strong>/gi, '<strong style="font-weight:700">');
  s = s.replace(/<b>/gi, '<b style="font-weight:700">');

  // fallback: אם לא נשארה אף כותרת מזוהה בתצוגה, נסמן את הבלוק הראשון ככותרת
  // כשנראה כמו כותרת קצרה (מצב נפוץ כשנשמרו רק div/p ללא h2 אמיתי).
  if (!/data-rte-q="h"/i.test(s) && !/<h[1-3]\b/i.test(s)) {
    s = s.replace(/<(p|div)\b([^>]*)>([\s\S]*?)<\/\1>/i, (full, tag: string, attrs: string, inner: string) => {
      if (/data-rte-q=/i.test(attrs || "")) return full;
      const firstLine = inner
        .replace(/<\/(p|div|li|blockquote|h1|h2|h3)>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]*>/g, " ")
        .split("\n")
        .map((x) => x.replace(/\s+/g, " ").trim())
        .find((x) => x.length > 0);
      if (!firstLine || !looksLikeShortTitleText(firstLine)) return full;
      const cleanAttrs = (attrs ?? "").trim();
      const prefix = cleanAttrs ? ` ${cleanAttrs}` : "";
      return `<${tag}${prefix} data-rte-q="h" style="font-weight:600;color:var(--foreground)">${inner}</${tag}>`;
    });
  }

  return s;
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
  const withFnRefs = bodyHtml.replace(SUP_FN_REF, (_, num) => `<sup class="fn-ref">${num}</sup>`);
  const body = normalizeSingleAccidentalHeadingForPdf(withFnRefs);
  const noteLines = footnotes
    .map((fn, i) => `${i + 1}. ${decodeHtmlEntities((fn.text ?? "").trim())}`)
    .filter((s) => s.length > 2);
  return { bodyHtmlForPdf: body, footnotes: noteLines };
}

/**
 * Targeted PDF fix:
 * If the entire body is one accidental heading block (common editor slip),
 * downgrade only that block to paragraph/div so the whole PDF won't look like a title.
 * Keep all normal headings untouched.
 */
function normalizeSingleAccidentalHeadingForPdf(html: string): string {
  const src = (html ?? "").trim();
  if (!src) return "";

  // Only run when the whole content is exactly one heading wrapper.
  const singleHeading = src.match(/^<h([1-3])>([\s\S]*)<\/h\1>$/i);
  if (!singleHeading) return src;

  const inner = singleHeading[2] ?? "";
  // Not truly single: multiple sibling headings were captured greedily.
  if (/<\/h[1-3]>\s*<h[1-3]>/i.test(inner)) {
    return normalizeHeadingRunForPdf(src);
  }
  const plain = inner.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = plain ? plain.split(/\s+/).length : 0;
  const textLen = plain.length;
  const hasSentencePunctuation = /[.!?,;:]/.test(plain);
  const hasLineBreak = /<br\s*\/?>/i.test(inner);
  const hasBlockInside = /<(p|div|ul|ol|li|blockquote|h1|h2|h3)\b/i.test(inner);

  // Conservative heuristic: long/sentence-like single heading is almost certainly accidental.
  const looksAccidental =
    textLen > 120 || wordCount > 14 || hasSentencePunctuation || hasLineBreak || hasBlockInside;
  if (!looksAccidental) {
    // Additional case: heading mode remained active, producing many heading blocks.
    // Keep a short first heading and downgrade subsequent heading blocks that look like body text.
    return normalizeHeadingRunForPdf(src);
  }

  return convertHeadingBodyToParagraphs(inner, hasBlockInside);
}

function normalizeHeadingRunForPdf(html: string): string {
  const headingBlocks = [...html.matchAll(/<h([1-3])>([\s\S]*?)<\/h\1>/gi)];
  if (headingBlocks.length < 2) return html;

  const headingStats = headingBlocks.map((m) => {
    const inner = m[2] ?? "";
    const plain = inner.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const words = plain ? plain.split(/\s+/).length : 0;
    const hasSentencePunctuation = /[.!?,;:]/.test(plain);
    const hasLineBreak = /<br\s*\/?>/i.test(inner);
    const hasBlockInside = /<(p|div|ul|ol|li|blockquote|h1|h2|h3)\b/i.test(inner);
    const looksBody = words > 10 || plain.length > 70 || hasSentencePunctuation || hasLineBreak || hasBlockInside;
    return { plain, looksBody };
  });

  const bodyLikeCount = headingStats.filter((s) => s.looksBody).length;
  if (bodyLikeCount === 0) return html;

  let idx = 0;
  return html.replace(/<h([1-3])>([\s\S]*?)<\/h\1>/gi, (_full, _level: string, inner: string) => {
    const stat = headingStats[idx++];
    const keepAsHeading = idx === 1 && !stat?.looksBody && stat.plain.length <= 60;
    if (keepAsHeading) {
      return `<h2>${inner}</h2>`;
    }
    const hasBlockInside = /<(p|div|ul|ol|li|blockquote|h1|h2|h3)\b/i.test(inner);
    return convertHeadingBodyToParagraphs(inner, hasBlockInside);
  });
}

function convertHeadingBodyToParagraphs(inner: string, hasBlockInside: boolean): string {
  if (hasBlockInside) {
    // Preserve existing block structure without wrapping with an extra div.
    return inner;
  }
  // In accidental heading-mode content, <br> is often used as paragraph separator.
  const parts = inner
    .split(/<br\s*\/?>/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length <= 1) {
    return `<p>${inner}</p>`;
  }
  return parts.map((p) => `<p>${p}</p>`).join("");
}
