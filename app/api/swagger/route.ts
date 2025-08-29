import { NextResponse } from "next/server";
import { createSwaggerSpec } from "next-swagger-doc";

export async function GET() {
    const spec = createSwaggerSpec({
        definition: {
            openapi: "3.0.0",
            info: {
                title: "Verification Requests API",
                description: "API to create and verify email verification requests",
                version: "0.1.4",
            },
            servers: [{ url: "/api" }],
            paths: {
                "/verification-requests": {
                    get: {
                        summary: "Get all verification requests (for testing)",
                        responses: {
                            200: {
                                description: "List of verification requests",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "array",
                                            items: {
                                                $ref: "#/components/schemas/VerificationRequest",
                                            },
                                        },
                                    },
                                },
                            },
                            500: { $ref: "#/components/responses/ServerError" },
                        },
                    },
                    post: {
                        summary: "Create a new verification request",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            email: {
                                                type: "string",
                                                format: "email",
                                                description: "Email address to verify (required)",
                                            },
                                            reference: {
                                                type: "string",
                                                description: "Optional reference ID",
                                            },
                                            templateId: {
                                                type: "string",
                                                description:
                                                    "Optional template ID for email. Defaults to `NOTIFYNL_VERIFICATION_EMAIL_TEMPLATEID` environment variable.",
                                            },
                                            apiKey: {
                                                type: "string",
                                                description:
                                                    "Optional NotifyNL API key. Defaults to `NOTIFYNL_API_KEY` environment variable.",
                                            },
                                        },
                                        required: ["email"],
                                    },
                                },
                            },
                        },
                        responses: {
                            201: {
                                description: "Verification request created",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: { requestId: { type: "string" } },
                                        },
                                    },
                                },
                            },
                            400: {
                                description:
                                    "Missing required input (email, templateId, or apiKey)",
                                content: {
                                    "application/json": {
                                        schema: { $ref: "#/components/schemas/ErrorResponse" },
                                    },
                                },
                            },
                            500: { $ref: "#/components/responses/ServerError" },
                        },
                    },
                },
                "/verification-requests/verify": {
                    post: {
                        summary: "Verify a verification request",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            code: {
                                                type: "string",
                                                description: "Verification code (required)",
                                            },
                                            reference: {
                                                type: "string",
                                                description: "Reference ID (optional, try first)",
                                            },
                                            email: {
                                                type: "string",
                                                format: "email",
                                                description:
                                                    "Email address (optional, used if reference not found)",
                                            },
                                        },
                                        required: ["code"],
                                    },
                                },
                            },
                        },
                        responses: {
                            200: {
                                description: "Verification successful",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: { verified: { type: "boolean" } },
                                        },
                                    },
                                },
                            },
                            400: {
                                description: "Invalid input or code mismatch",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                verified: { type: "boolean" },
                                                reason: { type: "string" },
                                            },
                                        },
                                    },
                                },
                            },
                            404: {
                                description: "Request not found",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                verified: { type: "boolean" },
                                                reason: { type: "string" },
                                            },
                                        },
                                    },
                                },
                            },
                            500: { $ref: "#/components/responses/ServerError" },
                        },
                    },
                },
            },
            components: {
                schemas: {
                    VerificationRequest: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            createdAt: { type: "string", format: "date-time" },
                            updatedAt: { type: "string", format: "date-time" },
                            code: { type: "string" },
                            emailAddress: { type: "string", format: "email" },
                            verified: { type: "boolean" },
                            reference: { type: "string" },
                        },
                    },
                    ErrorResponse: {
                        type: "object",
                        properties: { error: { type: "string" } },
                    },
                },
                responses: {
                    BadRequest: {
                        description: "Invalid input",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                    ServerError: {
                        description: "Server error",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                },
            },
        },
    });

    return NextResponse.json(spec);
}
