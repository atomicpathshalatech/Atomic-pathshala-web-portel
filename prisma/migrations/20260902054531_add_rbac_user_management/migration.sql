-- AlterEnum
ALTER TYPE "GlobalRole" ADD VALUE 'CONTENT_CREATOR';
ALTER TYPE "GlobalRole" ADD VALUE 'SME';
ALTER TYPE "GlobalRole" ADD VALUE 'DESIGNER';
ALTER TYPE "GlobalRole" ADD VALUE 'VIDEO_EDITOR';
ALTER TYPE "GlobalRole" ADD VALUE 'ADMIN';

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "department" TEXT,
  ADD COLUMN "position" TEXT,
  ADD COLUMN "contractType" TEXT,
  ADD COLUMN "contractStart" TIMESTAMP(3),
  ADD COLUMN "contractEnd" TIMESTAMP(3),
  ADD COLUMN "contractNote" TEXT,
  ADD COLUMN "reportingManagerId" TEXT,
  ADD COLUMN "subjectScope" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "batchScope" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "user_permission_overrides" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionCode" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "reason" TEXT,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_positions" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "defaultRole" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedModule" TEXT NOT NULL,
    "requestedPermission" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_overrides_userId_permissionCode_key" ON "user_permission_overrides"("userId", "permissionCode");

-- CreateIndex
CREATE UNIQUE INDEX "department_positions_department_position_key" ON "department_positions"("department", "position");

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
