import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { toNenIso8601 } from "@/lib/nen-iso-8601";
import { codesMatch, invalidInput, maxVerifyAttempts } from "@/lib/verification";

const prisma = new PrismaClient();

const notFound = () =>
  new Response(
    JSON.stringify({ verified: false, reason: "Request not found" }),
    { status: 404, headers: { "Content-Type": "application/json" } }
  );

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Request body must be valid JSON" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const inputError = invalidInput(
      body,
      ["code", "reference", "email", "phoneNumber"],
      ["reference"]
    );
    if (inputError) {
      return new Response(JSON.stringify({ error: inputError }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const { email, phoneNumber, reference, code } = body;

    if (!code) {
      return new Response(JSON.stringify({ error: "Code is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!reference && !email && !phoneNumber) {
      return new Response(
        JSON.stringify({
          error: "Either reference, email, or phoneNumber must be provided",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let verificationRequest = null;

    // Check by reference first
    if (reference) {
      verificationRequest = await prisma.verificationRequest.findFirst({
        where: { reference },
      });
    }

    // If not found by reference, check by email or phone number
    if (!verificationRequest) {
      if (email) {
        verificationRequest = await prisma.verificationRequest.findFirst({
          where: { emailAddress: email },
        });
      } else if (phoneNumber) {
        verificationRequest = await prisma.verificationRequest.findFirst({
          where: { phoneNumber },
        });
      }
    }

    if (!verificationRequest) {
      return notFound();
    }

    // Use up an attempt before comparing, in a single conditional update, so
    // concurrent requests can never check more codes than the limit allows.
    const reserved = await prisma.verificationRequest.updateMany({
      where: {
        id: verificationRequest.id,
        attempts: { lt: maxVerifyAttempts() },
        expiresAt: { gt: new Date() },
      },
      data: { attempts: { increment: 1 } },
    });

    // Expired, or out of attempts: a new code has to be requested. The request
    // itself stays (the cleanup job removes it) so its send limit keeps counting.
    if (reserved.count === 0) {
      return notFound();
    }

    if (!codesMatch(verificationRequest.code, code)) {
      return new Response(
        JSON.stringify({ verified: false, reason: "Invalid code" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // A code works once: only the call that deletes the request succeeds. The
    // code condition also refuses a code that was replaced in the meantime.
    const consumed = await prisma.verificationRequest.deleteMany({
      where: { id: verificationRequest.id, code: verificationRequest.code },
    });
    if (consumed.count !== 1) {
      return notFound();
    }

    const verifiedOn = toNenIso8601(new Date());

    return new Response(JSON.stringify({ verified: true, verifiedOn }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
