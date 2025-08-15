const swaggerDocument = {
  "openapi": "3.0.0",
  "info": {
    "title": "Email Verification Request API",
    "version": "1.1.0",
    "description": "API for managing email verification requests, including email validation."
  },
  "servers": [
    {
      "url": "http://localhost:5001/api"
    }
  ],
  "tags": [
    {
      "name": "Verification",
      "description": "Endpoints related to email verification"
    }
  ],
  "paths": {
    "/email-verification-requests": {
      "get": {
        "tags": [
          "Verification"
        ],
        "summary": "Get all email verification requests",
        "responses": {
          "200": {
            "description": "A list of email verification requests",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/EmailVerificationRequest"
                  }
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "Verification"
        ],
        "summary": "Create a new email verification request",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/EmailVerificationRequestInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Created successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/EmailVerificationRequest"
                }
              }
            }
          }
        }
      }
    },
    "/email-verification-requests/{id}": {
      "get": {
        "tags": [
          "Verification"
        ],
        "summary": "Get a specific email verification request by ID",
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "schema": {
              "type": "integer"
            },
            "required": true,
            "description": "ID of the email verification request"
          }
        ],
        "responses": {
          "200": {
            "description": "A single email verification request",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/EmailVerificationRequest"
                }
              }
            }
          },
          "404": {
            "description": "Not found"
          }
        }
      },
      "put": {
        "tags": [
          "Verification"
        ],
        "summary": "Update a specific email verification request by ID",
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "schema": {
              "type": "integer"
            },
            "required": true
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/EmailVerificationRequestInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Updated successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/EmailVerificationRequest"
                }
              }
            }
          },
          "404": {
            "description": "Not found"
          }
        }
      },
      "delete": {
        "tags": [
          "Verification"
        ],
        "summary": "Delete a specific email verification request by ID",
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "schema": {
              "type": "integer"
            },
            "required": true
          }
        ],
        "responses": {
          "204": {
            "description": "Deleted successfully"
          },
          "404": {
            "description": "Not found"
          }
        }
      }
    },
    "/email-verification-requests/validate": {
      "put": {
        "tags": [
          "Verification"
        ],
        "summary": "Validate an email verification request",
        "description": "Matches the provided verification code with the stored code for the email. If matched, marks the request as verified.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "email",
                  "verificationCode"
                ],
                "properties": {
                  "email": {
                    "type": "string",
                    "format": "email",
                    "example": "user@example.com"
                  },
                  "verificationCode": {
                    "type": "string",
                    "example": "123456"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Email verified successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/EmailVerificationRequest"
                }
              }
            }
          },
          "400": {
            "description": "Invalid verification code"
          },
          "404": {
            "description": "Email verification request not found"
          },
          "500": {
            "description": "Internal server error"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "EmailVerificationRequest": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "example": 1
          },
          "email": {
            "type": "string",
            "format": "email",
            "example": "user@example.com"
          },
          "origin": {
            "type": "string",
            "example": "web"
          },
          "sessionHash": {
            "type": "string",
            "example": "abc123hash"
          },
          "verificationCode": {
            "type": "string",
            "example": "654321"
          },
          "isVerified": {
            "type": "boolean",
            "example": false
          },
          "createdOn": {
            "type": "string",
            "format": "date-time",
            "example": "2025-08-15T14:48:00.000Z"
          }
        }
      },
      "EmailVerificationRequestInput": {
        "type": "object",
        "required": [
          "email"
        ],
        "properties": {
          "email": {
            "type": "string",
            "format": "email",
            "example": "user@example.com"
          },
          "origin": {
            "type": "string",
            "example": "web"
          },
          "sessionHash": {
            "type": "string",
            "example": "abc123hash"
          },
          "verificationCode": {
            "type": "string",
            "example": "123456"
          },
          "isVerified": {
            "type": "boolean",
            "example": false
          }
        }
      }
    }
  }
}

export default swaggerDocument;