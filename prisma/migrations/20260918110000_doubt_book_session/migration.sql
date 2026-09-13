-- CreateEnum
CREATE TYPE "DoubtSlotStatus" AS ENUM ('OPEN', 'BOOKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DoubtBookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED_BY_STUDENT', 'CANCELLED_BY_TEACHER', 'COMPLETED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "doubt_slots" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "DoubtSlotStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doubt_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doubt_bookings" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "status" "DoubtBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doubt_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doubt_slots_teacherId_date_status_idx" ON "doubt_slots"("teacherId", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "doubt_slots_teacherId_startTime_key" ON "doubt_slots"("teacherId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "doubt_bookings_slotId_key" ON "doubt_bookings"("slotId");

-- CreateIndex
CREATE INDEX "doubt_bookings_studentId_idx" ON "doubt_bookings"("studentId");

-- CreateIndex
CREATE INDEX "doubt_bookings_teacherId_idx" ON "doubt_bookings"("teacherId");

-- AddForeignKey
ALTER TABLE "doubt_slots" ADD CONSTRAINT "doubt_slots_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt_bookings" ADD CONSTRAINT "doubt_bookings_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "doubt_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt_bookings" ADD CONSTRAINT "doubt_bookings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt_bookings" ADD CONSTRAINT "doubt_bookings_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
