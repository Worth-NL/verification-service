import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    verificationRequest: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(function () { return prismaMock; }),
}));

import { POST } from "../app/api/verification-requests/verify/route";

const makeReq = (body: unknown) =>
  ({ json: async () => body }) as unknown as import("next/server").NextRequest;

const record = {
  id: "rec-1",
  code: "12345",
  emailAddress: "user@example.com",
  phoneNumber: null,
  reference: "ref-1",
  attempts: 0,
  expiresAt: new Date(Date.now() + 10 * 60_000),
};

beforeEach(() => {
  prismaMock.verificationRequest.findFirst.mockReset();
  prismaMock.verificationRequest.updateMany.mockReset().mockResolvedValue({ count: 1 });
  prismaMock.verificationRequest.deleteMany.mockReset().mockResolvedValue({ count: 1 });
  vi.unstubAllEnvs();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/verification-requests/verify — input and lookup", () => {
  it("400s when code is missing", async () => {
    const res = await POST(makeReq({ reference: "ref-1" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Code is required" });
    expect(prismaMock.verificationRequest.findFirst).not.toHaveBeenCalled();
  });

  it("400s when no reference/email/phoneNumber is supplied", async () => {
    const res = await POST(makeReq({ code: "12345" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Either reference, email, or phoneNumber must be provided",
    });
  });

  it("looks up by reference first and does not fall back when found", async () => {
    prismaMock.verificationRequest.findFirst.mockResolvedValueOnce(record);

    const res = await POST(
      makeReq({ code: "12345", reference: "ref-1", email: "user@example.com" })
    );

    expect(res.status).toBe(200);
    expect(prismaMock.verificationRequest.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.verificationRequest.findFirst).toHaveBeenCalledWith({
      where: { reference: "ref-1" },
    });
    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.verifiedOn).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/
    );
  });

  it("falls back to email lookup when reference misses", async () => {
    prismaMock.verificationRequest.findFirst
      .mockResolvedValueOnce(null) // reference
      .mockResolvedValueOnce(record); // email

    const res = await POST(
      makeReq({ code: "12345", reference: "missing", email: "user@example.com" })
    );

    expect(res.status).toBe(200);
    expect(prismaMock.verificationRequest.findFirst).toHaveBeenNthCalledWith(2, {
      where: { emailAddress: "user@example.com" },
    });
  });

  it("falls back to phoneNumber lookup when reference and email are absent", async () => {
    prismaMock.verificationRequest.findFirst.mockResolvedValueOnce({
      ...record,
      phoneNumber: "+31612345678",
    });

    const res = await POST(
      makeReq({ code: "12345", phoneNumber: "+31612345678" })
    );

    expect(res.status).toBe(200);
    expect(prismaMock.verificationRequest.findFirst).toHaveBeenCalledWith({
      where: { phoneNumber: "+31612345678" },
    });
  });

  it("404s when no request matches", async () => {
    prismaMock.verificationRequest.findFirst.mockResolvedValue(null);

    const res = await POST(makeReq({ code: "12345", reference: "nope" }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      verified: false,
      reason: "Request not found",
    });
    expect(prismaMock.verificationRequest.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.verificationRequest.deleteMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/verification-requests/verify — attempts and expiry", () => {
  it("uses up an attempt only while attempts remain and the code hasn't expired", async () => {
    prismaMock.verificationRequest.findFirst.mockResolvedValueOnce(record);

    await POST(makeReq({ code: "12345", reference: "ref-1" }));

    const arg = prismaMock.verificationRequest.updateMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({ id: "rec-1", attempts: { lt: 5 } });
    expect(arg.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(arg.data).toEqual({ attempts: { increment: 1 } });
  });

  it("honours VERIFICATION_MAX_ATTEMPTS", async () => {
    vi.stubEnv("VERIFICATION_MAX_ATTEMPTS", "3");
    prismaMock.verificationRequest.findFirst.mockResolvedValueOnce(record);

    await POST(makeReq({ code: "12345", reference: "ref-1" }));

    expect(
      prismaMock.verificationRequest.updateMany.mock.calls[0][0].where.attempts
    ).toEqual({ lt: 3 });
  });

  it("falls back to 5 attempts when VERIFICATION_MAX_ATTEMPTS is invalid", async () => {
    vi.stubEnv("VERIFICATION_MAX_ATTEMPTS", "lots");
    prismaMock.verificationRequest.findFirst.mockResolvedValueOnce(record);

    await POST(makeReq({ code: "12345", reference: "ref-1" }));

    expect(
      prismaMock.verificationRequest.updateMany.mock.calls[0][0].where.attempts
    ).toEqual({ lt: 5 });
  });

  it("discards the request and 404s when it is out of attempts or expired", async () => {
    prismaMock.verificationRequest.findFirst.mockResolvedValueOnce(record);
    prismaMock.verificationRequest.updateMany.mockResolvedValueOnce({ count: 0 });

    // Even the right code is refused once the request can't be used any more.
    const res = await POST(makeReq({ code: "12345", reference: "ref-1" }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      verified: false,
      reason: "Request not found",
    });
    expect(prismaMock.verificationRequest.deleteMany).toHaveBeenCalledWith({
      where: { id: "rec-1" },
    });
  });

  it("400s and keeps the request when the code does not match", async () => {
    prismaMock.verificationRequest.findFirst.mockResolvedValueOnce({
      ...record,
      code: "99999",
    });

    const res = await POST(makeReq({ code: "12345", reference: "ref-1" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ verified: false, reason: "Invalid code" });
    expect(prismaMock.verificationRequest.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.verificationRequest.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a code that isn't a string, even if it has the same digits", async () => {
    prismaMock.verificationRequest.findFirst.mockResolvedValueOnce(record);

    const res = await POST(makeReq({ code: 12345, reference: "ref-1" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ verified: false, reason: "Invalid code" });
  });

  it("deletes the request and returns verifiedOn on success", async () => {
    prismaMock.verificationRequest.findFirst.mockResolvedValueOnce(record);

    const res = await POST(makeReq({ code: "12345", reference: "ref-1" }));

    expect(res.status).toBe(200);
    expect(prismaMock.verificationRequest.deleteMany).toHaveBeenCalledWith({
      where: { id: "rec-1" },
    });
  });

  it("500s when the datastore throws", async () => {
    prismaMock.verificationRequest.findFirst.mockRejectedValueOnce(
      new Error("db down")
    );

    const res = await POST(makeReq({ code: "12345", reference: "ref-1" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server error" });
  });
});
