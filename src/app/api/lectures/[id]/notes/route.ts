import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { lectureNoteSchema } from "@/lib/validation/lecture";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * A student's own personal notes for one lecture — never shared with the
 * teacher or other students, purely a study aid attached to the lecture
 * player. One row per (student, lecture) via the LectureNote unique
 * constraint, upserted here rather than appended, since the client
 * autosaves the whole textarea rather than sending deltas.
 *
 * Same ownership rule as report-issue on this lecture: must be published,
 * and the student must be actively enrolled in a batch on the lecture's
 * course.
 */
async function resolveOwnedLecture(userId: string, lectureId: string) {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) throw new ForbiddenError();

  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    include: { chapter: { include: { subject: true } } },
  });
  if (!lecture || lecture.status !== "PUBLISHED") return null;

  const enrolled = await prisma.batchEnrollment.count({
    where: {
      studentId: student.id,
      status: "ACTIVE",
      batch: { courseId: lecture.chapter.subject.courseId },
    },
  });
  if (enrolled === 0) throw new ForbiddenError("You are not enrolled in this course.");

  return { student, lecture };
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    if (session.user.role !== "STUDENT") throw new ForbiddenError();

    const resolved = await resolveOwnedLecture(session.user.id, params.id);
    if (!resolved) return apiError("Lecture not found", 404);

    const note = await prisma.lectureNote.findUnique({
      where: { studentId_lectureId: { studentId: resolved.student.id, lectureId: params.id } },
    });

    return apiSuccess({ body: note?.body ?? "", updatedAt: note?.updatedAt ?? null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    if (session.user.role !== "STUDENT") throw new ForbiddenError();

    const input = lectureNoteSchema.parse(await request.json());

    const resolved = await resolveOwnedLecture(session.user.id, params.id);
    if (!resolved) return apiError("Lecture not found", 404);

    const note = await prisma.lectureNote.upsert({
      where: { studentId_lectureId: { studentId: resolved.student.id, lectureId: params.id } },
      create: { studentId: resolved.student.id, lectureId: params.id, body: input.body },
      update: { body: input.body },
    });

    return apiSuccess({ body: note.body, updatedAt: note.updatedAt });
  } catch (error) {
    return handleApiError(error);
  }
}
