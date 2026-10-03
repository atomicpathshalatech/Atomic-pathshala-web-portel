import "server-only";
import { prisma } from "@/lib/db";
import { cleanBatchName } from "@/lib/academic/canonical-courses";
import { generateSlug } from "@/lib/teacher/profile";
import { getFooterData, getPublishedFaqs, type HomepageFaq } from "@/lib/homepage";

/**
 * Everything the public homepage shows, read from the real tables. Each part
 * fails on its own (an empty list / null), so one slow or missing table never
 * breaks the page. Nothing private is returned: no question text, no file
 * URLs, no student data — only names, counts and public profile fields.
 */

export type StudyMaterialType =
  | "MODULE"
  | "SHORT_NOTES"
  | "MIND_MAP"
  | "FORMULA_SHEET"
  | "NCERT_HIGHLIGHTED"
  | "NCERT_EXEMPLAR"
  | "NEET_PYQ"
  | "JEE_PYQ";

export type PublicHomeData = {
  /** Published study files per type (0 when none). */
  materialCounts: Record<StudyMaterialType, number>;
  /** Published PYQs per exam and subject, e.g. { NEET: { Physics: 120 } }. */
  pyqCounts: Record<string, Record<string, number>>;
  /** Chapters with the most published PYQs. */
  topPyqChapters: { exam: string; subject: string; chapter: string; count: number }[];
  /** Test series open to every student (visibility PUBLIC). */
  freeSeries: { id: string; name: string; examType: string | null; tests: number; avgDurationMin: number | null; questions: number }[];
  batches: {
    id: string;
    name: string;
    exam: string | null;
    faculty: string[];
    price: number | null;
    originalPrice: number | null;
    startDate: string | null;
    status: "ACTIVE" | "UPCOMING";
    thumbnailUrl: string | null;
  }[];
  faculty: { slug: string; name: string; subjects: string[]; photoUrl: string | null }[];
  today: {
    classes: { title: string; subject: string | null; startsAt: string; batch: string }[];
    dpps: number;
    tests: number;
  };
  metrics: { students: number; questions: number; tests: number; studyFiles: number };
  youtubeUrl: string | null;
  socials: { label: string; url: string }[];
  faqs: HomepageFaq[];
};

const EMPTY_COUNTS: Record<StudyMaterialType, number> = {
  MODULE: 0,
  SHORT_NOTES: 0,
  MIND_MAP: 0,
  FORMULA_SHEET: 0,
  NCERT_HIGHLIGHTED: 0,
  NCERT_EXEMPLAR: 0,
  NEET_PYQ: 0,
  JEE_PYQ: 0,
};

const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await p;
  } catch (err) {
    console.error("[public-home]", err instanceof Error ? err.message : err);
    return fallback;
  }
};

/** "NEET UG 2024" / "neet" → "NEET"; "JEE Main" / "JEE Advanced" kept apart. */
function examKey(raw: string | null): string | null {
  const v = (raw ?? "").toLowerCase();
  if (!v) return null;
  if (v.includes("neet") || v.includes("aipmt")) return "NEET";
  if (v.includes("adv")) return "JEE Advanced";
  if (v.includes("jee")) return "JEE Main";
  if (v.includes("cbse") || v.includes("board")) return "CBSE";
  return null;
}

function subjectKey(raw: string): string {
  const v = raw.toLowerCase();
  if (v.includes("phys") && !v.includes("chem")) return "Physics";
  if (v.includes("chem")) return "Chemistry";
  if (v.includes("bio") || v.includes("botan") || v.includes("zool")) return "Biology";
  if (v.includes("math")) return "Mathematics";
  return raw;
}

/** Start and end of today in India (IST), as UTC instants. */
function istToday(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const start = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3600_000);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export async function getPublicHomeData(): Promise<PublicHomeData> {
  const { start, end } = istToday();

  const [materials, pyqGroups, series, batches, teachers, todayClasses, todayDpps, todayTests, students, questions, tests, footer, faqs] =
    await Promise.all([
      safe(prisma.studyMaterial.groupBy({ by: ["type"], where: { isPublished: true }, _count: { _all: true } }), []),
      safe(
        prisma.question.groupBy({
          by: ["pyqExam", "subject", "chapter"],
          where: { isPublished: true, pyqExam: { not: null } },
          _count: { _all: true },
        }),
        []
      ),
      safe(
        prisma.testSeries.findMany({
          where: { visibility: "PUBLIC", status: { notIn: ["DRAFT", "ARCHIVED"] } },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            name: true,
            examType: true,
            tests: {
              where: { status: "PUBLISHED", archived: false },
              select: { durationMin: true, sections: { select: { targetCount: true } } },
            },
          },
        }),
        []
      ),
      safe(
        prisma.batch.findMany({
          where: { status: { in: ["ACTIVE", "UPCOMING"] } },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          take: 6,
          select: {
            id: true,
            name: true,
            targetExam: true,
            price: true,
            originalPrice: true,
            startDate: true,
            status: true,
            thumbnailUrl: true,
            teachers: { select: { teacher: { select: { displayName: true, user: { select: { name: true } } } } } },
          },
        }),
        []
      ),
      safe(
        prisma.teacher.findMany({
          where: {
            onboardingStatus: { not: "REJECTED" },
            user: { status: "ACTIVE", role: { name: { in: ["TEACHER", "ACADEMIC_HEAD", "DEPARTMENT_HEAD", "FOUNDER"] } } },
          },
          orderBy: { createdAt: "asc" },
          take: 8,
          select: { displayName: true, subjects: true, department: true, user: { select: { name: true, photoUrl: true } } },
        }),
        []
      ),
      safe(
        prisma.batchSchedule.findMany({
          where: { type: "LIVE_CLASS", status: { not: "CANCELLED" }, startsAt: { gte: start, lt: end } },
          orderBy: { startsAt: "asc" },
          take: 6,
          select: { title: true, subject: true, startsAt: true, batch: { select: { name: true } } },
        }),
        []
      ),
      safe(prisma.batchSchedule.count({ where: { type: "DPP", status: { not: "CANCELLED" }, startsAt: { gte: start, lt: end } } }), 0),
      safe(prisma.test.count({ where: { status: "PUBLISHED", archived: false, openTime: { gte: start, lt: end } } }), 0),
      safe(prisma.student.count(), 0),
      safe(prisma.question.count({ where: { isPublished: true } }), 0),
      safe(prisma.test.count({ where: { status: "PUBLISHED", archived: false } }), 0),
      safe(getFooterData(), null),
      safe(getPublishedFaqs(), []),
    ]);

  const materialCounts = { ...EMPTY_COUNTS };
  for (const m of materials) materialCounts[m.type as StudyMaterialType] = m._count._all;

  const pyqCounts: PublicHomeData["pyqCounts"] = {};
  const chapterCounts = new Map<string, { exam: string; subject: string; chapter: string; count: number }>();
  for (const g of pyqGroups) {
    const exam = examKey(g.pyqExam);
    if (!exam) continue;
    const subject = subjectKey(g.subject);
    pyqCounts[exam] ??= {};
    pyqCounts[exam][subject] = (pyqCounts[exam][subject] ?? 0) + g._count._all;
    if (g.chapter) {
      const key = `${exam}|${subject}|${g.chapter}`;
      const cur = chapterCounts.get(key) ?? { exam, subject, chapter: g.chapter, count: 0 };
      cur.count += g._count._all;
      chapterCounts.set(key, cur);
    }
  }

  const socials = footer?.social ?? [];
  const youtubeUrl = socials.find((s) => /youtube/i.test(`${s.label} ${s.url}`))?.url ?? null;

  return {
    materialCounts,
    pyqCounts,
    topPyqChapters: [...chapterCounts.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    freeSeries: series
      .map((s) => {
        const durations = s.tests.map((t) => t.durationMin).filter((d) => d > 0);
        return {
          id: s.id,
          name: s.name,
          examType: s.examType,
          tests: s.tests.length,
          avgDurationMin: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
          questions: s.tests.reduce((n, t) => n + t.sections.reduce((m, sec) => m + (sec.targetCount || 0), 0), 0),
        };
      })
      .filter((s) => s.tests > 0)
      .slice(0, 3),
    batches: batches.map((b) => ({
      id: b.id,
      name: cleanBatchName(b.name),
      exam: b.targetExam ? cleanBatchName(b.targetExam) : null,
      faculty: Array.from(new Set(b.teachers.map((t) => t.teacher.displayName || t.teacher.user.name).filter(Boolean))),
      price: b.price ?? null,
      originalPrice: b.originalPrice ?? null,
      startDate: b.startDate ? b.startDate.toISOString() : null,
      status: b.status as "ACTIVE" | "UPCOMING",
      thumbnailUrl: b.thumbnailUrl ?? null,
    })),
    faculty: teachers.map((t) => {
      const name = t.displayName || t.user.name;
      const subjects = t.subjects.length ? t.subjects : t.department ? [t.department] : [];
      return { slug: generateSlug(name), name, subjects, photoUrl: t.user.photoUrl ?? null };
    }),
    today: {
      classes: todayClasses.map((c) => ({ title: c.title, subject: c.subject, startsAt: c.startsAt.toISOString(), batch: cleanBatchName(c.batch.name) })),
      dpps: todayDpps,
      tests: todayTests,
    },
    metrics: { students, questions, tests, studyFiles: Object.values(materialCounts).reduce((a, b) => a + b, 0) },
    youtubeUrl,
    socials: socials.map((s) => ({ label: s.label, url: s.url })),
    faqs,
  };
}

export type HomeBanner = { id: string; title: string; subtitle: string | null; imageUrl: string; mobileImageUrl: string | null; ctaUrl: string | null; openInNewTab: boolean };

/** All ACTIVE banners in their date window (Team → Website → Banners), for the homepage slider. */
export async function getActiveHomeBanners(): Promise<HomeBanner[]> {
  const now = new Date();
  return safe(
    prisma.banner.findMany({
      where: {
        status: "ACTIVE",
        AND: [{ OR: [{ startAt: null }, { startAt: { lte: now } }] }, { OR: [{ endAt: null }, { endAt: { gte: now } }] }],
      },
      orderBy: [{ priority: "desc" }, { order: "asc" }, { createdAt: "desc" }],
      take: 8,
      select: { id: true, title: true, subtitle: true, imageUrl: true, mobileImageUrl: true, ctaUrl: true, openInNewTab: true },
    }),
    [],
  );
}
