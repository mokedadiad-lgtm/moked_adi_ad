import { describe, expect, it } from "vitest";
import {
  audienceMatchesAskerGender,
  parseAskerAudience,
} from "./asker-audience";

describe("asker-audience", () => {
  it("parseAskerAudience defaults to both", () => {
    expect(parseAskerAudience(undefined)).toBe("both");
    expect(parseAskerAudience("nope")).toBe("both");
    expect(parseAskerAudience("M")).toBe("M");
    expect(parseAskerAudience("F")).toBe("F");
    expect(parseAskerAudience("both")).toBe("both");
  });

  it("audienceMatchesAskerGender", () => {
    expect(audienceMatchesAskerGender("both", "M")).toBe(true);
    expect(audienceMatchesAskerGender("both", "F")).toBe(true);
    expect(audienceMatchesAskerGender("M", "M")).toBe(true);
    expect(audienceMatchesAskerGender("M", "F")).toBe(false);
    expect(audienceMatchesAskerGender("F", "M")).toBe(false);
    expect(audienceMatchesAskerGender("F", null)).toBe(true);
    expect(audienceMatchesAskerGender("M", undefined)).toBe(true);
  });
});
