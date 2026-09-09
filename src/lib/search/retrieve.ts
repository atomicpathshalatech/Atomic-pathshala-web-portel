import "server-only";
import { prisma } from "@/lib/db";
import { containsAll, containsAllAcross } from "@/lib/search/normalize";
import type { SearchResult } from "@/lib/search/types";
import type { SearchScope } from "@/lib/search/scope";

/** How many raw rows to pull per entity before ranking trims to the top N. */
const RAW_TAKE = 12;

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

// ---------------------------------------------------------------------------
// PEOPLE
// ---------------------------------------------------------------------------

async function findTeachers(scope: SearchScope, tokens: string[]): Promise<SearchResult[]> {
  if (!scope.canReadTeachers || tokens.length === 0) return [];
  const rows = await prisma.teacher.findMany({
    where: {
      user: {
        ...containsAll("name", tokens),
        status: { notIn: ["SUSPENDED", "INACTIVE"] },
      },
    },
    select: {
      id: true,
      department: true,
      subjects: true,
      rating: true,
      user: { select: { id: true, name: true, email: true, phone: true, photoUrl: true } },
    },
    take: RAW_TAKE,
  });

  return rows.map((t) => {
    const subjectLine = t.subjects?.length ? t.subjects.join(", ") : t.department;
    // Searchability != visibility: a student/parent gets a name-only public
    // card; only a team viewer with TEACHER_READ sees contact details.
    const teamView = scope.isTeam && scope.canReadTeachers;
    const href = scope.isTeam
      ? scope.canReadTeamMembers
        ? `/team/users/${t.user.id}`
        : `/team/faculty/${t.id}/edit`
      : `/teachers/${t.id}`;
    return {
      type: "teacher" as const,
      id: t.id,
      title: t.user.name,
      subtitle: `Teacher${subjectLine ? ` · ${subjectLine}` : ""}`,
      href,
      meta: {
        department: t.department,
        subjects: t.subjects?.join(", ") ?? null,
        rating: t.rating ?? null,
        email: teamView ? t.user.email : null,
        phone: teamView ? t.user.phone : null,
      },
    };
  });
}

async function findStudents(scope: SearchScope, tokens: string[]): Promise<SearchResult[]> {
  if (!scope.canReadStudents || tokens.length === 0) return [];
  const rows = await prisma.student.findMany({
    where: {
      OR: [
        { user: containsAll("name", tokens) },
        ...(tokens.length === 1
          ? [
              { studentIdCode: { contains: tokens[0], mode: "insensitive" as const } },
              { enrollmentNumber: { contains: tokens[0], mode: "insensitive" as const } },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      studentIdCode: true,
      class: true,
      targetExam: true,
      status: true,
      user: { select: { id: true, name: true } },
    },
    take: RAW_TAKE,
  });

  return rows.map((s) => ({
    type: "student" as const,
    id: s.id,
    title: s.user.name,
    subtitle: `Student · ${s.studentIdCode}${s.class ? ` · Class ${s.class}` : ""}${
      s.targetExam ? ` · ${s.targetExam}` : ""
    }`,
    href: scope.canReadTeamMembers ? `/team/users/${s.user.id}` : `/team/students`,
    meta: { studentIdCode: s.studentIdCode, class: s.class, targetExam: s.targetExam, status: s.status },
  }));
}

async function findTeamMembers(scope: SearchScope, tokens: string[]): Promise<SearchResult[]> {
  if (!scope.canReadTeamMembers || tokens.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: {
      roleId: { not: null },
      role: { name: { notIn: ["STUDENT", "PARENT", "GUEST"] } },
      ...containsAll("name", tokens),
    },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      status: true,
      role: { select: { name: true, label: true } },
    },
    take: RAW_TAKE,
  });

  return rows.map((u) => ({
    type: "team_member" as const,
    id: u.id,
    title: u.name,
    subtitle: `${u.role?.label ?? u.role?.name ?? "Team"}${u.department ? ` · ${u.department}` : ""}`,
    href: `/team/users/${u.id}`,
    meta: { role: u.role?.name ?? null, email: u.email, department: u.department, status: u.status },
  }));
}

// ---------------------------------------------------------------------------
// ACADEMIC
// ---------------------------------------------------------------------------

async function findBatches(scope: SearchScope, tokens: string[]): Promise<SearchResult[]> {
  if (!scope.canReadBatches || tokens.length === 0) return [];
  const where: Record<string, unknown> = {
    OR: [containsAll("name", tokens), containsAll("code", tokens)],
  };
  if (!scope.isTeam) where.id = { in: scope.batchIds };

  const rows = await prisma.batch.findMany({
    where,
    select: { id: true, name: true, code: true, targetExam: true, status: true },
    take: RAW_TAKE,
  });

  return rows.map((b) => ({
    type: "batch" as const,
    id: b.id,
    title: b.name,
    subtitle: `Batch · ${b.code}${b.targetExam ? ` · ${b.targetExam}` : ""} · ${b.status}`,
    href: scope.isTeam ? `/team/batches/${b.id}` : `/courses/${b.id}`,
    meta: { code: b.code, targetExam: b.targetExam, status: b.status },
  }));
}

async function findCourses(scope: SearchScope, tokens: string[]): Promise<SearchResult[]> {
  if (!scope.canReadCourses || tokens.length === 0) return [];
  const rows = await prisma.course.findMany({
    where: containsAll("title", tokens),
    select: { id: true, title: true, slug: true, isPublished: true },
    take: RAW_TAKE,
  });
  return rows.map((c) => ({
    type: "course" as const,
    id: c.id,
    title: c.title,
    subtitle: `Course${c.isPublished ? "" : " · Draft"}`,
    href: scope.isTeam ? `/team/batches` : `/courses`,
    meta: { slug: c.slug, isPublished: c.isPublished },
  }));
}

async function findSubjects(scope: SearchScope, tokens: string[]): Promise<SearchResult[]> {
  if (!scope.canReadChapters || tokens.length === 0) return [];
  const where: Record<string, unknown> = containsAll("title", tokens);
  if (!scope.isTeam) where.title = { in: scope.subjectTitles };
  const rows = await prisma.subject.findMany({
    where,
    select: { id: true, title: true, course: { select: { title: true } } },
    take: RAW_TAKE,
  });
  return rows.map((s) => ({
    type: "subject" as const,
    id: s.id,
    title: s.title,
    subtitle: `Subject${s.course?.title ? ` · ${s.course.title}` : ""}`,
    href: scope.isTeam ? `/team/chapters` : `/courses`,
    meta: { course: s.course?.title ?? null },
  }));
}

async function findChapters(scope: SearchScope, tokens: string[]): Promise<SearchResult[]> {
  if (!scope.canReadChapters || tokens.length === 0) return [];
  const where: Record<string, unknown> = {
    OR: [containsAll("title", tokens), ...(tokens.length === 1 ? [{ chapterId: tokens[0] }] : [])],
  };
  if (!scope.isTeam) where.subject = { title: { in: scope.subjectTitles } };

  const rows = await prisma.chapter.findMany({
    where,
    select: {
      id: true,
      title: true,
      chapterId: true,
      status: true,
      subject: { select: { title: true, course: { select: { title: true } } } },
    },
    take: RAW_TAKE,
  });

  return rows.map((c) => ({
    type: "chapter" as const,
    id: c.id,
    title: c.title,
    subtitle: `Chapter${c.subject?.title ? ` · ${c.subject.title}` : ""}${
      scope.isTeam ? ` · ${c.status}` : ""
    }`,
    href: scope.isTeam ? `/team/chapters/${c.id}` : `/courses`,
    meta: { chapterId: c.chapterId, subject: c.subject?.title ?? null, status: c.status },
  }));
}

async function findLectures(scope: SearchScope, tokens: string[]): Promise<SearchResult[]> {
  if (!scope.canReadLectures || tokens.length === 0) return [];
  const where: Record<string, unknown> = containsAll("title", tokens);
  if (!scope.isTeam) {
    where.status = "PUBLISHED";
    where.chapter = { subject: { title: { in: scope.subjectTitles } } };
  }
  const rows = await prisma.lecture.findMany({
    where,
    select: {
      id: true,
      title: true,
      status: true,
      chapterId: true,
      chapter: { select: { title: true, subject: { select: { title: true } } } },
      teacher: { select: { user: { select: { name: true } } } },
    },
    take: RAW_TAKE,
  });
  return rows.map((l) => ({
    type: "lecture" as const,
    id: l.id,
    title: l.title,
    subtitle: [
      "Lecture",
      l.chapter?.subject?.title,
      l.chapter?.title,
      l.teacher?.user?.name,
    ]
      .filter(Boolean)
      .join(" · "),
    href: scope.isTeam ? `/team/lectures/${l.id}` : `/watch/${l.id}`,
    meta: {
      chapter: l.chapter?.title ?? null,
      subject: l.chapter?.subject?.title ?? null,
      teacher: l.teacher?.user?.name ?? null,
      status: l.status,
    },
  }));
}

async function findModules(scope: SearchScope, tokens: string[]): Promise<SearchResult[]> {
  if (!scope.canReadModules || tokens.length === 0) return [];
  const rows = await prisma.module.findMany({
    where: containsAll("title", tokens),
    select: { id: true, title: true, status: true },
    take: RAW_TAKE,
  });
  return rows.map((m) => ({
    type: "module" as const,
    id: m.id,
    title: m.title,
    subtitle: `Module · ${m.status}`,
    href: `/team/modules/${m.id}`,
    meta: { status: m.status },
  }));
}

async function findStudyMaterial(scope: SearchScope, tokens: string[]): Promise<SearchResult[]> {
  if (!scope.canReadStudyMaterial || tokens.length === 0) return [];
  const where: Record<string, unknown> = {
    OR: [containsAll("title", tokens), containsAll("chapterTitle", tokens)],
  };
  if (!scope.isTeam) where.isPublished = true;
  const rows = await prisma.studyMaterial.findMany({
    where,
    select: {
      id: true,
      title: true,
      subject: true,
      chapterTitle: true,
      type: true,
      classExam: true,
      isPublished: true,
    },
    take: RAW_TAKE,
  });
  return rows.map((s) => ({
    type: "study_material" as const,
    id: s.id,
    title: s.title,
    subtitle: ["Study Material", s.type, s.subject, s.chapterTitle, s.classExam]
      .filter(Boolean)
      .join(" · "),
    href: scope.isTeam ? `/team/study-material` : `/study-material`,
    meta: { subject: s.subject, chapter: s.chapterTitle, type: s.type, published: s.isPublished },
  }));
}

async function findTestSeries(scope: SearchScope, tokens: string[]): Promise<SearchResult[]> {
  if (!scope.canReadTests || tokens.length === 0) return [];
  const where: Record<string, unknown> = {
    OR: [containsAll("name", tokens), containsAll("code", tokens)],
  };
  if (!scope.isTeam) where.status = "PUBLISHED";
  const rows = await prisma.testSeries.findMany({
    where,
    select: { id: true, name: true, code: true, examType: true, status: true },
    take: RAW_TAKE,
  });
  return rows.map((ts) => ({
    type: "test_series" as const,
    id: ts.id,
    title: ts.name,
    subtitle: `Test Series · ${ts.code}${ts.examType ? ` · ${ts.examType}` : ""}`,
    href: scope.isTeam ? `/team/test-series/${ts.id}` : `/tests`,
    meta: { code: ts.code, examType: ts.examType, status: ts.status },
  }));
}

async function findTests(scope: SearchScope, tokens: string[]): Promise<SearchResult[]> {
  if (!scope.canReadTests || tokens.length === 0) return [];
  const where: Record<string, unknown> = {
    archived: false,
    OR: [containsAll("name", tokens), ...(tokens.length === 1 ? [{ code: tokens[0] }] : [])],
  };
  if (!scope.isTeam) where.status = "PUBLISHED";
  const rows = await prisma.test.findMany({
    where,
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      chapter: { select: { title: true } },
      testSeries: { select: { name: true } },
    },
    take: RAW_TAKE,
  });
  return rows.map((t) => ({
    type: "test" as const,
    id: t.id,
    title: t.name,
    subtitle: ["Test", t.testSeries?.name, t.chapter?.title, scope.isTeam ? t.status : null]
      .filter(Boolean)
      .join(" · "),
    href: scope.isTeam ? `/team/tests/${t.id}` : `/tests`,
    meta: { code: t.code, chapter: t.chapter?.title ?? null, series: t.testSeries?.name ?? null, status: t.status },
  }));
}

async function findQuestions(scope: SearchScope, tokens: string[]): Promise<SearchResult[]> {
  if (!scope.canReadQuestions || tokens.length === 0) return [];
  const rows = await prisma.question.findMany({
    where: {
      OR: [
        containsAllAcross(["chapter", "topic", "subTopic", "subject"], tokens),
        ...(tokens.length === 1 ? [{ questionCode: { contains: tokens[0], mode: "insensitive" as const } }] : []),
        { translations: { some: containsAll("statement", tokens) } },
      ],
    },
    select: {
      id: true,
      questionCode: true,
      subject: true,
      chapter: true,
      topic: true,
      difficulty: true,
      status: true,
      translations: { select: { statement: true }, take: 1 },
    },
    take: RAW_TAKE,
  });
  return rows.map((q) => {
    const stmt = (q.translations[0]?.statement ?? "").replace(/[#*_`>!\[\]]/g, "").slice(0, 90);
    return {
      type: "question" as const,
      id: q.id,
      title: stmt || `Question ${q.questionCode ?? q.id.slice(0, 6)}`,
      subtitle: ["Question", q.subject, q.chapter, q.topic, q.difficulty, q.status]
        .filter(Boolean)
        .join(" · "),
      href: `/team/questions/${q.id}/edit`,
      meta: { code: q.questionCode, subject: q.subject, chapter: q.chapter, status: q.status },
    };
  });
}

// ---------------------------------------------------------------------------
// CLASSES  (BatchSchedule — live / scheduled / completed) + recordings
// ---------------------------------------------------------------------------

interface ClassQueryOpts {
  /** extra AND filters — used by the AI layer for date / teacher / chapter. */
  extraWhere?: Record<string, unknown>;
  onlyWithRecording?: boolean;
  take?: number;
}

export async function findClasses(
  scope: SearchScope,
  tokens: string[],
  opts: ClassQueryOpts = {}
): Promise<SearchResult[]> {
  if (!scope.canReadClasses) return [];
  // `isTest` distinguishes real classes from always-open Whiteboard Test Lab
  // rooms. On a database where the whiteboard_test_lab migration hasn't run
  // yet the column is absent — we detect that below and retry without it.
  const and: Record<string, unknown>[] = [{ isTest: false }];

  if (tokens.length > 0) {
    and.push({
      OR: [
        containsAllAcross(["title", "subject"], tokens),
        { chapter: containsAll("title", tokens) },
        { teacher: { user: containsAll("name", tokens) } },
        { batch: containsAllAcross(["name", "code"], tokens) },
      ],
    });
  }
  if (!scope.isTeam) and.push({ batchId: { in: scope.batchIds } });
  if (opts.extraWhere) and.push(opts.extraWhere);
  if (opts.onlyWithRecording) {
    and.push({ liveWhiteboardSession: { recordingStatus: "READY" } });
  }

  const select = {
    id: true,
    title: true,
    subject: true,
    type: true,
    status: true,
    startsAt: true,
    endsAt: true,
    batchId: true,
    batch: { select: { name: true, targetExam: true } },
    teacher: { select: { user: { select: { name: true } } } },
    chapter: { select: { title: true } },
    liveWhiteboardSession: { select: { id: true, recordingStatus: true, status: true } },
  } as const;

  let rows;
  try {
    rows = await prisma.batchSchedule.findMany({
      where: { AND: and },
      select,
      orderBy: { startsAt: "desc" },
      take: opts.take ?? RAW_TAKE,
    });
  } catch (e) {
    if (e instanceof Error && /isTest|is_test/i.test(e.message)) {
      rows = await prisma.batchSchedule.findMany({
        where: { AND: and.filter((c) => !("isTest" in c)) },
        select,
        orderBy: { startsAt: "desc" },
        take: opts.take ?? RAW_TAKE,
      });
    } else {
      throw e;
    }
  }

  return rows.map((s) => {
    const hasRecording = s.liveWhiteboardSession?.recordingStatus === "READY";
    const isRecording = opts.onlyWithRecording === true;
    return {
      type: isRecording ? ("recording" as const) : ("class" as const),
      id: s.id,
      title: [s.subject, s.chapter?.title].filter(Boolean).join(" — ") || s.title,
      subtitle: [
        fmtDate(s.startsAt),
        fmtTime(s.startsAt),
        s.teacher?.user?.name,
        s.batch?.name,
        scope.isTeam ? s.status : null,
        hasRecording && !isRecording ? "· recording available" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: scope.isTeam ? `/team/batches/${s.batchId}` : `/schedule`,
      meta: {
        date: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        teacher: s.teacher?.user?.name ?? null,
        batch: s.batch?.name ?? null,
        chapter: s.chapter?.title ?? null,
        subject: s.subject ?? null,
        status: s.status,
        hasRecording,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// ORCHESTRATION
// ---------------------------------------------------------------------------

export async function retrieveAll(
  scope: SearchScope,
  tokens: string[],
  opts: { suggest?: boolean } = {}
): Promise<SearchResult[]> {
  // Suggest mode (fires while typing) runs a smaller, high-signal set so we
  // aren't hitting every table on every debounced keystroke. The full set
  // runs for an explicit search / the AI path.
  const queries = opts.suggest
    ? [
        findTeachers(scope, tokens),
        findStudents(scope, tokens),
        findTeamMembers(scope, tokens),
        findBatches(scope, tokens),
        findChapters(scope, tokens),
        findTests(scope, tokens),
        findClasses(scope, tokens),
      ]
    : [
        findTeachers(scope, tokens),
        findStudents(scope, tokens),
        findTeamMembers(scope, tokens),
        findBatches(scope, tokens),
        findCourses(scope, tokens),
        findSubjects(scope, tokens),
        findChapters(scope, tokens),
        findLectures(scope, tokens),
        findModules(scope, tokens),
        findStudyMaterial(scope, tokens),
        findTestSeries(scope, tokens),
        findTests(scope, tokens),
        findQuestions(scope, tokens),
        findClasses(scope, tokens),
        findClasses(scope, tokens, { onlyWithRecording: true }),
      ];
  const settled = await Promise.allSettled(queries);

  const out: SearchResult[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") out.push(...r.value);
    else console.warn("[search] entity query failed:", r.reason);
  }
  return out;
}
