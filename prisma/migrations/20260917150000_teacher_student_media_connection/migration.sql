-- CreateEnum
CREATE TYPE "MediaConnectionStatus" AS ENUM ('NOT_CONNECTED', 'CONNECTED', 'DISCONNECTED', 'FAILED');

-- CreateTable
CREATE TABLE "teacher_student_connections" (
    "id" TEXT NOT NULL,
    "whiteboardSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "audioStatus" "MediaConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "videoStatus" "MediaConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "requestedById" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_student_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_student_connections_whiteboardSessionId_idx" ON "teacher_student_connections"("whiteboardSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_student_connections_whiteboardSessionId_studentId_key" ON "teacher_student_connections"("whiteboardSessionId", "studentId");

-- AddForeignKey
ALTER TABLE "teacher_student_connections" ADD CONSTRAINT "teacher_student_connections_whiteboardSessionId_fkey" FOREIGN KEY ("whiteboardSessionId") REFERENCES "whiteboard_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_student_connections" ADD CONSTRAINT "teacher_student_connections_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
