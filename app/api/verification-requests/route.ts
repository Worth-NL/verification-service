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
            phoneNumber,
            reference,
            apiKey = process.env.NOTIFYNL_API_KEY,
        } = body;

        const emailTemplateId = process.env.NOTIFYNL_VERIFICATION_EMAIL_TEMPLATEID;
        const smsTemplateId = process.env.NOTIFYNL_VERIFICATION_SMS_TEMPLATEID;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "API Key is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Ensure only one of email or phoneNumber is provided
        if ((email && phoneNumber) || (!email && !phoneNumber)) {
            return new Response(
                JSON.stringify({ error: "Provide either email or phoneNumber, not both or neither." }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const code = String(Math.floor(Math.random() * 90000) + 10000);

        const identifier = email ?? phoneNumber;
        const usedTemplateId = email ? emailTemplateId : smsTemplateId;

        if (!usedTemplateId) {
            return new Response(
                JSON.stringify({ error: "Appropriate templateId is missing in environment variables." }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const verificationRequest = await prisma.verificationRequest.upsert({
            where: {
                reference: reference ?? identifier,
            },
            update: {
                code,
                verified: false,
            },
            create: {
                emailAddress: email ?? null,
                phoneNumber: phoneNumber ?? null,
                reference: reference ?? null,
                code,
                verified: false,
            },
        });

        const notifyClient = new NotifyClient("https://api.notifynl.nl/", apiKey);
        try {
            if (email) {
                await notifyClient.sendEmail(usedTemplateId, email, {
                    personalisation: { code },
                });
                console.log(`📧 Sent verification code ${code} to ${email}`);
            } else if (phoneNumber) {
                await notifyClient.sendSms(usedTemplateId, phoneNumber, {
                    personalisation: { code },
                });
                console.log(`📱 Sent verification code ${code} to ${phoneNumber}`);
            }
        } catch (err: unknown) {
            const error = err as Error;
            console.error("Failed to send notification:", error.message);
            throw error;
        }

        const status = verificationRequest.createdAt.getTime() === verificationRequest.updatedAt.getTime() ? 201 : 200;

        return new Response(JSON.stringify({ requestId: verificationRequest.id }), {
            status,
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