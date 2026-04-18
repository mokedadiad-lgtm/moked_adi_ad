import { describe, expect, it } from "vitest";
import {
  buildStoredResponse,
  compactResponseHtmlForQueue,
  decodeHtmlEntities,
  getFootnoteIdsInOrder,
  parseResponseRich,
  responseToPlainText,
  responseToStructuredForPdf,
  sanitizeResponseHtml,
  sanitizeResponseHtmlForPdf,
} from "./response-text";

describe("parseResponseRich", () => {
  it("מחזיר ריק עבור null או ריק", () => {
    expect(parseResponseRich(null).bodyHtml).toBe("");
    expect(parseResponseRich("").footnotes).toEqual([]);
  });

  it("מפרק הערות שוליים מוסתרות", () => {
    const html =
      '<p>טקסט<sup data-fn-id="a">[1]</sup></p><div data-footnotes-json="[{&quot;id&quot;:&quot;a&quot;,&quot;text&quot;:&quot;הערה&quot;}]" style="display:none"></div>';
    const { bodyHtml, footnotes } = parseResponseRich(html);
    expect(bodyHtml).not.toContain("data-footnotes-json");
    expect(footnotes).toEqual([{ id: "a", text: "הערה" }]);
  });
});

describe("decodeHtmlEntities", () => {
  it("מפענח ישויות נפוצות", () => {
    expect(decodeHtmlEntities("a &amp; b")).toBe("a & b");
    expect(decodeHtmlEntities("&#1488;")).toBe("א");
  });
});

describe("sanitizeResponseHtml", () => {
  it("מסיר תגיות לא מורשות", () => {
    expect(sanitizeResponseHtml('<p>ok</p><script>x</script>')).toBe("<p>ok</p>");
  });

  it("משאיר כותרות ומודגש", () => {
    const s = sanitizeResponseHtml("<h2>כותרת</h2><p><strong>ב</strong></p>");
    expect(s).toContain("<h2>");
    expect(s).toContain("<strong>");
  });

  it("שומר מודגש שמגיע כ-span עם font-weight", () => {
    const s = sanitizeResponseHtml('<p><span style="font-weight: 700">מודגש</span></p>');
    expect(s).toContain("<strong>מודגש</strong>");
  });

  it("שומר מודגש גם כש-style בגרש בודד", () => {
    const s = sanitizeResponseHtml("<p><span style='font-weight: 700'>מודגש</span></p>");
    expect(s).toContain("<strong>מודגש</strong>");
  });

  it("שומר מודגש גם כש-style ללא מרכאות", () => {
    const s = sanitizeResponseHtml("<p><span style=font-weight:700>מודגש</span></p>");
    expect(s).toContain("<strong>מודגש</strong>");
  });

  it("שומר מודגש גם כשמגיע מ-class של span", () => {
    const s = sanitizeResponseHtml('<p><span class="font-bold">מודגש</span></p>');
    expect(s).toContain("<strong>מודגש</strong>");
  });
});

describe("getFootnoteIdsInOrder", () => {
  it("מחזיר מזהים לפי סדר הופעה", () => {
    const html = '<p><sup data-fn-id="x"></sup></p><p><sup data-fn-id="y"></sup></p>';
    expect(getFootnoteIdsInOrder(html)).toEqual(["x", "y"]);
  });
});

describe("buildStoredResponse", () => {
  it("מוסיף בלוק JSON מוסתר", () => {
    const out = buildStoredResponse("<p>גוף</p>", [{ id: "a", text: "טקסט" }]);
    expect(out).toContain("data-footnotes-json");
    expect(out).toContain("<p>גוף</p>");
  });
});

describe("responseToPlainText", () => {
  it("ממיר HTML לטקסט קריא", () => {
    const t = responseToPlainText("<p>שלום</p><p>עולם</p>");
    expect(t).toContain("שלום");
    expect(t).toContain("עולם");
  });
});

describe("compactResponseHtmlForQueue", () => {
  it("מוריד כותרת ארוכה לפיסקה עם סימון גוף", () => {
    const out = compactResponseHtmlForQueue(
      "<h2>פסקה ארוכה עם הרבה מילים ומשפט. עוד משפט.</h2>"
    );
    expect(out).not.toMatch(/<h[1-3]>/i);
    expect(out).toContain(`data-rte-q="b"`);
    expect(out).toContain("פסקה ארוכה");
  });

  it("משאיר כותרת קצרה כמודגשת קל (data-rte-q=h)", () => {
    const out = compactResponseHtmlForQueue("<h2>כותרת קצרה</h2>");
    expect(out).toContain(`data-rte-q="h"`);
    expect(out).toContain("font-weight:600");
  });

  it("מטפל בכותרת בלי תג סגירה", () => {
    const out = compactResponseHtmlForQueue("<h2>אין סגירה כאן");
    expect(out).not.toMatch(/<h[1-3]>/i);
    expect(out).toContain("אין סגירה");
    expect(out).toContain("data-rte-q=");
  });

  it("עוטף ב-div כשיש בלוקים פנימיים", () => {
    const out = compactResponseHtmlForQueue("<h2><p>א</p><p>ב</p></h2>");
    expect(out).toMatch(/^<div data-rte-q="/);
    expect(out).not.toMatch(/<h[1-3]>/i);
  });

  it("מסמן מודגש עם משקל inline", () => {
    const out = compactResponseHtmlForQueue("<p><strong>חשוב</strong></p>");
    expect(out).toContain('font-weight:700');
  });

  it("fallback: מסמן בלוק ראשון ככותרת כשהוא קצר", () => {
    const out = compactResponseHtmlForQueue("<div>כותרת קצרה</div><div>פסקה רגילה עם תוכן נוסף.</div>");
    expect(out).toContain('data-rte-q="h"');
    expect(out).toContain("font-weight:600");
  });
});

describe("responseToStructuredForPdf", () => {
  it("משאיר מבנה כותרות ופיסקאות כפי שנשמר בעורך (בלי היוריסטיקות הישנות)", () => {
    const out = responseToStructuredForPdf("<h2>כותרת קצרה</h2><p>גוף</p>");
    expect(out.bodyHtmlForPdf).toContain("<h2>כותרת קצרה</h2>");
    expect(out.bodyHtmlForPdf).toContain("<p>גוף</p>");
  });

  it("משאיר כותרת ארוכה כ-h2 כמו במקור", () => {
    const long =
      "<h2>זה טקסט ממש ארוך מאוד עם הרבה מאוד מילים, שורות, תיאור מפורט והסבר מורחב שנכתב במצב כותרת.</h2>";
    const out = responseToStructuredForPdf(long);
    expect(out.bodyHtmlForPdf).toContain("<h2>");
    expect(out.bodyHtmlForPdf).not.toMatch(/<p>[^<]*זה טקסט ממש ארוך/);
  });

  it("משאיר רצף של כמה כותרות h2 כמו במקור", () => {
    const out = responseToStructuredForPdf(
      "<h2>כותרת א</h2><h2>כותרת ב ארוכה יותר עם טקסט.</h2><p>פסקה.</p>"
    );
    expect(out.bodyHtmlForPdf.match(/<h2>/g)?.length).toBe(2);
    expect(out.bodyHtmlForPdf).toContain("<p>פסקה.</p>");
  });

  it("שומר פסקאות נפרדות", () => {
    const out = responseToStructuredForPdf("<p>פסקה א</p><p>פסקה ב</p>");
    expect(out.bodyHtmlForPdf).toContain("<p>פסקה א</p><p>פסקה ב</p>");
  });

  it("ממיר הערת שוליים לעילית מספרית בלי לשנות את שאר המבנה", () => {
    const html =
      '<p>טקסט<sup data-fn-id="a">[1]</sup></p><div data-footnotes-json="[{&quot;id&quot;:&quot;a&quot;,&quot;text&quot;:&quot;הערה&quot;}]" style="display:none"></div>';
    const out = responseToStructuredForPdf(html);
    expect(out.bodyHtmlForPdf).toContain('<sup class="fn-ref">1</sup>');
    expect(out.bodyHtmlForPdf).toContain("<p>טקסט");
    expect(out.footnotes.some((l) => l.includes("הערה"))).toBe(true);
  });

  it("כותרת עם br בתוך h2 נשארת כפי שנשמרה", () => {
    const out = responseToStructuredForPdf("<h2>שורה א<br>שורה ב</h2>");
    expect(out.bodyHtmlForPdf).toContain("<h2>");
    expect(out.bodyHtmlForPdf).toContain("<br>");
  });
});

describe("sanitizeResponseHtmlForPdf", () => {
  it("כמו sanitizeResponseHtml ומשחזר class על עילית מספרית", () => {
    const step = responseToStructuredForPdf(
      '<p>x<sup data-fn-id="z">[1]</sup></p><div data-footnotes-json="[{&quot;id&quot;:&quot;z&quot;,&quot;text&quot;:&quot;n&quot;}]" style="display:none"></div>'
    );
    const safe = sanitizeResponseHtmlForPdf(step.bodyHtmlForPdf);
    expect(safe).toContain('<sup class="fn-ref">1</sup>');
  });

  it("משאיר strong כמו sanitize רגיל", () => {
    const s = sanitizeResponseHtmlForPdf("<p><strong>מודגש</strong></p>");
    expect(s).toContain("<strong>מודגש</strong>");
  });
});

/**
 * תיעוד רגרסיה: איך HTML מהעורך עובר ל-PDF (מבנה זהה; CSS בתבנית נפרד).
 * ההפרדה הייתה בעיקר מ-normalize* הישן — הוסר.
 */
describe("pdf pipeline fidelity (editor → PDF HTML)", () => {
  it("דוגמה 1: כותרת + שתי פסקאות + מודגש", () => {
    const editor =
      "<h2>נושא</h2><p>פסקה ראשונה עם <strong>הדגשה</strong>.</p><p>פסקה שנייה.</p>";
    const { bodyHtmlForPdf } = responseToStructuredForPdf(editor);
    const safe = sanitizeResponseHtmlForPdf(bodyHtmlForPdf);
    expect(safe).toContain("<h2>נושא</h2>");
    expect(safe).toContain("<strong>הדגשה</strong>");
    expect(safe.match(/<p>/g)?.length).toBe(2);
  });

  it("דוגמה 2: רשימה ופיסקה", () => {
    const editor = "<ul><li>אחת</li><li>שתיים</li></ul><p>אחרי הרשימה</p>";
    const { bodyHtmlForPdf } = responseToStructuredForPdf(editor);
    const safe = sanitizeResponseHtmlForPdf(bodyHtmlForPdf);
    expect(safe).toContain("<ul>");
    expect(safe).toContain("<li>אחת</li>");
    expect(safe).toContain("<p>אחרי הרשימה</p>");
  });
});
