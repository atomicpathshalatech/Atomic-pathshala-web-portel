import { NextRequest, NextResponse } from "next/server";
import { BOARDS, CLASSES, SUBJECTS_BY_CLASS, YEARS, MODES } from "@/lib/ai-chat/boardExam";
import { requireTeamSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { permissions } = await requireTeamSession();
    if (!permissions.has(PERMISSIONS.CHAPTER_READ)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Aggregate academic questions or AI questions if available in DB
    const [totalQuestions, totalAcademicClasses, totalAcademicSubjects] = await Promise.all([
      prisma.question.count().catch(() => 0),
      prisma.academicClass.count().catch(() => 0),
      prisma.academicSubject.count().catch(() => 0),
    ]);

    const data = {
      boards: BOARDS.map((b) => ({
        ...b,
        isActive: true,
        supportedClasses: ["10th", "12th"],
        totalSubjects: 6,
      })),
      classes: CLASSES,
      subjectsByClass: SUBJECTS_BY_CLASS,
      years: YEARS,
      modes: MODES,
      stats: {
        totalBoards: BOARDS.length,
        totalClasses: CLASSES.length,
        totalYearsTracked: YEARS.length,
        totalQuestionsInDb: totalQuestions,
        totalAcademicClasses,
        totalAcademicSubjects,
      },
    };

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("[Team Board Exam API]", error);
    return NextResponse.json({ error: "Failed to load board exam settings" }, { status: 500 });
  }
}
