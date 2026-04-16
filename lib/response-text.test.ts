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
  it("משאיר כותרת קצרה אמיתית", () => {
    const out = responseToStructuredForPdf("<h2>כותרת קצרה</h2><p>גוף</p>");
    expect(out.bodyHtmlForPdf).toContain("<h2>כותרת קצרה</h2>");
  });

  it("שומר גם כותרת ארוכה כפי שנשמרה במקור", () => {
    const out = responseToStructuredForPdf(
      "<h2>זה טקסט ממש ארוך מאוד עם הרבה מאוד מילים, שורות, תיאור מפורט והסבר מורחב שנכתב בטעות במצב כותרת ולכן לא צריך להישאר כותרת במסמך PDF.</h2>"
    );
    expect(out.bodyHtmlForPdf).toContain("<p>");
    expect(out.bodyHtmlForPdf).not.toContain("<h2>");
  });

  it("משאיר כותרת בינונית עם סימני פיסוק", () => {
    const out = responseToStructuredForPdf("<h2>ברכה קצרה</h2><p>תוכן רגיל</p>");
    expect(out.bodyHtmlForPdf).toContain("<h2>ברכה קצרה</h2>");
  });

  it("מוריד רק כותרת יחידה ארוכה; לא נוגע בכותרות במסמך רגיל", () => {
    const out = responseToStructuredForPdf("<h2>ברכת הצלחה: תשובה מעודכנת</h2><p>פסקה רגילה.</p>");
    expect(out.bodyHtmlForPdf).toContain("<h2>ברכת הצלחה: תשובה מעודכנת</h2>");
  });

  it("שומר פסקאות נפרדות ולא מאחד אותן", () => {
    const out = responseToStructuredForPdf("<p>פסקה א</p><p>פסקה ב</p>");
    expect(out.bodyHtmlForPdf).toContain("<p>פסקה א</p><p>פסקה ב</p>");
  });

  it("כשכל המסמך נשמר כרצף כותרות — משאיר רק כותרת פתיחה קצרה ומוריד את השאר לפסקאות", () => {
    const out = responseToStructuredForPdf(
      "<h2>כותרת פתיחה</h2><h2>זו כבר פסקה ארוכה מאוד עם הרבה מילים ולכן לא באמת כותרת.</h2><h2>עוד פסקה טקסטואלית עם נקודה.</h2>"
    );
    expect(out.bodyHtmlForPdf).toContain("<h2>כותרת פתיחה</h2>");
    expect(out.bodyHtmlForPdf).toContain("<p>זו כבר פסקה ארוכה מאוד עם הרבה מילים ולכן לא באמת כותרת.</p>");
    expect(out.bodyHtmlForPdf).toContain("<p>עוד פסקה טקסטואלית עם נקודה.</p>");
  });

  it("ממיר כותרת יחידה עם שבירות שורה כפולות לפסקאות", () => {
    const out = responseToStructuredForPdf("<h2>כותרת שגויה<br><br>פסקה א<br><br>פסקה ב</h2>");
    expect(out.bodyHtmlForPdf).toContain("<p>כותרת שגויה</p><p>פסקה א</p><p>פסקה ב</p>");
  });

  it("ממיר גם שבירות שורה בודדות בתוך כותרת שגויה לפסקאות נפרדות", () => {
    const out = responseToStructuredForPdf("<h2>פסקה א<br>פסקה ב<br>פסקה ג</h2>");
    expect(out.bodyHtmlForPdf).toContain("<p>פסקה א</p><p>פסקה ב</p><p>פסקה ג</p>");
  });
});
