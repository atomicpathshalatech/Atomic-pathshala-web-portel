import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatOccurrenceLabel } from "./keys";

/**
 * Server-side PYQ Library filtering.
 *
 * The exam / year / session / shift / paper / verification / import filters
 * are evaluated together on ONE occurrence (`occurrences: { some: {...} }`):
 * "NEET UG + 2024" matches a question only through an occurrence that is
 * itself NEET UG 2024 — never through a NEET 2023 occurrence plus a JEE 2024
 * one, never through an unknown-year occurrence, never through text
 * similarity. Subject / chapter / topic are properties of the question.
 * Each result lists exactly the occurrences that matched.
 */

export type LibraryFilters = {
  examIds: string[];
  years: number[];
  yearFrom: number | null;
  yearTo: number | null;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  session: string | null;
  shift: string | null;
  paper: string | null;
  verification: "VERIFIED" | "UNVERIFIED" | "ALL";
  jobId: string | null;
  q: string | null;
  usableOnly: boolean;
};

const list = (v: string | null) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean) : []);
const int = (v: string | null) => {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: string | null) => (v && v.trim() ? v.trim() : null);

export function parseLibraryFilters(sp: URLSearchParams): LibraryFilters {
  const v = sp.get("verification");
  return {
    examIds: list(sp.get("exam")),
    years: list(sp.get("years")).map(Number).filter((n) => Number.isInteger(n)),
    yearFrom: int(sp.get("yearFrom")),
    yearTo: int(sp.get("yearTo")),
    subject: str(sp.get("subject")),
    chapter: str(sp.get("chapter")),
    topic: str(sp.get("topic")),
    session: str(sp.get("session")),
    shift: str(sp.get("shift")),
    paper: str(sp.get("paper")),
    verification: v === "UNVERIFIED" || v === "ALL" ? v : "VERIFIED",
    jobId: str(sp.get("job")),
    q: str(sp.get("q")),
    usableOnly: sp.get("usable") === "1",
  };
}

export function occurrenceWhere(f: LibraryFilters): Prisma.PyqOccurrenceWhereInput {
  const and: Prisma.PyqOccurrenceWhereInput[] = [];
  if (f.examIds.length) and.push({ examId: { in: f.examIds } });
  if (f.years.length) and.push({ year: { in: f.years } });
  if (f.yearFrom !== null) and.push({ year: { gte: f.yearFrom } });
  if (f.yearTo !== null) and.push({ year: { lte: f.yearTo } });
  if (f.session) and.push({ session: { equals: f.session, mode: "insensitive" } });
  if (f.shift) and.push({ shift: { equals: f.shift, mode: "insensitive" } });
  if (f.paper) and.push({ paper: { equals: f.paper, mode: "insensitive" } });
  if (f.verification !== "ALL") and.push({ verificationStatus: f.verification });
  else and.push({ verificationStatus: { not: "REJECTED" } });
  if (f.jobId) and.push({ extractionJobId: f.jobId });
  return { AND: and };
}

export function questionWhere(f: LibraryFilters): Prisma.QuestionWhereInput {
  const and: Prisma.QuestionWhereInput[] = [{ pyqOccurrences: { some: occurrenceWhere(f) } }];
  if (f.subject) and.push({ subject: { equals: f.subject, mode: "insensitive" } });
  if (f.chapter) and.push({ chapter: { equals: f.chapter, mode: "insensitive" } });
  if (f.topic) and.push({ topic: { equals: f.topic, mode: "insensitive" } });
  if (f.usableOnly) and.push({ OR: [{ isPublished: true }, { status: "PUBLISHED" }] });
  if (f.q) {
    and.push({
      OR: [
        { questionCode: { contains: f.q, mode: "insensitive" } },
        { translations: { some: { statement: { contains: f.q, mode: "insensitive" } } } },
      ],
    });
  }
  return { AND: and };
}

export type LibrarySort = "year_desc" | "year_asc" | "recent" | "chapter";

export async function queryLibrary(f: LibraryFilters, page: number, pageSize: number, sort: LibrarySort = "year_desc") {
  const where = questionWhere(f);
  const occWhere = occurrenceWhere(f);
  const orderBy: Prisma.QuestionOrderByWithRelationInput[] =
    sort === "recent" ? [{ createdAt: "desc" }] : sort === "chapter" ? [{ subject: "asc" }, { chapter: "asc" }, { createdAt: "asc" }] : [{ pyqYear: sort === "year_asc" ? "asc" : "desc" }, { createdAt: "asc" }];
  const [total, rows] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        questionCode: true,
        subject: true,
        chapter: true,
        topic: true,
        type: true,
        difficulty: true,
        imageUrl: true,
        status: true,
        isPublished: true,
        solution: true,
        translations: { select: { language: true, statement: true, options: true, correctOptionIds: true, solution: true } },
        pyqOccurrences: {
          where: occWhere,
          orderBy: [{ year: "desc" }],
          select: { id: true, year: true, session: true, shift: true, paper: true, questionNumber: true, sourcePage: true, verificationStatus: true, extractionJobId: true, exam: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);
  const items = rows.map((q) => ({
    ...q,
    occurrences: q.pyqOccurrences.map((o) => ({
      ...o,
      label: formatOccurrenceLabel({ examName: o.exam.name, year: o.year, session: o.session, shift: o.shift, paper: o.paper }),
    })),
    pyqOccurrences: undefined,
  }));
  return { total, page, pageSize, items };
}

/** Every matching question id (for "select all N matching"), capped. */
export async function allMatchingIds(f: LibraryFilters, cap = 2000): Promise<{ ids: string[]; total: number; capped: boolean }> {
  const where = questionWhere(f);
  const [total, rows] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({ where, select: { id: true }, orderBy: [{ pyqYear: "desc" }, { createdAt: "asc" }], take: cap }),
  ]);
  return { ids: rows.map((r) => r.id), total, capped: total > cap };
}

/**
 * Exam -> year counts for the library tree (distinct questions per year,
 * verified occurrences unless asked otherwise).
 */
export async function libraryTree(verification: LibraryFilters["verification"] = "VERIFIED") {
  const statusWhere: Prisma.PyqOccurrenceWhereInput = verification === "ALL" ? { verificationStatus: { not: "REJECTED" } } : { verificationStatus: verification };
  const [exams, grouped] = await Promise.all([
    prisma.pyqExam.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.pyqOccurrence.groupBy({ by: ["examId", "year"], where: statusWhere, _count: { _all: true } }),
  ]);
  return exams.map((e) => {
    const years = grouped
      .filter((g) => g.examId === e.id)
      .map((g) => ({ year: g.year, count: g._count._all }))
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    return {
      id: e.id,
      name: e.name,
      slug: e.slug,
      canonicalType: e.canonicalType,
      aliases: e.aliases,
      total: years.reduce((n, y) => n + y.count, 0),
      years,
    };
  });
}

/** Distinct values that exist for the dropdowns (sessions, shifts, papers, chapters). */
export async function facetValues(f: LibraryFilters) {
  const occ = occurrenceWhere({ ...f, session: null, shift: null, paper: null });
  const [sessions, shifts, papers, chapters, jobs] = await Promise.all([
    prisma.pyqOccurrence.findMany({ where: { ...occ, session: { not: null } }, distinct: ["session"], select: { session: true }, take: 50 }),
    prisma.pyqOccurrence.findMany({ where: { ...occ, shift: { not: null } }, distinct: ["shift"], select: { shift: true }, take: 50 }),
    prisma.pyqOccurrence.findMany({ where: { ...occ, paper: { not: null } }, distinct: ["paper"], select: { paper: true }, take: 50 }),
    prisma.question.findMany({
      where: { ...questionWhere({ ...f, chapter: null, topic: null }), chapter: { not: null } },
      distinct: ["subject", "chapter"],
      select: { subject: true, chapter: true },
      take: 400,
    }),
    prisma.extractionJob.findMany({ where: { isPyqImport: true }, select: { id: true, sourceName: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return {
    sessions: sessions.map((s) => s.session!).sort(),
    shifts: shifts.map((s) => s.shift!).sort(),
    papers: papers.map((s) => s.paper!).sort(),
    chapters: chapters.map((c) => ({ subject: c.subject, chapter: c.chapter! })),
    imports: jobs,
  };
}
