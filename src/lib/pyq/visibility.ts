import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Authoritative PYQ Verification & Student Visibility Layer.
 *
 * CORE INVARIANT:
 * ONLY PYQs with exact status "VERIFIED" (and published) are eligible for
 * student, public, search, practice, mobile/PWA, or SEO visibility.
 *
 * Any question that is UNVERIFIED, ASSIGNED, IN_REVIEW, NEEDS_CORRECTION,
 * REJECTED, DRAFT, or null MUST NEVER be exposed to students or public users.
 */

export const VERIFIED_PYQ_STATUS = "VERIFIED" as const;

/**
 * Canonical Prisma filter for Question queries exposed to students or public users.
 */
export const VERIFIED_PYQ_QUESTION_WHERE: Prisma.QuestionWhereInput = {
  pyqVerificationStatus: VERIFIED_PYQ_STATUS,
  isPublished: true,
  pyqOccurrences: {
    some: {
      verificationStatus: VERIFIED_PYQ_STATUS,
    },
  },
};

/**
 * Canonical Prisma filter for PyqOccurrence queries exposed to students or public users.
 */
export const VERIFIED_PYQ_OCCURRENCE_WHERE: Prisma.PyqOccurrenceWhereInput = {
  verificationStatus: VERIFIED_PYQ_STATUS,
  question: {
    pyqVerificationStatus: VERIFIED_PYQ_STATUS,
    isPublished: true,
  },
};

/**
 * Runtime predicate checking whether a Question record is strictly eligible
 * for student or public visibility.
 */
export function isQuestionStudentVisible(q: {
  pyqVerificationStatus?: string | null;
  isPublished?: boolean | null;
  status?: string | null;
  pyqOccurrences?: Array<{ verificationStatus?: string | null }> | null;
}): boolean {
  if (!q) return false;
  if (q.pyqVerificationStatus !== VERIFIED_PYQ_STATUS) return false;
  if (q.isPublished !== true) return false;
  if (Array.isArray(q.pyqOccurrences)) {
    return q.pyqOccurrences.some((o) => o.verificationStatus === VERIFIED_PYQ_STATUS);
  }
  return true;
}

export interface StudentPyqFilterOptions {
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  examSlug?: string | null;
  examId?: string | null;
  year?: number | null;
  lang?: "ALL" | "HINDI" | "ENGLISH" | string;
  page?: number;
  pageSize?: number;
  includeSolution?: boolean;
}

function buildOccurrenceWhere(opts: StudentPyqFilterOptions): Prisma.PyqOccurrenceWhereInput {
  const occ: Prisma.PyqOccurrenceWhereInput = {
    verificationStatus: VERIFIED_PYQ_STATUS,
  };
  if (opts.year) occ.year = opts.year;
  if (opts.examId) occ.examId = opts.examId;
  if (opts.examSlug) {
    occ.exam = {
      OR: [
        { slug: opts.examSlug },
        { canonicalType: opts.examSlug.toUpperCase().replace(/-/g, "_") },
      ],
    };
  }
  return occ;
}

function buildVerifiedQuestionWhere(
  opts: StudentPyqFilterOptions,
  searchQuery?: string | null
): Prisma.QuestionWhereInput {
  const andClauses: Prisma.QuestionWhereInput[] = [
    { pyqVerificationStatus: VERIFIED_PYQ_STATUS },
    { isPublished: true },
    { pyqOccurrences: { some: buildOccurrenceWhere(opts) } },
  ];

  if (opts.subject) {
    andClauses.push({ subject: { equals: opts.subject, mode: "insensitive" } });
  }
  if (opts.chapter) {
    andClauses.push({ chapter: { contains: opts.chapter, mode: "insensitive" } });
  }
  if (opts.topic) {
    andClauses.push({ topic: { contains: opts.topic, mode: "insensitive" } });
  }

  const lang = opts.lang?.trim().toUpperCase();
  if (lang === "HINDI") {
    andClauses.push({
      translations: {
        some: {
          OR: [{ language: "HINDI" }, { statement: { contains: "क", mode: "insensitive" } }],
        },
      },
    });
  } else if (lang === "ENGLISH") {
    andClauses.push({
      translations: { some: { language: "ENGLISH" } },
    });
  }

  const q = searchQuery?.trim();
  if (q) {
    andClauses.push({
      OR: [
        { questionCode: { contains: q, mode: "insensitive" } },
        { topic: { contains: q, mode: "insensitive" } },
        { chapter: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { tags: { contains: q, mode: "insensitive" } },
        {
          translations: {
            some: {
              statement: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  return { AND: andClauses };
}

/**
 * Retrieve strictly VERIFIED PYQs for student portal interfaces.
 */
export async function getStudentVisiblePYQs(opts: StudentPyqFilterOptions = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));
  const where = buildVerifiedQuestionWhere(opts);
  const includeSol = Boolean(opts.includeSolution);

  const [total, items] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      orderBy: [{ pyqYear: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        questionCode: true,
        type: true,
        difficulty: true,
        subject: true,
        chapter: true,
        topic: true,
        imageUrl: true,
        pyqExam: true,
        pyqYear: true,
        pyqMonth: true,
        pyqQuestionNumber: true,
        solution: includeSol,
        translations: {
          select: {
            language: true,
            statement: true,
            options: true,
            correctOptionIds: true,
            solution: includeSol,
          },
        },
        pyqOccurrences: {
          where: { verificationStatus: VERIFIED_PYQ_STATUS },
          select: {
            year: true,
            session: true,
            shift: true,
            paper: true,
            questionNumber: true,
            exam: { select: { slug: true, name: true, canonicalType: true } },
          },
        },
      },
    }),
  ]);

  return { total, page, pageSize, items };
}

/**
 * Retrieve strictly VERIFIED PYQs for public website pages.
 */
export async function getPublicPYQs(opts: StudentPyqFilterOptions = {}) {
  return getStudentVisiblePYQs(opts);
}

/**
 * Search strictly VERIFIED PYQs for student & public search.
 */
export async function searchStudentPYQs(
  query: string,
  opts: StudentPyqFilterOptions = {}
) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(30, Math.max(1, opts.pageSize ?? 15));
  const where = buildVerifiedQuestionWhere(opts, query);
  const includeSol = Boolean(opts.includeSolution);

  const [total, questions] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      orderBy: [{ pyqYear: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        questionCode: true,
        type: true,
        difficulty: true,
        subject: true,
        chapter: true,
        topic: true,
        imageUrl: true,
        pyqExam: true,
        pyqYear: true,
        pyqMonth: true,
        pyqQuestionNumber: true,
        solution: includeSol,
        translations: {
          select: {
            language: true,
            statement: true,
            options: true,
            correctOptionIds: true,
            solution: includeSol,
          },
        },
        pyqOccurrences: {
          where: { verificationStatus: VERIFIED_PYQ_STATUS },
          select: {
            year: true,
            session: true,
            shift: true,
            paper: true,
            questionNumber: true,
            exam: { select: { slug: true, name: true, canonicalType: true } },
          },
        },
      },
    }),
  ]);

  return { total, page, pageSize, questions };
}

/**
 * Retrieve a single strictly VERIFIED question by slug/id/code for public or student view.
 * Returns null if the question does not exist OR is not VERIFIED.
 */
export async function getVerifiedQuestionBySlugOrId(
  slugFilters: Prisma.QuestionWhereInput[],
  includeSolution = false
) {
  return prisma.question.findFirst({
    where: {
      AND: [
        { OR: slugFilters },
        { pyqVerificationStatus: VERIFIED_PYQ_STATUS },
        { isPublished: true },
        { pyqOccurrences: { some: { verificationStatus: VERIFIED_PYQ_STATUS } } },
      ],
    },
    select: {
      id: true,
      slug: true,
      questionCode: true,
      type: true,
      difficulty: true,
      subject: true,
      chapter: true,
      topic: true,
      subTopic: true,
      imageUrl: true,
      pyqExam: true,
      pyqYear: true,
      pyqMonth: true,
      pyqQuestionNumber: true,
      solution: includeSolution,
      translations: {
        select: {
          language: true,
          statement: true,
          options: true,
          correctOptionIds: true,
          solution: includeSolution,
        },
      },
      pyqOccurrences: {
        where: { verificationStatus: VERIFIED_PYQ_STATUS },
        select: {
          id: true,
          year: true,
          session: true,
          shift: true,
          paper: true,
          questionNumber: true,
          sourceLabel: true,
          exam: { select: { slug: true, name: true, canonicalType: true } },
        },
      },
    },
  });
}

/**
 * Get student-facing VERIFIED PYQ counts grouped by canonical exam type.
 */
export async function getVerifiedPyqCountsByExam() {
  const [neetCount, jeeMainCount, jeeAdvCount] = await Promise.all([
    prisma.pyqOccurrence.count({
      where: {
        ...VERIFIED_PYQ_OCCURRENCE_WHERE,
        exam: { canonicalType: "NEET_UG" },
      },
    }),
    prisma.pyqOccurrence.count({
      where: {
        ...VERIFIED_PYQ_OCCURRENCE_WHERE,
        exam: { canonicalType: "JEE_MAIN" },
      },
    }),
    prisma.pyqOccurrence.count({
      where: {
        ...VERIFIED_PYQ_OCCURRENCE_WHERE,
        exam: { canonicalType: "JEE_ADVANCED" },
      },
    }),
  ]);

  return { neetCount, jeeMainCount, jeeAdvCount };
}

/**
 * Immediately invalidate Next.js ISR / route caches whenever a PYQ's
 * verification status changes (e.g. VERIFIED -> UNVERIFIED or UNVERIFIED -> VERIFIED).
 * Uses dynamic import so non-Next.js CLI scripts/tests can import visibility.ts safely.
 */
export async function invalidatePyqVisibilityCaches(opts?: {
  slug?: string | null;
  subject?: string | null;
  chapter?: string | null;
}) {
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/pyq", "layout");
    revalidatePath("/pyq");
    revalidatePath("/pyq/neet");
    revalidatePath("/pyq/jee-main");
    revalidatePath("/pyq/jee-advanced");
    revalidatePath("/sitemap.xml");
    revalidatePath("/api/public/pyq/search");
    revalidatePath("/api/student/pyq");
    revalidatePath("/api/student/pyq/questions");
    if (opts?.slug) {
      revalidatePath(`/pyq/question/${opts.slug}`);
    }
  } catch {
    // No-op when running outside Next.js server request context (e.g. CLI test scripts)
  }
}
