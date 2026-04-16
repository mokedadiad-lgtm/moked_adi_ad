import { describe, expect, it } from "vitest";
import { getRichTextEditorInstanceKey } from "./rich-editor-instance-key";

describe("getRichTextEditorInstanceKey", () => {
  const q = "11111111-1111-1111-1111-111111111111";
  const a1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const a2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  it("מחזיר answer_id כשקיים — גם כשמזהה השאלה זהה בין שתי תשובות", () => {
    expect(getRichTextEditorInstanceKey(q, a1)).toBe(a1);
    expect(getRichTextEditorInstanceKey(q, a2)).toBe(a2);
    expect(getRichTextEditorInstanceKey(q, a1)).not.toBe(getRichTextEditorInstanceKey(q, a2));
  });

  it("נופל חזרה ל־question_id בלי answer_id (legacy)", () => {
    expect(getRichTextEditorInstanceKey(q, null)).toBe(q);
    expect(getRichTextEditorInstanceKey(q, undefined)).toBe(q);
    expect(getRichTextEditorInstanceKey(q, "")).toBe(q);
    expect(getRichTextEditorInstanceKey(q, "   ")).toBe(q);
  });
});
