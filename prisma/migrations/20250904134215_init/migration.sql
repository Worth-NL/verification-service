-- CreateTable
CREATE TABLE "public"."VerificationRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT,
    "emailAddress" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "reference" TEXT,
    "templateId" TEXT,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationRequest_emailAddress_key" ON "public"."VerificationRequest"("emailAddress");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationRequest_reference_key" ON "public"."VerificationRequest"("reference");
