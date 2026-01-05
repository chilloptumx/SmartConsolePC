-- Make IP range fields optional to support manual assignment mode
ALTER TABLE "location_definitions" ALTER COLUMN "startIp" DROP NOT NULL;
ALTER TABLE "location_definitions" ALTER COLUMN "endIp" DROP NOT NULL;
ALTER TABLE "location_definitions" ALTER COLUMN "startIpInt" DROP NOT NULL;
ALTER TABLE "location_definitions" ALTER COLUMN "endIpInt" DROP NOT NULL;


