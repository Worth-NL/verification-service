import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, reference, code } = body;

        if (!code) {
            return new Response(
                JSON.stringify({ error: "Code is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        if (!reference && !email) {
            return new Response(
                JSON.stringify({ error: "Either reference or email must be provided" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        let verificationRequest = null;

        if (reference) {
            verificationRequest = await prisma.verificationRequest.findFirst({
                where: { reference },
            });
        }

        // If not found by reference and email is provided, try email
        if (!verificationRequest && email) {
            verificationRequest = await prisma.verificationRequest.findFirst({
                where: { emailAddress: email },
            });
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

        await prisma.verificationRequest.update({
            where: { id: verificationRequest.id },
            data: { verified: true },
        });

        return new Response(JSON.stringify({ verified: true }), {
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
