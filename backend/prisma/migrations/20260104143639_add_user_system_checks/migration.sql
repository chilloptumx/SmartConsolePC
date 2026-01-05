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

