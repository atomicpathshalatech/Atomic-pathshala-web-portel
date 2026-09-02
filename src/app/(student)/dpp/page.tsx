import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { DppSubjectChapterView } from "@/components/student/DppSubjectChapterView";

export const metadata: Metadata = {
  title: "DPP Portal",
};

function statusOfDpp(
  now: Date,
  startsAt: Date,
  endsAt: Date,
  attempt: { status: string; score: number | null } | null
) {
  if (attempt) {
    if (attempt.status === "IN_PROGRESS") {
      return { label: "In Progress", meta: "Incomplete", tone: "bg-secondary-container text-on-secondary-container" };
    }
    return {
      label: "Completed",
      meta: attempt.score !== null ? `Score: ${attempt.score}` : "Submitted",
      tone: "bg-tertiary-container text-on-tertiary-container",
    };
  }
  if (now < startsAt) {
    return { label: "Upcoming", meta: "Opens Soon", tone: "bg-surface-container-high text-on-surface-variant" };
  }
  if (now > endsAt) {
    return { label: "Closed", meta: "Past Due", tone: "bg-error-container text-on-error-container" };
  }
  return { label: "Pending", meta: "Available Now", tone: "bg-primary-container text-on-primary-container" };
}

export default async function DppPortalPage() {
  const { student } = await requireStudentSession();

  // 1. Fetch Student Enrolled Batches
  const enrollments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    select: { batchId: true },
  });
  const batchIds = enrollments.map((e) => e.batchId);

  // 2. Fetch all real standalone DPPs published in system
  let dbDpps: any[] = [];
  try {
    dbDpps = await prisma.dpp.findMany({
      where: {
        OR: [
          { status: "PUBLISHED" },
          { status: "ACTIVE" },
        ],
      },
      include: {
        chapterRef: true,
        questions: { select: { id: true } },
        attempts: {
          where: { studentId: student.id },
          select: { id: true, status: true, score: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("Error loading DPPs:", err);
  }

  // 3. Fetch all real Batch-scheduled DPPs
  let batchDpps: any[] = [];
  if (batchIds.length > 0) {
    try {
      batchDpps = await prisma.batchSchedule.findMany({
        where: {
          batchId: { in: batchIds },
          type: "DPP",
        },
        include: {
          batch: { select: { id: true, name: true } },
          test: {
            include: {
              attempts: {
                where: { studentId: student.id },
                select: { id: true, status: true, score: true },
              },
            },
          },
        },
        orderBy: { startsAt: "desc" },
      });
    } catch (err) {
      console.error("Error loading batch DPPs:", err);
    }
  }

  // 4. Fetch all real Chapters from DB
  let dbChapters: any[] = [];
  try {
    dbChapters = await prisma.chapter.findMany({
      where: { status: { in: ["PUBLISHED", "READY_TO_PUBLISH", "LECTURES_COMPLETE", "DRAFT"] } },
      include: { subject: true },
      orderBy: { order: "asc" },
    });
  } catch (err) {
    console.error("Error loading chapters:", err);
  }

  // 5. Structure Hierarchical Data: Subject -> Chapter -> DPP
  const SUBJECT_CONFIGS: Record<string, { icon: string; color: string; gradient: string; badgeBg: string }> = {
    Physics: { icon: "bolt", color: "text-blue-500", gradient: "from-blue-600 to-indigo-600", badgeBg: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    Chemistry: { icon: "science", color: "text-amber-500", gradient: "from-amber-500 to-orange-600", badgeBg: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    Biology: { icon: "biotech", color: "text-emerald-500", gradient: "from-emerald-500 to-teal-600", badgeBg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    Mathematics: { icon: "functions", color: "text-purple-500", gradient: "from-purple-600 to-indigo-600", badgeBg: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  };

  const subjectMap: Record<string, Record<string, any[]>> = {
    Physics: {},
    Chemistry: {},
    Biology: {},
  };

  // Pre-seed known DB chapters into the map
  for (const ch of dbChapters) {
    const subjName = ch.subject?.title || "Physics";
    if (!subjectMap[subjName]) subjectMap[subjName] = {};
    if (!subjectMap[subjName][ch.title]) {
      subjectMap[subjName][ch.title] = [];
    }
  }

  // Insert real DPPs into their respective Subject and Chapter
  for (const d of dbDpps) {
    const subjName = d.subject || "Physics";
    const chapterName = d.chapter || d.chapterRef?.title || "General Practice";

    if (!subjectMap[subjName]) subjectMap[subjName] = {};
    if (!subjectMap[subjName][chapterName]) {
      subjectMap[subjName][chapterName] = [];
    }

    const latestAttempt = d.attempts?.[0];
    const status: "PENDING" | "IN_PROGRESS" | "COMPLETED" = latestAttempt
      ? latestAttempt.status === "IN_PROGRESS"
        ? "IN_PROGRESS"
        : "COMPLETED"
      : "PENDING";

    const qCount = d.questions?.length || d.questionTargetCount || 15;
    const cMarks = d.correctMarks || 4;

    subjectMap[subjName][chapterName].push({
      id: d.id,
      code: d.code,
      title: d.name,
      subject: subjName,
      chapter: chapterName,
      difficulty: d.difficulty || "MEDIUM",
      questionCount: qCount,
      durationMins: d.estimatedTimeMin || 45,
      totalMarks: qCount * cMarks,
      status,
      score: latestAttempt?.score ?? null,
    });
  }

  // Insert Batch Schedule DPPs
  for (const b of batchDpps) {
    const subjName = b.subject || "Physics";
    const chapterName = b.notes || "Live Batch Practice";

    if (!subjectMap[subjName]) subjectMap[subjName] = {};
    if (!subjectMap[subjName][chapterName]) {
      subjectMap[subjName][chapterName] = [];
    }

    const attempt = b.test?.attempts?.[0];
    const status: "PENDING" | "IN_PROGRESS" | "COMPLETED" = attempt
      ? attempt.status === "IN_PROGRESS"
        ? "IN_PROGRESS"
        : "COMPLETED"
      : "PENDING";

    subjectMap[subjName][chapterName].push({
      id: b.id,
      code: b.id.slice(-6).toUpperCase(),
      title: b.title,
      subject: subjName,
      chapter: chapterName,
      difficulty: "STANDARD",
      questionCount: 15,
      durationMins: 45,
      totalMarks: 60,
      status,
      score: attempt?.score ?? null,
      testId: b.test?.id,
    });
  }

  // Transform into final structured array for the component
  const structuredSubjects = Object.entries(subjectMap)
    .map(([subjName, chaptersObj], sIdx) => {
      const config = SUBJECT_CONFIGS[subjName] || {
        icon: "science",
        color: "text-primary",
        gradient: "from-primary to-primary-container",
        badgeBg: "bg-primary/10 text-primary border-primary/20",
      };

      const chapters = Object.entries(chaptersObj)
        .filter(([_, dppsList]) => dppsList.length > 0) // Only show chapters with real DPPs
        .map(([chTitle, dppsList], cIdx) => ({
          id: `ch-${sIdx}-${cIdx}`,
          chapterNumber: cIdx + 1,
          title: chTitle,
          dpps: dppsList,
        }));

      return {
        id: `subj-${sIdx}`,
        name: subjName,
        icon: config.icon,
        color: config.color,
        gradient: config.gradient,
        badgeBg: config.badgeBg,
        chapters,
      };
    });

  // Calculate totals from real data
  const totalAssigned = structuredSubjects.reduce(
    (sum, s) => sum + s.chapters.reduce((cSum, c) => cSum + c.dpps.length, 0),
    0
  );
  const totalCompleted = structuredSubjects.reduce(
    (sum, s) => sum + s.chapters.reduce((cSum, c) => cSum + c.dpps.filter((d) => d.status === "COMPLETED").length, 0),
    0
  );

  return (
    <div className="space-y-stack-lg max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-stack-md">
        <div>
          <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
            <span>My Courses</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-primary">DPP Portal</span>
          </p>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-2">
            Daily Practice Problems (DPP)
          </h1>
          <p className="text-on-surface-variant max-w-2xl font-body-lg">
            Practice papers assigned by your batch faculty to reinforce topics covered in lectures.
          </p>
        </div>

        <div className="w-full md:w-auto flex items-center gap-4 bg-primary-container/10 p-4 rounded-xl border border-primary/20">
          <span className="material-symbols-outlined text-primary text-4xl shrink-0">history_edu</span>
          <div>
            <div className="text-primary font-bold">Your Progress</div>
            <div className="text-on-surface-variant text-label-md">
              {totalAssigned} Assigned • {totalCompleted} Completed
            </div>
          </div>
        </div>
      </div>

      {/* Hierarchical Subject -> Chapter -> DPP Interactive View (100% Real DB Data) */}
      <DppSubjectChapterView subjects={structuredSubjects} />
    </div>
  );
}
