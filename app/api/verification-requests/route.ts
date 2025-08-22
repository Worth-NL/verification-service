import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { randomInt } from "crypto";

const prisma = new PrismaClient();

function generateVerificationCode(): string {
    return String(randomInt(100000, 999999));
}

async function sendVerificationEmail(email: string, code: string, templateId: string) {
    // Replace with your email sending service
    console.log(`📧 Sending code ${code} to ${email}`);
}

export async function GET(request: NextRequest) {
    const requests = await prisma.verificationRequest.findMany();

    return new Response(JSON.stringify(requests), {
        headers: { "Content-Type": "application/json" },
    });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, reference, templateId } = body;

        if (!email) {
            return new Response(JSON.stringify({ error: "Email is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const code = generateVerificationCode();

        const verificationRequest = await prisma.verificationRequest.create({
            data: {
                emailAddress: email,
                reference: reference ?? null,
                code,
                verified: false,
            },
        });

        await sendVerificationEmail(email, code, templateId);

        return new Response(JSON.stringify({ requestId: verificationRequest.id }), {
            status: 201,
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
