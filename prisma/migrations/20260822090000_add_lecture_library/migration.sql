-- CreateEnum
CREATE TYPE "LectureStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "lectures" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'English',
    "order" INTEGER NOT NULL DEFAULT 0,
    "videoUrl" TEXT NOT NULL,
    "educatorVideoUrl" TEXT,
    "slidesUrl" TEXT,
    "status" "LectureStatus" NOT NULL DEFAULT 'DRAFT',
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lectures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecture_issue_reports" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecture_issue_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lectures_chapterId_idx" ON "lectures"("chapterId");

-- CreateIndex
CREATE INDEX "lectures_status_idx" ON "lectures"("status");

-- CreateIndex
CREATE INDEX "lecture_issue_reports_lectureId_idx" ON "lecture_issue_reports"("lectureId");

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_issue_reports" ADD CONSTRAINT "lecture_issue_reports_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_issue_reports" ADD CONSTRAINT "lecture_issue_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
