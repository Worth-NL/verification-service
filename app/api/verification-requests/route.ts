import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { NotifyClient } from "notifications-node-client";
import { codeExpiry, generateCode } from "@/lib/verification";

const prisma = new PrismaClient();
const notifyEndpoint =
  process.env.NOTIFYNL_ENDPOINT || "https://api.notifynl.nl/";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const {
      email,
      phoneNumber,
      reference,
      apiKey = process.env.NOTIFYNL_API_KEY,
      templateId, // ← client-supplied override
    } = body;

    // Validate exclusive presence
    if ((email && phoneNumber) || (!email && !phoneNumber)) {
      return new Response(
        JSON.stringify({
          error: "Provide either email or phoneNumber, not both or neither.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const code = generateCode();
    const expiresAt = codeExpiry();

    // Resolve template ID
    const usedTemplateId = email
      ? templateId ?? process.env.NOTIFYNL_VERIFICATION_EMAIL_TEMPLATEID
      : templateId ?? process.env.NOTIFYNL_VERIFICATION_SMS_TEMPLATEID;

    if (!usedTemplateId) {
      return new Response(
        JSON.stringify({
          error:
            "Appropriate templateId is missing in the request or environment variables.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Match an existing request on the field it was stored under: the
    // reference when one is given, otherwise the email address or phone number.
    const verificationRequest = await prisma.verificationRequest.upsert({
      where: reference
        ? { reference }
        : email
          ? { emailAddress: email }
          : { phoneNumber },
      update: {
        code,
        verified: false,
        attempts: 0,
        expiresAt,
      },
      create: {
        emailAddress: email ?? null,
        phoneNumber: phoneNumber ?? null,
        reference: reference ?? null,
        code,
        verified: false,
        expiresAt,
      },
    });

    const notifyClient = new NotifyClient(notifyEndpoint, apiKey);

    try {
      if (email) {
        await notifyClient.sendEmail(usedTemplateId, email, {
          personalisation: { code },
        });
      } else if (phoneNumber) {
        await notifyClient.sendSms(usedTemplateId, phoneNumber, {
          personalisation: { code },
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      throw error;
    }

    const status =
      verificationRequest.createdAt.getTime() ===
      verificationRequest.updatedAt.getTime()
        ? 201
        : 200;

    return new Response(JSON.stringify({ success: true }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
