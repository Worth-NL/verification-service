import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

const NotifyClient = require("notifications-node-client").NotifyClient;
const prisma = new PrismaClient();

async function sendVerificationEmail(
    email: string,
    code: string,
    templateId: string,
    apiKey: string
): Promise<void> {
    const notifyClient = new NotifyClient("https://api.notifynl.nl/", apiKey);

    try {
        await notifyClient.sendEmail(templateId, email, {
            personalisation: { code },
        });
        console.log(`📧 Sent verification code ${code} to ${email}`);
    } catch (err: unknown) {
        const error = err as Error;
        console.error("Failed to send email:", error.message);
        throw error;
    }
}

export async function GET(request: NextRequest): Promise<Response> {
    try {
        const requests = await prisma.verificationRequest.findMany();
        return new Response(JSON.stringify(requests), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err: unknown) {
        const error = err as Error;
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}

export async function POST(request: NextRequest): Promise<Response> {
    try {
        const body = await request.json();
        const {
            email,
            reference,
            templateId = process.env.NOTIFYNL_VERIFICATION_EMAIL_TEMPLATEID,
            apiKey = process.env.NOTIFYNL_API_KEY,
        } = body;

        if (!templateId) {
            return new Response(JSON.stringify({ error: "TemplateId is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Api Key is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        if (!email) {
            return new Response(JSON.stringify({ error: "Email is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const code = String(Math.floor(Math.random() * 90000) + 10000);

        const verificationRequest = await prisma.verificationRequest.upsert({
            where: {
                // `reference` must be unique in your schema for this to work
                reference: reference ?? email, // fallback to email if no reference
            },
            update: {
                code,
                verified: false,
            },
            create: {
                emailAddress: email,
                reference: reference ?? null,
                code,
                verified: false,
            },
        });

        await sendVerificationEmail(email, code, templateId, apiKey);

        // 201 if newly created, 200 if updated
        const status = verificationRequest.createdAt.getTime() === verificationRequest.updatedAt.getTime() ? 201 : 200;

        return new Response(JSON.stringify({ requestId: verificationRequest.id }), {
            status,
            headers: { "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const error = err as Error;
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
}