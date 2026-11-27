import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  assertLoginLimits,
  clearRateLimitStoreForTests,
  extractClientIp,
} from "@/lib/rate-limit";

describe("rate limiting and IP header spoofing protection", () => {
  beforeEach(() => {
    clearRateLimitStoreForTests();
    delete process.env.TRUST_PROXY;
  });

  it("ignores spoofed X-Forwarded-For headers when TRUST_PROXY is not enabled", () => {
    const h1 = new Headers({ "x-forwarded-for": "10.0.0.1" });
    const h2 = new Headers({ "x-forwarded-for": "10.0.0.2" });
    expect(extractClientIp(h1)).toBe("direct");
    expect(extractClientIp(h2)).toBe("direct");
  });

  it("enforces per-email login rate limits even when client IP changes", () => {
    for (let i = 0; i < 5; i += 1) {
      assertLoginLimits("victim@aegisexam.local", `10.0.0.${i}`, 1_000);
    }
    try {
      assertLoginLimits("victim@aegisexam.local", "10.0.0.99", 1_000);
      expect.fail("Expected RATE_LIMITED error");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ status: 429, code: "RATE_LIMITED" });
    }
  });
});
