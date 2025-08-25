import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { randomInt } from "crypto";

const NotifyClient = require("notifications-node-client").NotifyClient;
const prisma = new PrismaClient();

function generateVerificationCode(): string {
    return String(randomInt(10000, 99999));
}

async function sendVerificationEmail(
    email: string,
    code: string,
    templateId: string,
    apiKey: string
): Promise<void> {
    const notifyClient = new NotifyClient(apiKey, "https://api.notifynl.nl/");

    try {
        await notifyClient.sendEmail(templateId, email, {
            personalisation: { code },
        });
        console.log(`📧 Sent verification code ${code} to ${email}`);
    } catch (err: unknown) {
        const error = err as Error;
        console.error("Failed to send email:", error.message);
        throw error; // propagate to caller so POST can handle
    }
}

export async function GET(_request: NextRequest): Promise<Response> {
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
            return new Response(JSON.stringify({ error: "TemplateId is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Api Key is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

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

        await sendVerificationEmail(email, code, templateId, apiKey);

        return new Response(JSON.stringify({ requestId: verificationRequest.id }), {
            status: 201,
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