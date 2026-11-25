import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { toNenIso8601 } from "@/lib/nen-iso-8601";
import { codesMatch, maxVerifyAttempts } from "@/lib/verification";

const prisma = new PrismaClient();

const notFound = () =>
  new Response(
    JSON.stringify({ verified: false, reason: "Request not found" }),
    { status: 404, headers: { "Content-Type": "application/json" } }
  );

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    // Expired, or out of attempts: discard it; a new code has to be requested.
    if (reserved.count === 0) {
      await prisma.verificationRequest.deleteMany({
        where: { id: verificationRequest.id },
      });
      return notFound();
    }

    if (!codesMatch(verificationRequest.code, code)) {
      return new Response(
        JSON.stringify({ verified: false, reason: "Invalid code" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ✅ Delete the verification request
    await prisma.verificationRequest.deleteMany({
      where: { id: verificationRequest.id },
    });

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
