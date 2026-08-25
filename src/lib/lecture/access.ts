import "server-only";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

/**
 * Can this signed-in user manage (view/edit/publish/delete) a given Lecture?
 * Either they hold the admin-tier LECTURE_PUBLISH permission (ACADEMIC_HEAD/
 * SUPER_ADMIN etc.), or they're the Teacher who owns it — same "own content
 * only, unless admin" ownership rule as Tests (canManageTest) and the live
 * whiteboard, checked fresh against the DB every call rather than trusting
 * anything the client sent.
 */
export async function canManageLecture(userId: string, lectureTeacherId: string): Promise<boolean> {
  const isAdmin = await hasPermission(userId, PERMISSIONS.LECTURE_PUBLISH);
  if (isAdmin) return true;

  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  return teacher?.id === lectureTeacherId;
}

export async function getLectureOr404(lectureId: string) {
  return prisma.lecture.findUnique({ where: { id: lectureId } });
}

/**
 * Student-side reachability check: is this student actively enrolled in
 * ANY batch whose course matches the given courseId? Used by every page
 * along courses/[batchId]/subjects/.../chapters/.../lectures/... to make
 * sure a student can't view content for a course they aren't enrolled in
 * just by guessing an id in the URL.
 */
export async function isEnrolledInCourse(studentId: string, courseId: string): Promise<boolean> {
  const count = await prisma.batchEnrollment.count({
    where: { studentId, status: "ACTIVE", batch: { courseId } },
  });
  return count > 0;
}
