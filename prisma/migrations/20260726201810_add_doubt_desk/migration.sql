-- CreateEnum
CREATE TYPE "DoubtStatus" AS ENUM ('OPEN', 'RESOLVED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "DoubtPriority" AS ENUM ('NORMAL', 'HIGH');

-- CreateTable
CREATE TABLE "doubts" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "priority" "DoubtPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "DoubtStatus" NOT NULL DEFAULT 'OPEN',
    "expertExplanation" TEXT,
    "videoUrl" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doubts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doubts_status_idx" ON "doubts"("status");

-- CreateIndex
CREATE INDEX "doubts_studentId_idx" ON "doubts"("studentId");

-- AddForeignKey
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
