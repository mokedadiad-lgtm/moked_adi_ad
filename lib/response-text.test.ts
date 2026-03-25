import { describe, expect, it } from "vitest";
import {
  buildStoredResponse,
  decodeHtmlEntities,
  getFootnoteIdsInOrder,
  parseResponseRich,
  responseToPlainText,
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
