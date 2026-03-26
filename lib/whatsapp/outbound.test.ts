import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insertMock = vi.fn(async () => ({ error: null }));
  const fromMock = vi.fn(() => ({ insert: insertMock }));
  const getSupabaseAdminMock = vi.fn(() => ({ from: fromMock }));

  const sendMetaWhatsAppTextMock = vi.fn(async () => ({ ok: true, idMessage: "wamid.text" as string | undefined }));
  const sendMetaWhatsAppTemplateMock = vi.fn(async () => ({ ok: true, idMessage: "wamid.tpl" as string | undefined }));
  const isMetaConfiguredMock = vi.fn(() => true);

  const getTemplateNameMock = vi.fn();
  const getLanguageCodeMock = vi.fn(() => "he");

  return {
    insertMock,
    fromMock,
    getSupabaseAdminMock,
    sendMetaWhatsAppTextMock,
    sendMetaWhatsAppTemplateMock,
    isMetaConfiguredMock,
    getTemplateNameMock,
    getLanguageCodeMock,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdminMock,
}));

vi.mock("./meta", () => ({
  sendMetaWhatsAppText: mocks.sendMetaWhatsAppTextMock,
  sendMetaWhatsAppTemplate: mocks.sendMetaWhatsAppTemplateMock,
  isMetaWhatsAppConfigured: mocks.isMetaConfiguredMock,
}));

vi.mock("./templateConfig", () => ({
  getWhatsAppTemplateName: mocks.getTemplateNameMock,
  getWhatsAppTemplateLanguageCode: mocks.getLanguageCodeMock,
}));

import { sendMetaWhatsAppInitiatedWithLog } from "./outbound";

describe("sendMetaWhatsAppInitiatedWithLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertMock.mockResolvedValue({ error: null });
    mocks.isMetaConfiguredMock.mockReturnValue(true);
    mocks.getTemplateNameMock.mockReturnValue(undefined);
    mocks.sendMetaWhatsAppTextMock.mockResolvedValue({ ok: true, idMessage: "wamid.text" });
    mocks.sendMetaWhatsAppTemplateMock.mockResolvedValue({ ok: true, idMessage: "wamid.tpl" });
  });

  it("falls back to text when template name is not configured", async () => {
    const result = await sendMetaWhatsAppInitiatedWithLog("+972547405050", {
      templateKey: "respondent_assignment",
      channel_event: "respondent_assignment",
      bodyParameters: ["name", "topic", "note"],
      buttonDynamicParam: "api/go?r=%2Frespondent",
      legacyText: "legacy text",
    });

    expect(result.ok).toBe(true);
    expect(mocks.sendMetaWhatsAppTextMock).toHaveBeenCalledTimes(1);
    expect(mocks.sendMetaWhatsAppTemplateMock).not.toHaveBeenCalled();
  });

  it("sends template with CTA when template name exists", async () => {
    mocks.getTemplateNameMock.mockReturnValue("respondent_assignment_v2");

    const result = await sendMetaWhatsAppInitiatedWithLog("+972547405050", {
      templateKey: "respondent_assignment",
      channel_event: "respondent_assignment",
      idempotency_key: "k1",
      bodyParameters: ["nameOnly", "topic", "note"],
      buttonDynamicParam: "api/go?r=%2Frespondent",
      legacyText: "legacy text",
    });

    expect(result.ok).toBe(true);
    expect(mocks.sendMetaWhatsAppTemplateMock).toHaveBeenCalledTimes(1);
    expect(mocks.sendMetaWhatsAppTemplateMock).toHaveBeenCalledWith(
      "+972547405050",
      "respondent_assignment_v2",
      "he",
      ["nameOnly", "topic", "note"],
      "api/go?r=%2Frespondent"
    );
    expect(mocks.sendMetaWhatsAppTextMock).not.toHaveBeenCalled();
  });
});

