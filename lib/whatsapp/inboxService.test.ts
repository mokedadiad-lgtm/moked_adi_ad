import { describe, expect, it } from "vitest";
import { resolveOutboundThreadDisplayText } from "./inboxService";

describe("resolveOutboundThreadDisplayText", () => {
  it("uses preview from template send log", () => {
    expect(
      resolveOutboundThreadDisplayText({
        kind: "template",
        preview: "שלום, מה נשמע?",
        templateName: "team_opening_v1",
        bodyParamsPreview: [],
      })
    ).toBe("שלום, מה נשמע?");
  });

  it("joins bodyParamsPreview when preview missing (older rows)", () => {
    expect(
      resolveOutboundThreadDisplayText({
        kind: "template",
        bodyParamsPreview: ["שם", "נושא"],
        templateName: "x",
      })
    ).toBe("שם\nנושא");
  });

  it("uses text kind preview", () => {
    expect(
      resolveOutboundThreadDisplayText({
        kind: "text",
        preview: "היי",
      })
    ).toBe("היי");
  });

  it("falls back to generic Hebrew without internal ids", () => {
    expect(resolveOutboundThreadDisplayText({ kind: "template", templateName: "t" })).toBe(
      "נשלחה הודעה (WhatsApp)"
    );
  });
});
