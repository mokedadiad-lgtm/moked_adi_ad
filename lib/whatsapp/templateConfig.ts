/**
 * Env keys for Meta-approved template names (WhatsApp Manager).
 * When unset for a channel, the app falls back to free-form text (session-style).
 */
export const WHATSAPP_TEMPLATE_ENV_KEYS = {
  lobby_new_question: "WHATSAPP_TEMPLATE_LOBBY_NEW_QUESTION",
  linguistic_new_question: "WHATSAPP_TEMPLATE_LINGUISTIC_NEW_QUESTION",
  respondent_assignment: "WHATSAPP_TEMPLATE_RESPONDENT_ASSIGNMENT",
  asker_pdf_sent: "WHATSAPP_TEMPLATE_ASKER_PDF_SENT",
  cron_lobby_summary: "WHATSAPP_TEMPLATE_CRON_LOBBY_SUMMARY",
  cron_inactivity_reminder: "WHATSAPP_TEMPLATE_CRON_INACTIVITY_REMINDER",
  team_opening: "WHATSAPP_TEMPLATE_TEAM_OPENING",
} as const;

export type WhatsAppInitiatedTemplateKey = keyof typeof WHATSAPP_TEMPLATE_ENV_KEYS;

export function getWhatsAppTemplateName(key: WhatsAppInitiatedTemplateKey): string | undefined {
  const envName = WHATSAPP_TEMPLATE_ENV_KEYS[key];
  const n = process.env[envName]?.trim();
  return n || undefined;
}

/** Graph API `language.code` (e.g. `he` — must match the template in Manager). */
export function getWhatsAppTemplateLanguageCode(): string {
  return process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "he";
}

/**
 * Meta rejects empty body parameters; use an invisible placeholder for optional parts.
 */
export function waTemplateBodyParam(value: string): string {
  const v = value ?? "";
  return v.length > 0 ? v : "\u2060";
}
