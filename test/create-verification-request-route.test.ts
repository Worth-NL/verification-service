import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock, notifyMock, NotifyClientMock } = vi.hoisted(() => {
  const notifyMock = { sendEmail: vi.fn(), sendSms: vi.fn() };
  return {
    notifyMock,
    NotifyClientMock: vi.fn(function () { return notifyMock; }),
    prismaMock: {
      verificationRequest: {
        findUnique: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
  };
});

vi.mock("@prisma/client", () => ({ PrismaClient: vi.fn(function () { return prismaMock; }) }));
vi.mock("notifications-node-client", () => ({ NotifyClient: NotifyClientMock }));

import { POST } from "../app/api/verification-requests/route";

const db = prismaMock.verificationRequest;

const makeReq = (body: unknown) =>
  ({ json: async () => body }) as unknown as import("next/server").NextRequest;

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

/** A stored request for user@example.com, last sent `sentMinutesAgo` minutes ago. */
const existing = (overrides: Record<string, unknown> = {}) => ({
  id: "vr-1",
  emailAddress: "user@example.com",
  phoneNumber: null,
  reference: null,
  code: "11111",
  attempts: 3,
  lastSentAt: minutesAgo(5),
  sendCount: 1,
  sendWindowStart: minutesAgo(5),
  ...overrides,
});

const emailBody = (extra: Record<string, unknown> = {}) => ({
  email: "user@example.com",
  apiKey: "k",
  templateId: "t",
  ...extra,
});

const sentCode = () => notifyMock.sendEmail.mock.calls[0][2].personalisation.code;

beforeEach(() => {
  db.findUnique.mockReset().mockResolvedValue(null);
  db.create.mockReset().mockResolvedValue({ id: "vr-new" });
  db.updateMany.mockReset().mockResolvedValue({ count: 1 });
  db.deleteMany.mockReset().mockResolvedValue({ count: 1 });
  notifyMock.sendEmail.mockReset().mockResolvedValue(undefined);
  notifyMock.sendSms.mockReset().mockResolvedValue(undefined);
  NotifyClientMock.mockClear();
  vi.unstubAllEnvs();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/verification-requests — input validation", () => {
  it("400s when both email and phoneNumber are provided", async () => {
    const res = await POST(
      makeReq({ email: "a@b.com", phoneNumber: "+31612345678", apiKey: "k" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Provide either email or phoneNumber, not both or neither.",
    });
    expect(db.findUnique).not.toHaveBeenCalled();
  });

  it("400s when neither email nor phoneNumber is provided", async () => {
    const res = await POST(makeReq({ apiKey: "k" }));
    expect(res.status).toBe(400);
  });

  it("400s when no API key is available", async () => {
    const res = await POST(makeReq({ email: "a@b.com", templateId: "t" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "API Key is required" });
  });

  it("400s when no template id can be resolved", async () => {
    const res = await POST(makeReq({ email: "a@b.com", apiKey: "k" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error:
        "Appropriate templateId is missing in the request or environment variables.",
    });
  });
});

describe("POST /api/verification-requests — input types", () => {
  it.each([
    ["email", { email: { contains: "@" } }],
    ["phoneNumber", { phoneNumber: { startsWith: "+31" } }],
    ["reference", { email: "user@example.com", reference: { not: "" } }],
    ["apiKey", { email: "user@example.com", apiKey: ["k"], templateId: "t" }],
    ["templateId", { email: "user@example.com", templateId: 1 }],
    ["email", { email: "" , phoneNumber: "+31612345678" }],
  ])("400s when %s is not a non-empty string, without querying or sending", async (field, body) => {
    const res = await POST(makeReq({ apiKey: "k", templateId: "t", ...body }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: `${field} must be a non-empty string` });
    expect(db.findUnique).not.toHaveBeenCalled();
    expect(notifyMock.sendEmail).not.toHaveBeenCalled();
    expect(notifyMock.sendSms).not.toHaveBeenCalled();
  });

  it("400s when the body is not a JSON object or not JSON", async () => {
    for (const body of [null, [], 42]) {
      const res = await POST(makeReq(body));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Request body must be a JSON object" });
    }
    const res = await POST({
      json: async () => { throw new SyntaxError("Unexpected token"); },
    } as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Request body must be valid JSON" });
    expect(db.findUnique).not.toHaveBeenCalled();
  });
});

describe("POST /api/verification-requests — new request", () => {
  it("stores a 5-digit code with its send history, sends it by email and returns 201", async () => {
    const before = Date.now();
    const res = await POST(makeReq(emailBody({ apiKey: "key-1", templateId: "tmpl-email" })));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true });

    const { data } = db.create.mock.calls[0][0];
    expect(sentCode()).toMatch(/^\d{5}$/);
    expect(data).toMatchObject({
      emailAddress: "user@example.com",
      phoneNumber: null,
      reference: null,
      code: sentCode(),
      verified: false,
      sendCount: 1,
    });
    expect(data.lastSentAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(data.sendWindowStart).toEqual(data.lastSentAt);
    expect(notifyMock.sendEmail).toHaveBeenCalledWith("tmpl-email", "user@example.com", {
      personalisation: { code: sentCode() },
    });
    expect(notifyMock.sendSms).not.toHaveBeenCalled();
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it("gives the code a 15-minute expiry", async () => {
    const before = Date.now();
    await POST(makeReq(emailBody()));

    const ttl = db.create.mock.calls[0][0].data.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(15 * 60_000);
    expect(ttl).toBeLessThan(15 * 60_000 + 5_000);
  });

  it("honours VERIFICATION_CODE_TTL_MINUTES", async () => {
    vi.stubEnv("VERIFICATION_CODE_TTL_MINUTES", "5");
    const before = Date.now();
    await POST(makeReq(emailBody()));

    const ttl = db.create.mock.calls[0][0].data.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(5 * 60_000);
    expect(ttl).toBeLessThan(5 * 60_000 + 5_000);
  });

  it("sends the code by SMS for a phone number", async () => {
    const res = await POST(
      makeReq({ phoneNumber: "+31612345678", apiKey: "k", templateId: "tmpl-sms" })
    );

    expect(res.status).toBe(201);
    expect(notifyMock.sendSms).toHaveBeenCalledWith(
      "tmpl-sms",
      "+31612345678",
      expect.objectContaining({ personalisation: expect.any(Object) })
    );
    expect(notifyMock.sendEmail).not.toHaveBeenCalled();
  });

  it("looks up the reference when supplied, else the email or phone number", async () => {
    await POST(makeReq(emailBody()));
    await POST(makeReq({ phoneNumber: "+31612345678", apiKey: "k", templateId: "t" }));
    await POST(makeReq(emailBody({ reference: "ref-9" })));

    expect(db.findUnique.mock.calls.map((c) => c[0].where)).toEqual([
      { emailAddress: "user@example.com" },
      { phoneNumber: "+31612345678" },
      { reference: "ref-9" },
    ]);
  });

  it("treats an empty reference as no reference", async () => {
    await POST(makeReq(emailBody({ reference: "" })));

    expect(db.findUnique.mock.calls[0][0].where).toEqual({ emailAddress: "user@example.com" });
    expect(db.create.mock.calls[0][0].data.reference).toBeNull();
  });

  it("409s without sending when the recipient or reference is already taken", async () => {
    db.create.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));

    const res = await POST(makeReq(emailBody({ reference: "new-ref" })));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "This request conflicts with an existing verification request.",
    });
    expect(notifyMock.sendEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/verification-requests — resend", () => {
  it("claims the send, sends a new code, then resets the code, attempts and expiry (200)", async () => {
    const row = existing();
    db.findUnique.mockResolvedValueOnce(row);

    const res = await POST(makeReq(emailBody()));

    expect(res.status).toBe(200);
    const [claim, reset] = db.updateMany.mock.calls.map((c) => c[0]);
    expect(claim.where).toEqual({ id: "vr-1", lastSentAt: row.lastSentAt, sendCount: 1 });
    expect(claim.data).toMatchObject({ sendCount: 2, sendWindowStart: row.sendWindowStart });
    expect(reset.where).toEqual({ id: "vr-1", lastSentAt: claim.data.lastSentAt });
    expect(reset.data).toMatchObject({ code: sentCode(), verified: false, attempts: 0 });
    expect(reset.data.expiresAt.getTime() - claim.data.lastSentAt.getTime()).toBe(15 * 60_000);
    expect(db.create).not.toHaveBeenCalled();
    // The claim is made before NotifyNL is called, the new code stored after.
    expect(db.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      notifyMock.sendEmail.mock.invocationCallOrder[0]
    );
    expect(notifyMock.sendEmail.mock.invocationCallOrder[0]).toBeLessThan(
      db.updateMany.mock.invocationCallOrder[1]
    );
  });

  it("429s with Retry-After within the cooldown, without sending", async () => {
    db.findUnique.mockResolvedValueOnce(existing({ lastSentAt: new Date(Date.now() - 20_000) }));

    const res = await POST(makeReq(emailBody()));

    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(39);
    expect(Number(res.headers.get("Retry-After"))).toBeLessThanOrEqual(40);
    expect(await res.json()).toEqual({
      error: "Too many codes requested for this recipient. Try again later.",
    });
    expect(notifyMock.sendEmail).not.toHaveBeenCalled();
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it("429s until the hour is over once the send limit is reached", async () => {
    db.findUnique.mockResolvedValueOnce(
      existing({ sendCount: 12, sendWindowStart: minutesAgo(50) })
    );

    const res = await POST(makeReq(emailBody()));

    expect(res.status).toBe(429);
    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(9 * 60);
    expect(retryAfter).toBeLessThanOrEqual(10 * 60);
    expect(notifyMock.sendEmail).not.toHaveBeenCalled();
  });

  it("starts a new send window once the hour is over", async () => {
    db.findUnique.mockResolvedValueOnce(
      existing({ sendCount: 12, sendWindowStart: minutesAgo(61) })
    );

    const res = await POST(makeReq(emailBody()));

    expect(res.status).toBe(200);
    const claim = db.updateMany.mock.calls[0][0];
    expect(claim.data.sendCount).toBe(1);
    expect(claim.data.sendWindowStart).toEqual(claim.data.lastSentAt);
  });

  it("429s without sending when a parallel call claimed the send first", async () => {
    db.findUnique.mockResolvedValueOnce(existing());
    db.updateMany.mockResolvedValueOnce({ count: 0 });

    const res = await POST(makeReq(emailBody()));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(notifyMock.sendEmail).not.toHaveBeenCalled();
  });

  it("409s without sending when the reference belongs to another recipient", async () => {
    db.findUnique.mockResolvedValueOnce(
      existing({ reference: "ref-1", emailAddress: "someone-else@example.com" })
    );

    const res = await POST(makeReq(emailBody({ reference: "ref-1" })));

    expect(res.status).toBe(409);
    expect(notifyMock.sendEmail).not.toHaveBeenCalled();
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it("accepts a reference resend for the same recipient", async () => {
    db.findUnique.mockResolvedValueOnce(existing({ reference: "ref-1" }));

    const res = await POST(makeReq(emailBody({ reference: "ref-1" })));

    expect(res.status).toBe(200);
  });
});

describe("POST /api/verification-requests — configuration resolution", () => {
  it("falls back to NOTIFYNL_API_KEY and the channel template env vars", async () => {
    vi.stubEnv("NOTIFYNL_API_KEY", "env-key");
    vi.stubEnv("NOTIFYNL_VERIFICATION_EMAIL_TEMPLATEID", "env-email-tmpl");

    const res = await POST(makeReq({ email: "user@example.com" }));

    expect(res.status).toBe(201);
    expect(NotifyClientMock).toHaveBeenCalledWith("https://api.notifynl.nl/", "env-key");
    expect(notifyMock.sendEmail).toHaveBeenCalledWith(
      "env-email-tmpl",
      "user@example.com",
      expect.any(Object)
    );
  });

  it("prefers a body templateId over the environment variable", async () => {
    vi.stubEnv("NOTIFYNL_VERIFICATION_SMS_TEMPLATEID", "env-sms-tmpl");

    await POST(makeReq({ phoneNumber: "+31612345678", apiKey: "k", templateId: "body-tmpl" }));

    expect(notifyMock.sendSms).toHaveBeenCalledWith(
      "body-tmpl",
      "+31612345678",
      expect.any(Object)
    );
  });
});

describe("POST /api/verification-requests — failure handling", () => {
  it("removes a new request when NotifyNL refuses, and 500s with a generic message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    notifyMock.sendEmail.mockRejectedValueOnce(new Error("Notify 403"));

    const res = await POST(makeReq(emailBody()));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server error" });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ message: "Notify 403" }));
    const created = db.create.mock.calls[0][0].data;
    expect(db.deleteMany).toHaveBeenCalledWith({
      where: { id: "vr-new", lastSentAt: created.lastSentAt },
    });
  });

  it("leaves an existing request unchanged when NotifyNL refuses a resend", async () => {
    const row = existing();
    db.findUnique.mockResolvedValueOnce(row);
    notifyMock.sendEmail.mockRejectedValueOnce(new Error("Notify 403"));

    const res = await POST(makeReq(emailBody()));

    expect(res.status).toBe(500);
    // Only the claim and its undo: the stored code, attempts and expiry are untouched.
    expect(db.updateMany).toHaveBeenCalledTimes(2);
    const [claim, undo] = db.updateMany.mock.calls.map((c) => c[0]);
    expect(undo.where).toEqual({ id: "vr-1", lastSentAt: claim.data.lastSentAt });
    expect(undo.data).toEqual({
      lastSentAt: row.lastSentAt,
      sendCount: row.sendCount,
      sendWindowStart: row.sendWindowStart,
    });
  });

  it("500s with a generic message when the datastore rejects", async () => {
    db.findUnique.mockRejectedValueOnce(new Error("db"));

    const res = await POST(makeReq(emailBody()));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server error" });
  });
});
