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

/** Seconds a recipient has to wait between sends (`VERIFICATION_RESEND_COOLDOWN_SECONDS`, default 60). */
export const resendCooldownSeconds = () =>
  positiveIntFromEnv("VERIFICATION_RESEND_COOLDOWN_SECONDS", 60);

/** Codes sent to one recipient per hour, the first included (`VERIFICATION_MAX_SENDS_PER_HOUR`, default 12). */
export const maxSendsPerHour = () =>
  positiveIntFromEnv("VERIFICATION_MAX_SENDS_PER_HOUR", 12);

/** Length of the send window. The cleanup jobs keep a request at least this long after the window starts. */
export const SEND_WINDOW_MS = 60 * 60_000;

type SendState = { lastSentAt: Date; sendCount: number; sendWindowStart: Date };

/**
 * Whether another code may be sent to a recipient with this send history, and
 * the counters to store if so. Returns the seconds to wait otherwise.
 */
export function nextSend(
  state: SendState,
  now = new Date()
): { ok: true; next: SendState } | { ok: false; retryAfter: number } {
  const cooldownEnds = state.lastSentAt.getTime() + resendCooldownSeconds() * 1000;
  if (now.getTime() < cooldownEnds) {
    return { ok: false, retryAfter: Math.ceil((cooldownEnds - now.getTime()) / 1000) };
  }

  const windowEnds = state.sendWindowStart.getTime() + SEND_WINDOW_MS;
  if (now.getTime() >= windowEnds) {
    return { ok: true, next: { lastSentAt: now, sendCount: 1, sendWindowStart: now } };
  }
  if (state.sendCount >= maxSendsPerHour()) {
    return { ok: false, retryAfter: Math.ceil((windowEnds - now.getTime()) / 1000) };
  }
  return {
    ok: true,
    next: { lastSentAt: now, sendCount: state.sendCount + 1, sendWindowStart: state.sendWindowStart },
  };
}

/**
 * Checks that the request body is a JSON object whose given fields, when
 * present, are non-empty strings, so nothing else (such as a Prisma filter
 * object) reaches a query. Returns an error message, or null when valid.
 * Fields listed in `allowEmpty` may also be "".
 */
export function invalidInput(
  body: unknown,
  fields: string[],
  allowEmpty: string[] = []
): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return "Request body must be a JSON object";
  }
  for (const field of fields) {
    const value = (body as Record<string, unknown>)[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" || (value === "" && !allowEmpty.includes(field))) {
      return `${field} must be a non-empty string`;
    }
  }
  return null;
}
