-- AlterTable
ALTER TABLE "public"."VerificationRequest" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (now() + '00:15:00'::interval);
