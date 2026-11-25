import { randomInt, timingSafeEqual } from "node:crypto";

const positiveIntFromEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

/** Incorrect codes allowed per verification request (`VERIFICATION_MAX_ATTEMPTS`, default 5). */
export const maxVerifyAttempts = () =>
  positiveIntFromEnv("VERIFICATION_MAX_ATTEMPTS", 5);

/** Minutes a code stays valid (`VERIFICATION_CODE_TTL_MINUTES`, default 15). */
export const codeTtlMinutes = () =>
  positiveIntFromEnv("VERIFICATION_CODE_TTL_MINUTES", 15);

/** A 5-digit code from a cryptographically secure source. */
export const generateCode = () => String(randomInt(10000, 100000));

export const codeExpiry = (from = new Date()) =>
  new Date(from.getTime() + codeTtlMinutes() * 60_000);

/** Constant-time comparison of the stored code with the one submitted. */
export function codesMatch(expected: string | null, actual: unknown): boolean {
  if (typeof expected !== "string" || typeof actual !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}
