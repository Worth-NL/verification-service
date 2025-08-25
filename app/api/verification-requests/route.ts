import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { randomInt } from "crypto";

const prisma = new PrismaClient();
const NotifyClient = require("notifications-node-client").NotifyClient;

function generateVerificationCode(): string {
    return String(randomInt(10000, 99999));
}

async function sendVerificationEmail(email: string, code: string, templateId: string, apiKey: string) {
    let notifyClient = new NotifyClient("https://api.notifyNL.nl", apiKey);

    try {
        notifyClient
            .sendEmail(templateId, email, { personalisation: { code: code } }) // Pass options as the third argument (optional)
            .then((response: any) => console.log(response))
            .catch((err: any) => console.error(err));
    }
    catch (err) {
        console.error(err);

        if (err instanceof Error) {
            console.error(err);
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    }
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
        const {
            email,
            reference,
            templateId = process.env.NOTIFUNL_VERIFICATION_EMAIL_TEMPLATEID,
            apiKey = process.env.NOTIFYNL_API_KEY
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
    } catch (err) {
        console.error(err);

        if (err instanceof Error) {
            console.error(err);
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    }
}
