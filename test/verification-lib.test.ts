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
  maxVerifyAttempts,
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
