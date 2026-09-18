import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock, notifyMock, NotifyClientMock } = vi.hoisted(() => {
  const notifyMock = { sendEmail: vi.fn(), sendSms: vi.fn() };
  return {
    notifyMock,
    NotifyClientMock: vi.fn(() => notifyMock),
    prismaMock: { verificationRequest: { upsert: vi.fn() } },
  };
});

vi.mock("@prisma/client", () => ({ PrismaClient: vi.fn(() => prismaMock) }));
vi.mock("notifications-node-client", () => ({ NotifyClient: NotifyClientMock }));

import { POST } from "../app/api/verification-requests/route";

const makeReq = (body: unknown) =>
  ({ json: async () => body }) as unknown as import("next/server").NextRequest;

/** upsert result where createdAt === updatedAt -> treated as a fresh create (201) */
const created = () => {
  const t = new Date("2026-01-01T00:00:00.000Z");
  return { id: "vr-1", createdAt: t, updatedAt: t };
};
/** upsert result where updatedAt is later -> treated as an update (200) */
const updated = () => ({
  id: "vr-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:05:00.000Z"),
});

beforeEach(() => {
  prismaMock.verificationRequest.upsert.mockReset();
  notifyMock.sendEmail.mockReset().mockResolvedValue(undefined);
  notifyMock.sendSms.mockReset().mockResolvedValue(undefined);
  NotifyClientMock.mockClear();
  vi.unstubAllEnvs();
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
    expect(prismaMock.verificationRequest.upsert).not.toHaveBeenCalled();
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

describe("POST /api/verification-requests — email happy path", () => {
  it("upserts, sends a 5-digit code by email and returns 201 for a new record", async () => {
    prismaMock.verificationRequest.upsert.mockResolvedValueOnce(created());

    const res = await POST(
      makeReq({ email: "user@example.com", apiKey: "key-1", templateId: "tmpl-email" })
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true });

    const upsertArg = prismaMock.verificationRequest.upsert.mock.calls[0][0];
    const sentCode = notifyMock.sendEmail.mock.calls[0][2].personalisation.code;
    expect(sentCode).toMatch(/^\d{5}$/);
    expect(upsertArg.create.code).toBe(sentCode);
    expect(upsertArg.update.code).toBe(sentCode);
    expect(upsertArg.create).toMatchObject({
      emailAddress: "user@example.com",
      phoneNumber: null,
      verified: false,
    });
    expect(notifyMock.sendEmail).toHaveBeenCalledWith(
      "tmpl-email",
      "user@example.com",
      { personalisation: { code: sentCode } }
    );
    expect(notifyMock.sendSms).not.toHaveBeenCalled();
  });

  it("returns 200 when the record already existed (updatedAt moved on)", async () => {
    prismaMock.verificationRequest.upsert.mockResolvedValueOnce(updated());
    const res = await POST(
      makeReq({ email: "user@example.com", apiKey: "k", templateId: "t" })
    );
    expect(res.status).toBe(200);
  });

  it("keys the upsert on reference when supplied, else on the identifier", async () => {
    prismaMock.verificationRequest.upsert.mockResolvedValue(created());

    await POST(makeReq({ email: "user@example.com", apiKey: "k", templateId: "t" }));
    expect(prismaMock.verificationRequest.upsert.mock.calls[0][0].where).toEqual({
      reference: "user@example.com",
    });

    await POST(
      makeReq({ email: "user@example.com", reference: "ref-9", apiKey: "k", templateId: "t" })
    );
    expect(prismaMock.verificationRequest.upsert.mock.calls[1][0].where).toEqual({
      reference: "ref-9",
    });
  });
});

describe("POST /api/verification-requests — phone happy path", () => {
  it("sends the code by SMS and never touches email", async () => {
    prismaMock.verificationRequest.upsert.mockResolvedValueOnce(created());

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
});

describe("POST /api/verification-requests — configuration resolution", () => {
  it("falls back to NOTIFYNL_API_KEY and the channel template env vars", async () => {
    vi.stubEnv("NOTIFYNL_API_KEY", "env-key");
    vi.stubEnv("NOTIFYNL_VERIFICATION_EMAIL_TEMPLATEID", "env-email-tmpl");
    prismaMock.verificationRequest.upsert.mockResolvedValueOnce(created());

    const res = await POST(makeReq({ email: "user@example.com" }));

    expect(res.status).toBe(201);
    expect(NotifyClientMock).toHaveBeenCalledWith(
      "https://api.notifynl.nl/",
      "env-key"
    );
    expect(notifyMock.sendEmail).toHaveBeenCalledWith(
      "env-email-tmpl",
      "user@example.com",
      expect.any(Object)
    );
  });

  it("prefers a body templateId over the environment variable", async () => {
    vi.stubEnv("NOTIFYNL_VERIFICATION_SMS_TEMPLATEID", "env-sms-tmpl");
    prismaMock.verificationRequest.upsert.mockResolvedValueOnce(created());

    await POST(
      makeReq({ phoneNumber: "+31612345678", apiKey: "k", templateId: "body-tmpl" })
    );

    expect(notifyMock.sendSms).toHaveBeenCalledWith(
      "body-tmpl",
      "+31612345678",
      expect.any(Object)
    );
  });
});

describe("POST /api/verification-requests — failure handling", () => {
  it("500s with the underlying message when NotifyNL rejects", async () => {
    prismaMock.verificationRequest.upsert.mockResolvedValueOnce(created());
    notifyMock.sendEmail.mockRejectedValueOnce(new Error("Notify 403"));

    const res = await POST(
      makeReq({ email: "user@example.com", apiKey: "k", templateId: "t" })
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Notify 403" });
  });

  it("500s when the datastore rejects", async () => {
    prismaMock.verificationRequest.upsert.mockRejectedValueOnce(new Error("db"));
    const res = await POST(
      makeReq({ email: "user@example.com", apiKey: "k", templateId: "t" })
    );
    expect(res.status).toBe(500);
  });
});
