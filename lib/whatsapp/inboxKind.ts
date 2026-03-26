export type WhatsAppInboxKind = "bot_intake" | "anonymous" | "team";
export type WhatsAppConversationMode = "bot" | "human";

export function classifyConversationKind(input: {
  isTeam: boolean;
  existingMode?: WhatsAppConversationMode | null;
}): { mode: WhatsAppConversationMode; inboxKind: WhatsAppInboxKind } {
  if (input.isTeam) {
    return { mode: "human", inboxKind: "team" };
  }
  if (input.existingMode === "human") {
    return { mode: "human", inboxKind: "anonymous" };
  }
  return { mode: "bot", inboxKind: "bot_intake" };
}

