-- CreateTable
CREATE TABLE "public"."VerificationRequest" (
    "id" TEXT NOT NULL,
    "emailAddress" TEXT,
    "reference" TEXT,
    "code" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationRequest_reference_idx" ON "public"."VerificationRequest"("reference");

-- CreateIndex
CREATE INDEX "VerificationRequest_emailAddress_idx" ON "public"."VerificationRequest"("emailAddress");
