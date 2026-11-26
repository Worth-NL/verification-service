import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { NotifyClient } from "notifications-node-client";
import {
  codeExpiry,
  generateCode,
  invalidInput,
  nextSend,
  resendCooldownSeconds,
} from "@/lib/verification";

const prisma = new PrismaClient();
const notifyEndpoint =
  process.env.NOTIFYNL_ENDPOINT || "https://api.notifynl.nl/";

const json = (body: unknown, init: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });

const conflict = () =>
  json(
    { error: "This request conflicts with an existing verification request." },
    { status: 409 }
  );

const tooManyRequests = (retryAfter: number) =>
  json(
    { error: "Too many codes requested for this recipient. Try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    const inputError = invalidInput(
      body,
      ["email", "phoneNumber", "reference", "apiKey", "templateId"],
      ["reference"]
    );
    if (inputError) {
      return json({ error: inputError }, { status: 400 });
    }
    const {
      email,
      phoneNumber,
      apiKey = process.env.NOTIFYNL_API_KEY,
      templateId, // ← client-supplied override
    } = body;
    // An empty reference means no reference.
    const reference = body.reference === "" ? undefined : body.reference;

    // Validate exclusive presence
    if ((email && phoneNumber) || (!email && !phoneNumber)) {
      return json(
        { error: "Provide either email or phoneNumber, not both or neither." },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return json({ error: "API Key is required" }, { status: 400 });
    }

    // Resolve template ID
    const usedTemplateId = email
      ? templateId ?? process.env.NOTIFYNL_VERIFICATION_EMAIL_TEMPLATEID
      : templateId ?? process.env.NOTIFYNL_VERIFICATION_SMS_TEMPLATEID;

    if (!usedTemplateId) {
      return json(
        {
          error:
            "Appropriate templateId is missing in the request or environment variables.",
        },
        { status: 400 }
      );
    }

    // Match an existing request on the field it was stored under: the
    // reference when one is given, otherwise the email address or phone number.
    const existing = await prisma.verificationRequest.findUnique({
      where: reference
        ? { reference }
        : email
          ? { emailAddress: email }
          : { phoneNumber },
    });

    // A reference stays tied to the recipient it was created for.
    if (
      existing &&
      ((existing.emailAddress ?? null) !== (email ?? null) ||
        (existing.phoneNumber ?? null) !== (phoneNumber ?? null))
    ) {
      return conflict();
    }

    const code = generateCode();
    const now = new Date();
    const expiresAt = codeExpiry(now);

    // Claim the send before calling NotifyNL, so parallel calls can't all send,
    // and undo the claim if NotifyNL refuses (e.g. an invalid API key), so a
    // failed call changes nothing.
    let undoClaim: () => Promise<unknown>;
    if (existing) {
      const send = nextSend(existing, now);
      if (!send.ok) return tooManyRequests(send.retryAfter);

      const claimed = await prisma.verificationRequest.updateMany({
        where: {
          id: existing.id,
          lastSentAt: existing.lastSentAt,
          sendCount: existing.sendCount,
        },
        data: send.next,
      });
      // Another call for this recipient got there first.
      if (claimed.count === 0) return tooManyRequests(resendCooldownSeconds());

      undoClaim = () =>
        prisma.verificationRequest.updateMany({
          where: { id: existing.id, lastSentAt: now },
          data: {
            lastSentAt: existing.lastSentAt,
            sendCount: existing.sendCount,
            sendWindowStart: existing.sendWindowStart,
          },
        });
    } else {
      let created;
      try {
        created = await prisma.verificationRequest.create({
          data: {
            emailAddress: email ?? null,
            phoneNumber: phoneNumber ?? null,
            reference: reference ?? null,
            code,
            verified: false,
            expiresAt,
            lastSentAt: now,
            sendCount: 1,
            sendWindowStart: now,
          },
        });
      } catch (err) {
        // The recipient or reference is already in use by another request.
        if (isUniqueViolation(err)) return conflict();
        throw err;
      }
      undoClaim = () =>
        prisma.verificationRequest.deleteMany({
          where: { id: created.id, lastSentAt: now },
        });
    }

    const notifyClient = new NotifyClient(notifyEndpoint, apiKey);
    try {
      if (email) {
        await notifyClient.sendEmail(usedTemplateId, email, {
          personalisation: { code },
        });
      } else {
        await notifyClient.sendSms(usedTemplateId, phoneNumber, {
          personalisation: { code },
        });
      }
    } catch (err) {
      await undoClaim().catch((undoErr) => console.error(undoErr));
      throw err;
    }

    // The new code replaces the old one only once it has been sent.
    if (existing) {
      await prisma.verificationRequest.updateMany({
        where: { id: existing.id, lastSentAt: now },
        data: { code, verified: false, attempts: 0, expiresAt },
      });
    }

    return json({ success: true }, { status: existing ? 200 : 201 });
  } catch (err: unknown) {
    console.error(err);
    return json({ error: "Server error" }, { status: 500 });
  }
}
