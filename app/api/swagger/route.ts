import { NextResponse } from "next/server";

export async function GET() {
    const spec = {
        "openapi": "3.0.0",
        "info": {
            "title": "Verification Requests API",
            "description": "API to create and verify email or phone number verification requests",
            "version": "0.2.1"
        },
        "servers": [
            {
                "url": "/api"
            }
        ],
        "paths": {
            "/verification-requests": {
                "get": {
                    "summary": "Get all verification requests (for testing)",
                    "responses": {
                        "200": {
                            "description": "List of verification requests",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "array",
                                        "items": {
                                            "$ref": "#/components/schemas/VerificationRequest"
                                        }
                                    }
                                }
                            }
                        },
                        "500": {
                            "$ref": "#/components/responses/ServerError"
                        }
                    }
                },
                "post": {
                    "summary": "Create a new verification request (email or phone)",
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "email": {
                                            "type": "string",
                                            "format": "email",
                                            "description": "Email address to verify"
                                        },
                                        "phoneNumber": {
                                            "type": "string",
                                            "description": "Phone number to verify (in E.164 format, e.g. +31612345678)"
                                        },
                                        "reference": {
                                            "type": "string",
                                            "description": "Optional reference ID (unique identifier)"
                                        },
                                        "apiKey": {
                                            "type": "string",
                                            "description": "Optional NotifyNL API key. Defaults to `NOTIFYNL_API_KEY` environment variable."
                                        },
                                        "templateId": {
                                            "type": "string",
                                            "description": "Optional NotifyNL template ID (overrides environment variable for email or SMS)"
                                        }
                                    },
                                    "oneOf": [
                                        { "required": ["email"] },
                                        { "required": ["phoneNumber"] }
                                    ],
                                    "description": "Provide either `email` or `phoneNumber`, but not both."
                                }
                            }
                        }
                    },
                    "responses": {
                        "201": {
                            "description": "Verification request created",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "success": {
                                                "type": "boolean",
                                                "example": true
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "400": {
                            "description": "Missing or conflicting input",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/ErrorResponse"
                                    }
                                }
                            }
                        },
                        "500": {
                            "$ref": "#/components/responses/ServerError"
                        }
                    }
                }
            },
            "/verification-requests/verify": {
                "post": {
                    "summary": "Verify a verification request",
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "code": {
                                            "type": "string",
                                            "description": "Verification code (required)"
                                        },
                                        "reference": {
                                            "type": "string",
                                            "description": "Reference ID (optional; used first)"
                                        },
                                        "email": {
                                            "type": "string",
                                            "format": "email",
                                            "description": "Email address (optional fallback if reference not found)"
                                        },
                                        "phoneNumber": {
                                            "type": "string",
                                            "description": "Phone number (optional fallback if reference and email not found)"
                                        }
                                    },
                                    "required": ["code"],
                                    "oneOf": [
                                        { "required": ["code", "reference"] },
                                        { "required": ["code", "email"] },
                                        { "required": ["code", "phoneNumber"] }
                                    ],
                                    "description": "You must provide `code` and one of: `reference`, `email`, or `phoneNumber`."
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Verification successful",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "verified": {
                                                "type": "boolean"
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "400": {
                            "description": "Invalid code or input",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "verified": {
                                                "type": "boolean"
                                            },
                                            "reason": {
                                                "type": "string"
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "404": {
                            "description": "Verification request not found",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "verified": {
                                                "type": "boolean"
                                            },
                                            "reason": {
                                                "type": "string"
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "500": {
                            "$ref": "#/components/responses/ServerError"
                        }
                    }
                }
            }
        },
        "components": {
            "schemas": {
                "VerificationRequest": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string"
                        },
                        "createdAt": {
                            "type": "string",
                            "format": "date-time"
                        },
                        "updatedAt": {
                            "type": "string",
                            "format": "date-time"
                        },
                        "code": {
                            "type": "string"
                        },
                        "emailAddress": {
                            "type": "string",
                            "format": "email"
                        },
                        "phoneNumber": {
                            "type": "string"
                        },
                        "verified": {
                            "type": "boolean"
                        },
                        "reference": {
                            "type": "string"
                        }
                    }
                },
                "ErrorResponse": {
                    "type": "object",
                    "properties": {
                        "error": {
                            "type": "string"
                        }
                    }
                }
            },
            "responses": {
                "BadRequest": {
                    "description": "Invalid input",
                    "content": {
                        "application/json": {
                            "schema": {
                                "$ref": "#/components/schemas/ErrorResponse"
                            }
                        }
                    }
                },
                "ServerError": {
                    "description": "Server error",
                    "content": {
                        "application/json": {
                            "schema": {
                                "$ref": "#/components/schemas/ErrorResponse"
                            }
                        }
                    }
                }
            }
        }
    };

    return NextResponse.json(spec);
}
