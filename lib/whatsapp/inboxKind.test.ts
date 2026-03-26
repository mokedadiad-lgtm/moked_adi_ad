import { describe, expect, it } from "vitest";
import { classifyConversationKind } from "@/lib/whatsapp/inboxKind";

describe("classifyConversationKind", () => {
  it("classifies team as human/team", () => {
    expect(classifyConversationKind({ isTeam: true, existingMode: "bot" })).toEqual({
      mode: "human",
      inboxKind: "team",
    });
  });

  it("classifies existing human as anonymous", () => {
    expect(classifyConversationKind({ isTeam: false, existingMode: "human" })).toEqual({
      mode: "human",
      inboxKind: "anonymous",
    });
  });

  it("classifies non-team bot as bot_intake", () => {
    expect(classifyConversationKind({ isTeam: false, existingMode: "bot" })).toEqual({
      mode: "bot",
      inboxKind: "bot_intake",
    });
  });
});

