-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'BASELINE_CHECK';

-- AlterTable
ALTER TABLE "audit_events" ALTER COLUMN "metadata" DROP DEFAULT;
