-- CreateTable
CREATE TABLE "location_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startIp" TEXT NOT NULL,
    "endIp" TEXT NOT NULL,
    "startIpInt" BIGINT NOT NULL,
    "endIpInt" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_definitions_pkey" PRIMARY KEY ("id")
);

-- Add column to machines
ALTER TABLE "machines" ADD COLUMN "locationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "location_definitions_name_key" ON "location_definitions"("name");

-- CreateIndex
CREATE INDEX "machines_locationId_idx" ON "machines"("locationId");

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;


