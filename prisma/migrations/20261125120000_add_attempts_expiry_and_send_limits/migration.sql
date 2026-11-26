-- AlterTable
-- Defaults are in UTC, the way Prisma reads these columns, whatever the session time zone.
ALTER TABLE "public"."VerificationRequest" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT ((now() AT TIME ZONE 'utc') + interval '15 minutes'),
ADD COLUMN     "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
ADD COLUMN     "sendCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sendWindowStart" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc');
