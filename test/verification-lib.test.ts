import { describe, it, expect, vi, beforeEach } from "vitest";

const { randomIntSpy } = vi.hoisted(() => ({ randomIntSpy: vi.fn() }));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  randomIntSpy.mockImplementation(actual.randomInt as (min: number, max: number) => number);
  return { ...actual, randomInt: randomIntSpy };
});

import {
  codeExpiry,
  codesMatch,
  generateCode,
  invalidInput,
  maxVerifyAttempts,
  nextSend,
} from "../lib/verification";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("generateCode", () => {
  it("draws a 5-digit code from crypto.randomInt", () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^[1-9]\d{4}$/);
    expect(randomIntSpy).toHaveBeenCalledWith(10000, 100000);
  });
});

describe("codesMatch", () => {
  it("matches identical codes only", () => {
    expect(codesMatch("12345", "12345")).toBe(true);
    expect(codesMatch("12345", "12346")).toBe(false);
  });

  it("rejects different lengths, non-strings and a missing stored code", () => {
    expect(codesMatch("12345", "1234")).toBe(false);
    expect(codesMatch("12345", 12345)).toBe(false);
    expect(codesMatch("12345", undefined)).toBe(false);
    expect(codesMatch(null, "12345")).toBe(false);
  });
});

describe("configuration", () => {
  it("defaults to 5 attempts and a 15-minute expiry", () => {
    const from = new Date("2026-01-01T12:00:00Z");
    expect(maxVerifyAttempts()).toBe(5);
    expect(codeExpiry(from).toISOString()).toBe("2026-01-01T12:15:00.000Z");
  });

  it("reads positive integers from the environment", () => {
    vi.stubEnv("VERIFICATION_MAX_ATTEMPTS", "10");
    vi.stubEnv("VERIFICATION_CODE_TTL_MINUTES", "30");
    expect(maxVerifyAttempts()).toBe(10);
    expect(codeExpiry(new Date("2026-01-01T12:00:00Z")).toISOString()).toBe(
      "2026-01-01T12:30:00.000Z"
    );
  });

  it.each(["0", "-1", "2.5", "abc", ""])("ignores invalid value %j", (value) => {
    vi.stubEnv("VERIFICATION_MAX_ATTEMPTS", value);
    expect(maxVerifyAttempts()).toBe(5);
  });
});

describe("nextSend", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

  it("refuses within the 60-second cooldown and says how long to wait", () => {
    const state = { lastSentAt: ago(45), sendCount: 1, sendWindowStart: ago(45) };
    expect(nextSend(state, now)).toEqual({ ok: false, retryAfter: 15 });
  });

  it("allows a send once the cooldown is over and counts it", () => {
    const state = { lastSentAt: ago(60), sendCount: 3, sendWindowStart: ago(600) };
    expect(nextSend(state, now)).toEqual({
      ok: true,
      next: { lastSentAt: now, sendCount: 4, sendWindowStart: ago(600) },
    });
  });

  it("refuses the 13th send within the hour until the hour is over", () => {
    const state = { lastSentAt: ago(120), sendCount: 12, sendWindowStart: ago(50 * 60) };
    expect(nextSend(state, now)).toEqual({ ok: false, retryAfter: 10 * 60 });
  });

  it("starts a new window after an hour", () => {
    const state = { lastSentAt: ago(120), sendCount: 12, sendWindowStart: ago(60 * 60) };
    expect(nextSend(state, now)).toEqual({
      ok: true,
      next: { lastSentAt: now, sendCount: 1, sendWindowStart: now },
    });
  });

  it("honours VERIFICATION_RESEND_COOLDOWN_SECONDS and VERIFICATION_MAX_SENDS_PER_HOUR", () => {
    vi.stubEnv("VERIFICATION_RESEND_COOLDOWN_SECONDS", "300");
    vi.stubEnv("VERIFICATION_MAX_SENDS_PER_HOUR", "3");
    expect(nextSend({ lastSentAt: ago(120), sendCount: 1, sendWindowStart: ago(120) }, now))
      .toEqual({ ok: false, retryAfter: 180 });
    expect(nextSend({ lastSentAt: ago(400), sendCount: 3, sendWindowStart: ago(1000) }, now))
      .toEqual({ ok: false, retryAfter: 2600 });
  });
});

describe("invalidInput", () => {
  it("accepts absent, null and non-empty string fields", () => {
    expect(invalidInput({ a: "x", b: null }, ["a", "b", "c"])).toBeNull();
  });

  it("rejects objects, arrays, numbers and empty strings", () => {
    expect(invalidInput({ a: { contains: "@" } }, ["a"])).toBe("a must be a non-empty string");
    expect(invalidInput({ a: ["x"] }, ["a"])).toBe("a must be a non-empty string");
    expect(invalidInput({ a: 1 }, ["a"])).toBe("a must be a non-empty string");
    expect(invalidInput({ a: "" }, ["a"])).toBe("a must be a non-empty string");
  });

  it("allows an empty string where permitted", () => {
    expect(invalidInput({ a: "" }, ["a"], ["a"])).toBeNull();
    expect(invalidInput({ a: {} }, ["a"], ["a"])).toBe("a must be a non-empty string");
  });

  it("rejects a body that isn't a JSON object", () => {
    for (const body of [null, [], "x", 1]) {
      expect(invalidInput(body, ["a"])).toBe("Request body must be a JSON object");
    }
  });
});
