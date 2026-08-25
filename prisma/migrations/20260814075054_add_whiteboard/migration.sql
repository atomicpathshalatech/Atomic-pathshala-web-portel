-- CreateTable
CREATE TABLE "whiteboard_boards" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "strokes" JSONB NOT NULL,
    "thumbnailDataUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whiteboard_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_whiteboard_boards" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "strokes" JSONB NOT NULL,
    "thumbnailDataUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_whiteboard_boards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whiteboard_boards_teacherId_idx" ON "whiteboard_boards"("teacherId");

-- CreateIndex
CREATE INDEX "student_whiteboard_boards_studentId_idx" ON "student_whiteboard_boards"("studentId");

-- AddForeignKey
ALTER TABLE "whiteboard_boards" ADD CONSTRAINT "whiteboard_boards_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_whiteboard_boards" ADD CONSTRAINT "student_whiteboard_boards_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
