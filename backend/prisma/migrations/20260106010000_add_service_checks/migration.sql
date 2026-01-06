-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'SERVICE_CHECK';

-- CreateTable
CREATE TABLE "service_checks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceName" TEXT,
    "executablePath" TEXT,
    "expectedStatus" TEXT NOT NULL DEFAULT 'Running',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_checks_pkey" PRIMARY KEY ("id")
);


