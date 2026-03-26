import { afterEach, describe, expect, it } from "vitest";
import { extractWhatsAppUrlSuffix } from "./urlSuffix";

describe("extractWhatsAppUrlSuffix", () => {
  const originalBase = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (originalBase === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalBase;
  });

  it("returns suffix for matching NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    const out = extractWhatsAppUrlSuffix("https://app.example.com/api/go?r=%2Fproofreader");
    expect(out).toBe("api/go?r=%2Fproofreader");
  });

  it("normalizes trailing slash in base URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";
    const out = extractWhatsAppUrlSuffix("https://app.example.com/admin/linguistic?open=abc");
    expect(out).toBe("admin/linguistic?open=abc");
  });

  it("falls back to full URL on non-matching base", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    const out = extractWhatsAppUrlSuffix("https://other.example.com/path?q=1");
    expect(out).toBe("https://other.example.com/path?q=1");
  });

  it("falls back to full URL when base is missing", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const out = extractWhatsAppUrlSuffix("https://app.example.com/path");
    expect(out).toBe("https://app.example.com/path");
  });
});

