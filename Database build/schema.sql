-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('ONLINE', 'OFFLINE', 'WARNING', 'ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('PING', 'REGISTRY_CHECK', 'FILE_CHECK', 'SERVICE_CHECK', 'USER_INFO', 'SYSTEM_INFO', 'BASELINE_CHECK', 'FULL_CHECK');

-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('SUCCESS', 'FAILED', 'WARNING', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "AuditLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "pcModel" TEXT,
    "locationId" TEXT,
    "status" "MachineStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startIp" TEXT,
    "endIp" TEXT,
    "startIpInt" BIGINT,
    "endIpInt" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_checks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registryPath" TEXT NOT NULL,
    "valueName" TEXT,
    "expectedValue" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registry_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_checks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "checkExists" BOOLEAN NOT NULL DEFAULT true,
    "checkSize" BOOLEAN NOT NULL DEFAULT false,
    "checkCreated" BOOLEAN NOT NULL DEFAULT false,
    "checkModified" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_checks_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "user_checks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "checkType" TEXT NOT NULL DEFAULT 'CURRENT_AND_LAST',
    "customScript" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_checks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "checkType" TEXT NOT NULL DEFAULT 'SYSTEM_INFO',
    "customScript" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "targetAll" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_machines" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,

    CONSTRAINT "job_machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_results" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "checkType" "JobType" NOT NULL,
    "checkName" TEXT NOT NULL,
    "status" "CheckStatus" NOT NULL,
    "resultData" JSONB NOT NULL,
    "message" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "level" "AuditLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "machineId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_reports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recipients" TEXT[],
    "schedule" TEXT NOT NULL,
    "filterConfig" JSONB NOT NULL,
    "columns" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "machines_hostname_key" ON "machines"("hostname");

-- CreateIndex
CREATE INDEX "machines_locationId_idx" ON "machines"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "location_definitions_name_key" ON "location_definitions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "job_machines_jobId_machineId_key" ON "job_machines"("jobId", "machineId");

-- CreateIndex
CREATE INDEX "check_results_machineId_createdAt_idx" ON "check_results"("machineId", "createdAt");

-- CreateIndex
CREATE INDEX "check_results_checkType_createdAt_idx" ON "check_results"("checkType", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");

-- CreateIndex
CREATE INDEX "audit_events_eventType_createdAt_idx" ON "audit_events"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_machineId_createdAt_idx" ON "audit_events"("machineId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_machines" ADD CONSTRAINT "job_machines_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "scheduled_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_machines" ADD CONSTRAINT "job_machines_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_results" ADD CONSTRAINT "check_results_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

