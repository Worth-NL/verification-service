import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

function toNenIso8601(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const offsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60));
  const offsetMins = pad(Math.abs(offsetMinutes) % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
}

const prisma = new PrismaClient();

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
      return new Response(
        JSON.stringify({ verified: false, reason: "Request not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (verificationRequest.code !== code) {
      return new Response(
        JSON.stringify({ verified: false, reason: "Invalid code" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ✅ Delete the verification request
    await prisma.verificationRequest.delete({
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
