import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeMetaPhone,
  sendMetaWhatsAppTemplate,
} from "./meta";

describe("normalizeMetaPhone", () => {
  it("converts local 05x number to +972 format", () => {
    expect(normalizeMetaPhone("054-7405050")).toBe("+972547405050");
  });

  it("keeps 972-prefixed number and adds +", () => {
    expect(normalizeMetaPhone("972547405050")).toBe("+972547405050");
  });

  it("returns null for invalid short number", () => {
    expect(normalizeMetaPhone("12345")).toBeNull();
  });
});

describe("sendMetaWhatsAppTemplate", () => {
  const originalToken = process.env.META_ACCESS_TOKEN;
  const originalPhoneId = process.env.META_PHONE_NUMBER_ID;
  const originalVersion = process.env.META_GRAPH_API_VERSION;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalToken === undefined) delete process.env.META_ACCESS_TOKEN;
    else process.env.META_ACCESS_TOKEN = originalToken;

    if (originalPhoneId === undefined) delete process.env.META_PHONE_NUMBER_ID;
    else process.env.META_PHONE_NUMBER_ID = originalPhoneId;

    if (originalVersion === undefined) delete process.env.META_GRAPH_API_VERSION;
    else process.env.META_GRAPH_API_VERSION = originalVersion;

    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sends template body parameters without button when CTA absent", async () => {
    process.env.META_ACCESS_TOKEN = "token";
    process.env.META_PHONE_NUMBER_ID = "123";
    process.env.META_GRAPH_API_VERSION = "v20.0";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.1" }] }),
    })) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const res = await sendMetaWhatsAppTemplate("+972547405050", "tpl_name", "he", ["a", "b"]);
    expect(res).toEqual({ ok: true, idMessage: "wamid.1" });

    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = JSON.parse((init as RequestInit).body as string) as {
      template: { components: Array<{ type: string }> };
    };
    expect(parsed.template.components).toHaveLength(1);
    expect(parsed.template.components[0].type).toBe("body");
  });

  it("adds CTA button component when dynamic param is provided", async () => {
    process.env.META_ACCESS_TOKEN = "token";
    process.env.META_PHONE_NUMBER_ID = "123";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.2" }] }),
    })) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await sendMetaWhatsAppTemplate(
      "+972547405050",
      "tpl_name",
      "he",
      ["name", "id", "topic"],
      "api/go?r=%2Fproofreader"
    );

    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = JSON.parse((init as RequestInit).body as string) as {
      template: {
        components: Array<{
          type: string;
          sub_type?: string;
          index?: string;
          parameters?: Array<{ type: string; text: string }>;
        }>;
      };
    };
    expect(parsed.template.components).toHaveLength(2);
    const button = parsed.template.components[1];
    expect(button.type).toBe("button");
    expect(button.sub_type).toBe("url");
    expect(button.index).toBe("0");
    expect(button.parameters?.[0]).toEqual({
      type: "text",
      text: "api/go?r=%2Fproofreader",
    });
  });
});

