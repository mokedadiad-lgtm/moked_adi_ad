import { describe, expect, it } from "vitest";
import { parseBlocks } from "./pdf-body-html-react-pdf";
import { sanitizeResponseHtmlForPdf } from "./response-text";

describe("parseBlocks (react-pdf fallback)", () => {
  it("מפרק רצף p ו-h2", () => {
    const html = sanitizeResponseHtmlForPdf("<h2>כותרת</h2><p>אחת</p><p>שתיים</p>");
    const blocks = parseBlocks(html);
    expect(blocks.length).toBe(3);
    expect(blocks[0]!.tag).toBe("h2");
    expect(blocks[1]!.tag).toBe("p");
    expect(blocks[2]!.tag).toBe("p");
  });

  it("מפרק רשימה לא מסודרת", () => {
    const html = sanitizeResponseHtmlForPdf("<ul><li>א</li><li>ב</li></ul>");
    const blocks = parseBlocks(html);
    expect(blocks.length).toBe(2);
    expect(blocks.every((b) => b.tag === "li")).toBe(true);
  });

  it("מטפל בטקסט לפני התג הראשון", () => {
    const html = sanitizeResponseHtmlForPdf("פתיחה <p>בתוך פסקה</p>");
    const blocks = parseBlocks(html);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0]!.segments.some((s) => s.text.includes("פתיחה"))).toBe(true);
  });

  it("מפרק שני בלוקים עם מפריד answer-sep (מיזוג תשובות)", () => {
    const raw =
      "<p>ראשון</p><div class=\"answer-sep\"></div><p>שני</p>";
    const html = sanitizeResponseHtmlForPdf(raw);
    const blocks = parseBlocks(html);
    const pBlocks = blocks.filter((b) => b.tag === "p");
    expect(pBlocks.length).toBe(2);
  });
});
