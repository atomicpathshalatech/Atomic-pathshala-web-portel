import "server-only";
import { prisma } from "@/lib/db";
import { getUserPermissionCodes } from "@/lib/rbac/guard";
import { PERMISSIONS, type PermissionCode } from "@/lib/rbac/permissions";

/**
 * Everything the search layer is allowed to look at for one user, resolved
 * once per request. This is the ONLY place authorisation for search is
 * decided — retrieve.ts must consult these flags, never re-check roles or
 * trust anything from the client. RBAC is enforced here on the server; the
 * UI hiding a group is not sufficient and is not relied upon.
 */
export interface SearchScope {
  userId: string;
  isTeam: boolean;
  isStudent: boolean;
  isParent: boolean;

  // People
  canReadTeachers: boolean;
  canReadStudents: boolean;
  canReadTeamMembers: boolean;

  // Academic / content
  canReadBatches: boolean;
  canReadCourses: boolean;
  canReadChapters: boolean;
  canReadLectures: boolean;
  canReadModules: boolean;
  canReadStudyMaterial: boolean;
  canReadTests: boolean;
  canReadQuestions: boolean;
  canReadClasses: boolean;

  /** Student/parent scoping — batch ids the viewer is entitled to see. Empty
   *  for team members (they are not batch-scoped; their entity permissions
   *  gate them instead). */
  batchIds: string[];
  /** Subject titles in the viewer's enrolled courses (student scoping for
   *  chapters, which are stored by title on some models). */
  subjectTitles: string[];
}

export async function resolveSearchScope(userId: string): Promise<SearchScope> {
  const [user, perms] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: { select: { name: true } },
        student: { select: { id: true } },
        teacher: { select: { id: true } },
      },
    }),
    getUserPermissionCodes(userId),
  ]);

  const roleName = user?.role?.name ?? null;
  const isStudent = roleName === "STUDENT" || Boolean(user?.student);
  const isParent = roleName === "PARENT";
  const isTeam = perms.has(PERMISSIONS.TEAM_PORTAL_ACCESS);

  let batchIds: string[] = [];
  let subjectTitles: string[] = [];

  if ((isStudent || isParent) && !isTeam) {
    if (user?.student?.id) {
      const enrollments = await prisma.batchEnrollment.findMany({
        where: { studentId: user.student.id, status: { in: ["ACTIVE", "COMPLETED"] } },
        select: { batch: { select: { id: true, courseId: true } } },
      });
      batchIds = enrollments.map((e) => e.batch.id);
      const courseIds = [
        ...new Set(enrollments.map((e) => e.batch.courseId).filter((c): c is string => Boolean(c))),
      ];
      if (courseIds.length > 0) {
        const subjects = await prisma.subject.findMany({
          where: { courseId: { in: courseIds } },
          select: { title: true },
        });
        subjectTitles = [...new Set(subjects.map((s) => s.title))];
      }
    } else if (isParent) {
      // Parent portal has no parent<->child link table; a parent sees the
      // batches of the student whose guardian contact is their phone.
      const viewer = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
      if (viewer?.phone) {
        const kids = await prisma.student.findMany({
          where: { OR: [{ userId }, { emergencyContact: viewer.phone }] },
          select: { id: true },
        });
        if (kids.length > 0) {
          const enrollments = await prisma.batchEnrollment.findMany({
            where: { studentId: { in: kids.map((k) => k.id) }, status: { in: ["ACTIVE", "COMPLETED"] } },
            select: { batchId: true },
          });
          batchIds = [...new Set(enrollments.map((e) => e.batchId))];
        }
      }
    }
  }

  const has = (p: PermissionCode) => perms.has(p);

  return {
    userId,
    isTeam,
    isStudent,
    isParent,

    // Teachers: any team member with TEACHER_READ, plus students/parents get
    // a name-only public card (searchability != data visibility — see
    // retrieve.ts, which only selects public fields for non-team viewers).
    canReadTeachers: has(PERMISSIONS.TEACHER_READ) || isStudent || isParent,
    canReadStudents: has(PERMISSIONS.STUDENT_READ_ANY),
    canReadTeamMembers: has(PERMISSIONS.USER_READ),

    canReadBatches: has(PERMISSIONS.BATCH_READ) || ((isStudent || isParent) && batchIds.length > 0),
    canReadCourses: has(PERMISSIONS.COURSE_READ),
    canReadChapters:
      has(PERMISSIONS.CHAPTER_READ) || ((isStudent || isParent) && subjectTitles.length > 0),
    canReadLectures: has(PERMISSIONS.LECTURE_READ) || isStudent,
    canReadModules: has(PERMISSIONS.MODULE_READ),
    canReadStudyMaterial: has(PERMISSIONS.STUDY_MATERIAL_MANAGE) || isStudent,
    canReadTests: has(PERMISSIONS.TEST_READ) || isStudent,
    canReadQuestions: has(PERMISSIONS.QUESTION_READ),
    canReadClasses:
      has(PERMISSIONS.BATCH_SCHEDULE_MANAGE) ||
      has(PERMISSIONS.WHITEBOARD_ACCESS) ||
      has(PERMISSIONS.TEACHER_READ) ||
      ((isStudent || isParent) && batchIds.length > 0),

    batchIds,
    subjectTitles,
  };
}
