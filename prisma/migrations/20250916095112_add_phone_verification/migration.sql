/*
  Warnings:

  - A unique constraint covering the columns `[phoneNumber]` on the table `VerificationRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."VerificationRequest" ADD COLUMN     "phoneNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "VerificationRequest_phoneNumber_key" ON "public"."VerificationRequest"("phoneNumber");
