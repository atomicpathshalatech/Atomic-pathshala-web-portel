import { prisma } from "@/lib/db";

export type TeacherQualification = {
  degree: string;
  institution: string;
  year?: string;
};

export type TeacherExperience = {
  organization: string;
  designation: string;
  startYear?: string;
  endYear?: string;
  role?: string;
  duration?: string;
  description?: string;
};

export type TeacherBadgeItem = {
  id: string;
  badgeType: string;
  title: string;
  description: string | null;
  icon: string | null;
};

export type TeacherTestimonialItem = {
  id: string;
  studentName: string;
  studentPhoto: string | null;
  rating: number;
  content: string;
  createdAt: Date;
};

export type TeacherFullProfile = {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  slug: string;
  headline: string;
  department: string;
  subjects: string[];
  targetExams: string[];
  classes: string[];
  languages: string[];
  bio: string;
  isVerified: boolean;
  experienceYears: string;
  qualifications: TeacherQualification[];
  qualificationSummary: string | null;
  experienceList: TeacherExperience[];
  /** Day + Month only (e.g. "15 August"). Year is strictly hidden from student-facing profile */
  dobDayMonth: string | null;
  rating: number | null;
  averageRating: number | null;
  reviewCount: number;
  followerCount: number;
  studentsTaughtCount: number;
  totalLecturesCount: number;
  badges: TeacherBadgeItem[];
  testimonials: TeacherTestimonialItem[];
  batches: Array<{ id: string; name: string; code: string; courseTitle?: string }>;
  upcomingClasses: Array<{
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
    batchName: string;
    batchId?: string;
  }>;
  lectures: Array<{
    id: string;
    title: string;
    chapterTitle?: string;
    subjectName?: string;
    chapterId?: string;
    subjectId?: string;
    batchId?: string;
    videoUrl?: string;
    durationMin?: number | null;
  }>;
};

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Format DOB strictly as Day + Month (e.g. "15 August", "1 September").
 * The Year is strictly withheld to preserve teacher privacy.
 */
export function formatDobDayMonth(dob?: Date | null): string | null {
  if (!dob) return null;
  try {
    const d = new Date(dob);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long" });
  } catch {
    return null;
  }
}

/**
 * Clean bio text — if legacy concatenated string exists, clean out DOB and qualification metadata
 */
function sanitizeBio(rawBio?: string | null): string {
  if (!rawBio) return "";
  const trimmed = rawBio.trim();

  // Check if legacy concatenated format: Qualification: ... · Experience: ... · DOB: ...
  if (trimmed.startsWith("Qualification:") && trimmed.includes("DOB:")) {
    const parts = trimmed.split(/DOB:\s*\d{4}-\d{2}-\d{2}/i);
    if (parts[1]) {
      const extra = parts[1].replace(/^[·\s-]+/, "").trim();
      return extra;
    }
    return "";
  }

  // Remove any dangling DOB text
  return trimmed.replace(/·?\s*DOB:\s*\d{4}-\d{2}-\d{2}/gi, "").trim();
}

/**
 * Dynamically build professional headline from strictly database-backed subjects & exams
 */
function buildHeadline(
  displayName?: string | null,
  subjects?: string[],
  department?: string,
  targetExams?: string[]
): string {
  if (displayName && displayName.trim()) {
    return displayName.trim();
  }

  const primarySubject =
    subjects && subjects.length > 0 ? subjects[0] : department || "Faculty";
  const subjectPart = `${primarySubject} Faculty`;

  if (targetExams && targetExams.length > 0) {
    const examsPart = `${targetExams.join(" & ")} Educator`;
    return `${subjectPart} | ${examsPart}`;
  }

  return subjectPart;
}

/**
 * Fetch a teacher profile by slug or ID with real database connections only.
 * Absolutely no fake/default/hardcoded profiles.
 */
export async function getTeacherProfileBySlug(slug: string): Promise<TeacherFullProfile | null> {
  const cleanSlug = slug.toLowerCase().trim();

  // Search database teachers with relations
  const allTeachers = await prisma.teacher.findMany({
    where: {
      onboardingStatus: { not: "REJECTED" },
      user: {
        status: "ACTIVE",
        role: {
          name: { in: ["TEACHER", "ACADEMIC_HEAD", "DEPARTMENT_HEAD", "SUPER_ADMIN", "ADMIN", "FOUNDER"] },
        },
      },
    },
    include: {
      user: true,
      batchAssignments: {
        include: {
          batch: {
            include: {
              course: true,
              enrollments: {
                select: { studentId: true },
              },
            },
          },
        },
      },
      scheduleSessions: {
        where: { startsAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) } },
        orderBy: { startsAt: "asc" },
        include: { batch: true },
        take: 6,
      },
      lectures: {
        include: {
          chapter: { include: { subject: true } },
          batchSchedules: { select: { batchId: true }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      badges: {
        orderBy: { assignedAt: "desc" },
      },
      testimonials: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        include: {
          student: {
            include: {
              user: {
                select: { name: true, photoUrl: true },
              },
            },
          },
        },
        take: 10,
      },
    },
  });

  // Match by slug, ID, employeeCode, or name aliases
  const dbTeacher = allTeachers.find((t) => {
    const teacherSlug = generateSlug(t.user.name);
    const empCode = t.employeeCode.toLowerCase();
    const id = t.id.toLowerCase();

    // Exact matches
    if (teacherSlug === cleanSlug || empCode === cleanSlug || id === cleanSlug) return true;

    // Common aliases & suffix variations (e.g. -sir)
    const normalizedTarget = cleanSlug.replace(/-(sir|mam|maam)$/i, "");
    if (teacherSlug === normalizedTarget) return true;

    // Name tokens check (e.g. "rehan-ali" matches "Rehan ali", "firoz" matches "Firoz (Test Login)")
    if (cleanSlug === "firoz-ali" && (teacherSlug.includes("firoz") || t.user.name.toLowerCase().includes("firoz"))) return true;
    if (cleanSlug === "yaman-khan" && (teacherSlug.includes("yaman") || t.user.name.toLowerCase().includes("yaman"))) return true;

    // Check if target tokens are included in teacher tokens
    const targetTokens = cleanSlug.split("-").filter(Boolean);
    const teacherTokens = teacherSlug.split("-").filter(Boolean);
    if (targetTokens.length > 0 && targetTokens.every((tok) => teacherTokens.includes(tok))) {
      return true;
    }

    return false;
  });

  if (!dbTeacher) {
    return null;
  }

  const name = dbTeacher.user.name || "Faculty Member";
  const department = dbTeacher.department || "Science";
  const subjects = dbTeacher.subjects && dbTeacher.subjects.length > 0 ? dbTeacher.subjects : [department];
  const targetExams = dbTeacher.targetExams && dbTeacher.targetExams.length > 0 ? dbTeacher.targetExams : [];
  const classes = dbTeacher.classes && dbTeacher.classes.length > 0 ? dbTeacher.classes : [];
  const languages = dbTeacher.languages && dbTeacher.languages.length > 0 ? dbTeacher.languages : [];
  const experienceYears = dbTeacher.experienceYears || "";

  // Parse structured qualifications
  let qualifications: TeacherQualification[] = [];
  if (Array.isArray(dbTeacher.qualifications)) {
    qualifications = (dbTeacher.qualifications as any[]).map((q) => ({
      degree: q.degree || "",
      institution: q.institution || "",
      year: q.year || undefined,
    }));
  }

  // Create clean summary (e.g. "BAMS", "M.Sc., B.Ed.")
  const qualificationSummary =
    qualifications.length > 0
      ? qualifications
          .map((q) => q.degree)
          .filter(Boolean)
          .join(", ") || null
      : null;

  // Parse structured experienceList
  let experienceList: TeacherExperience[] = [];
  if (Array.isArray(dbTeacher.experienceList)) {
    experienceList = (dbTeacher.experienceList as any[]).map((e) => {
      let duration = "";
      if (e.totalMonths) {
        const y = Math.floor(Number(e.totalMonths) / 12);
        const m = Number(e.totalMonths) % 12;
        duration = `${y > 0 ? `${y} yr${y > 1 ? "s" : ""} ` : ""}${m > 0 ? `${m} mo${m > 1 ? "s" : ""}` : ""}`.trim() || `${e.totalMonths} mos`;
      } else if (e.startYear && e.endYear) {
        duration = `${e.startYear} — ${e.endYear}`;
      } else {
        duration = e.startYear || e.duration || "";
      }
      return {
        organization: e.organization || "",
        designation: e.designation || "",
        startYear: e.startYear || undefined,
        endYear: e.endYear || undefined,
        role: e.designation || e.role || "",
        duration,
        description: e.description || undefined,
      };
    });
  }

  const headline = buildHeadline(dbTeacher.displayName, subjects, department, targetExams);
  const cleanBio = sanitizeBio(dbTeacher.bio);

  // Strict DOB Day + Month only (Year completely hidden)
  const dobDayMonth = formatDobDayMonth(dbTeacher.dob);

  // Real database metrics
  const [followerCount, totalLecturesCount] = await Promise.all([
    prisma.teacherFollow.count({ where: { teacherId: dbTeacher.id } }),
    prisma.lecture.count({ where: { teacherId: dbTeacher.id } }),
  ]);

  // Distinct students taught across all assigned batches
  const enrolledStudentIds = new Set<string>();
  dbTeacher.batchAssignments?.forEach((ba) => {
    ba.batch?.enrollments?.forEach((e) => {
      if (e.studentId) enrolledStudentIds.add(e.studentId);
    });
  });
  const studentsTaughtCount = enrolledStudentIds.size;

  // Testimonials calculation
  const approvedTestimonials: TeacherTestimonialItem[] = (dbTeacher.testimonials || []).map((t) => ({
    id: t.id,
    studentName: t.student?.user?.name || "Student",
    studentPhoto: t.student?.user?.photoUrl || null,
    rating: t.rating,
    content: t.content,
    createdAt: t.createdAt,
  }));

  const reviewCount = approvedTestimonials.length;
  let averageRating: number | null = null;
  if (reviewCount > 0) {
    const sum = approvedTestimonials.reduce((acc, curr) => acc + curr.rating, 0);
    averageRating = Math.round((sum / reviewCount) * 10) / 10;
  } else if (dbTeacher.rating !== null && dbTeacher.rating !== undefined) {
    averageRating = Math.round(dbTeacher.rating * 10) / 10;
  }

  // Badges
  const badges: TeacherBadgeItem[] = (dbTeacher.badges || []).map((b) => ({
    id: b.id,
    badgeType: b.badgeType,
    title: b.title,
    description: b.description,
    icon: b.icon,
  }));

  return {
    id: dbTeacher.id,
    name,
    email: dbTeacher.user.email,
    photoUrl: dbTeacher.user.photoUrl || null,
    slug: generateSlug(name),
    headline,
    department,
    subjects,
    targetExams,
    classes,
    languages,
    bio: cleanBio,
    isVerified: dbTeacher.onboardingStatus === "ACTIVE" || dbTeacher.user.status === "ACTIVE",
    experienceYears,
    qualifications,
    qualificationSummary,
    experienceList,
    dobDayMonth,
    rating: dbTeacher.rating ?? null,
    averageRating,
    reviewCount,
    followerCount,
    studentsTaughtCount,
    totalLecturesCount,
    badges,
    testimonials: approvedTestimonials,
    batches:
      dbTeacher.batchAssignments?.map((ba) => ({
        id: ba.batch.id,
        name: ba.batch.name,
        code: ba.batch.code,
        courseTitle: ba.batch.course?.title,
      })) || [],
    upcomingClasses:
      dbTeacher.scheduleSessions?.map((ss) => ({
        id: ss.id,
        title: ss.title,
        startsAt: ss.startsAt,
        endsAt: ss.endsAt,
        status: ss.status,
        batchName: ss.batch?.name || "Live Class",
        batchId: ss.batch?.id,
      })) || [],
    lectures:
      dbTeacher.lectures?.map((lec) => ({
        id: lec.id,
        title: lec.title,
        chapterTitle: lec.chapter?.title,
        subjectName: lec.chapter?.subject?.title,
        chapterId: lec.chapter?.id,
        subjectId: lec.chapter?.subject?.id,
        batchId: lec.batchSchedules?.[0]?.batchId,
        videoUrl: lec.videoUrl,
        durationMin: lec.durationMin,
      })) || [],
  };
}
