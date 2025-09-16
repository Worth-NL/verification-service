/*
  Warnings:

  - You are about to drop the column `templateId` on the `VerificationRequest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."VerificationRequest" DROP COLUMN "templateId";
