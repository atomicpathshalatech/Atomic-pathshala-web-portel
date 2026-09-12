-- CreateEnum
CREATE TYPE "StudentActivityType" AS ENUM ('SEARCH', 'BATCH_VIEW', 'PAYMENT_INTENT', 'PAYMENT_SUCCESS');

-- CreateTable
CREATE TABLE "student_activity_events" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "StudentActivityType" NOT NULL,
    "batchId" TEXT,
    "searchQuery" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_activity_events_studentId_createdAt_idx" ON "student_activity_events"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "student_activity_events" ADD CONSTRAINT "student_activity_events_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_activity_events" ADD CONSTRAINT "student_activity_events_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
