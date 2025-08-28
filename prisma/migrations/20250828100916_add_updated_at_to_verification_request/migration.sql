/*
  Warnings:

  - A unique constraint covering the columns `[reference]` on the table `VerificationRequest` will be added. If there are existing duplicate values, this will fail.
  - Made the column `emailAddress` on table `VerificationRequest` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."VerificationRequest" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "emailAddress" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "VerificationRequest_reference_key" ON "public"."VerificationRequest"("reference");
