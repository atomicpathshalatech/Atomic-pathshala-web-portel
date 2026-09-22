import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NCERT_CHAPTERS } from "@/lib/ai-chat/ncertChapters";
import {
  AtomicPracticeTestArena,
  type SubjectChapterwiseTests,
  type TestSeriesBoxItem,
} from "@/components/student/AtomicPracticeTestArena";

export const metadata: Metadata = {
  title: "Tests & Test Series | Atomic Pathshala",
};

/**
 * Classifies a Chemistry chapter into Physical, Inorganic, or Organic
 */
function detectChemistryBranch(title: string, subjTitle?: string): "PHYSICAL" | "INORGANIC" | "ORGANIC" {
  const lowSubj = (subjTitle || "").toLowerCase();
  if (lowSubj.includes("inorganic")) return "INORGANIC";
  if (lowSubj.includes("organic")) return "ORGANIC";
  if (lowSubj.includes("physical")) return "PHYSICAL";

  const low = (title || "").toLowerCase();
  if (
    /mole|concept|basic concept|atomic structure|structure of atom|states of matter|gas|liquid|thermodynamics|energetics|thermochem|equilibrium|ionic equilibrium|chemical equilibrium|redox|oxidation|solution|colligative|electrochemistry|emf|kinetics|rate of reaction|surface chemistry|colloid|adsorption|solid state|crystal|physical/i.test(
      low
    )
  ) {
    return "PHYSICAL";
  }
  if (
    /periodic|periodicity|classification of element|bonding|molecular structure|hybridization|hydrogen|s-block|alkali|alkaline|p-block|boron|carbon family|nitrogen family|oxygen family|halogen|noble gas|d-block|f-block|transition|lanthanoid|actinoid|coordination|complex|metallurgy|isolation|mineral|extraction|environmental chemistry|pollution|salt analysis|qualitative|inorganic/i.test(
      low
    )
  ) {
    return "INORGANIC";
  }
  if (
    /organic|hydrocarbon|alkane|alkene|alkyne|aromatic|benzene|haloalkane|haloarene|alkyl halide|aryl halide|alcohol|phenol|ether|aldehyde|ketone|carboxylic|carbonyl|amine|diazonium|cyanide|isocyanide|biomolecule|carbohydrate|protein|amino acid|vitamin|nucleic acid|polymer|polymers|everyday life|drug|medicine|goc|isomerism|reaction mechanism|purification/i.test(
      low
    )
  ) {
    return "ORGANIC";
  }
  return "PHYSICAL";
}

/**
 * Classifies a Biology chapter into Botany or Zoology
 */
function detectBiologyBranch(title: string, subjTitle?: string): "BOTANY" | "ZOOLOGY" {
  const lowSubj = (subjTitle || "").toLowerCase();
  if (lowSubj.includes("botany")) return "BOTANY";
  if (lowSubj.includes("zoology")) return "ZOOLOGY";

  const low = (title || "").toLowerCase();
  if (
    /plant|photosynthesis|respiration in plant|plant growth|morphology of flowering|anatomy of flowering|biological classification|living world|transport in plant|mineral nutrition|sexual reproduction in flowering|principles of inheritance|molecular basis|genetics|dna|rna|microbes in human welfare|organism and population|ecosystem|biodiversity|environmental issue|botany|chloroplast|cell/i.test(
      low
    )
  ) {
    return "BOTANY";
  }
  if (
    /animal|human|digestion|breathing|respiration in animal|body fluid|circulation|heart|blood|excretory|urine|kidney|locomotion|movement|muscle|bone|neural|brain|neuron|chemical coordination|hormone|endocrine|human reproduction|reproductive health|evolution|human health|disease|immunity|biotechnology|zoology/i.test(
      low
    )
  ) {
    return "ZOOLOGY";
  }
  return "BOTANY";
}

export default async function StudentTestsPage() {
  const { student } = await requireStudentSession();
  const now = new Date();

  // 1. Fetch Student's Active Batch Enrollments
  let batchIds: string[] = [];
  try {
    const enrollments = await prisma.batchEnrollment.findMany({
      where: { studentId: student.id, status: "ACTIVE" },
      select: { batchId: true },
    });
    batchIds = enrollments.map((e) => e.batchId);
  } catch (err) {
    console.error("Error fetching batch enrollments:", err);
  }

  // 2. Fetch All Subjects & Chapters from DB
  let dbSubjects: any[] = [];
  try {
    dbSubjects = await prisma.subject.findMany({
      include: {
        chapters: {
          where: { status: { in: ["PUBLISHED", "READY_TO_PUBLISH", "LECTURES_COMPLETE", "DRAFT"] } },
          include: {
            tests: {
              where: { status: "PUBLISHED" },
              include: {
                attempts: {
                  where: { studentId: student.id },
                  select: { id: true, status: true, score: true },
                },
                sections: {
                  select: { _count: { select: { questions: true } } },
                },
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });
  } catch (err) {
    console.error("Error fetching subject tests:", err);
  }

  // Canonical 3 NEET Subjects initialized with all NCERT standard chapters
  const CANONICAL_SUBJECTS: Record<
    "Physics" | "Chemistry" | "Biology",
    {
      id: string;
      name: string;
      icon: string;
      color: string;
      gradient: string;
      chapters: any[];
    }
  > = {
    Physics: {
      id: "subj-physics",
      name: "Physics",
      icon: "bolt",
      color: "text-sky-500",
      gradient: "from-sky-600 to-blue-600",
      chapters: (NCERT_CHAPTERS.Physics || []).map((title, idx) => ({
        id: `ncert-phy-${idx + 1}`,
        chapterNumber: idx + 1,
        title,
        branch: "GENERAL" as const,
        branchLabel: "Physics",
        tests: [],
      })),
    },
    Chemistry: {
      id: "subj-chemistry",
      name: "Chemistry",
      icon: "science",
      color: "text-amber-500",
      gradient: "from-amber-500 to-orange-600",
      chapters: (NCERT_CHAPTERS.Chemistry || []).map((title, idx) => {
        const branch = detectChemistryBranch(title);
        const branchLabel =
          branch === "PHYSICAL"
            ? "Physical Chemistry"
            : branch === "INORGANIC"
            ? "Inorganic Chemistry"
            : "Organic Chemistry";
        return {
          id: `ncert-chem-${idx + 1}`,
          chapterNumber: idx + 1,
          title,
          branch,
          branchLabel,
          tests: [],
        };
      }),
    },
    Biology: {
      id: "subj-biology",
      name: "Biology",
      icon: "biotech",
      color: "text-emerald-500",
      gradient: "from-emerald-500 to-teal-600",
      chapters: (NCERT_CHAPTERS.Biology || []).map((title, idx) => {
        const branch = detectBiologyBranch(title);
        const branchLabel = branch === "BOTANY" ? "Botany" : "Zoology";
        return {
          id: `ncert-bio-${idx + 1}`,
          chapterNumber: idx + 1,
          title,
          branch,
          branchLabel,
          tests: [],
        };
      }),
    },
  };

  // Merge any DB chapters & chapter tests into canonical subjects
  for (const subj of dbSubjects) {
    const rawTitle = (subj.title || "").trim();
    const lowTitle = rawTitle.toLowerCase();

    if (
      lowTitle.includes("mental") ||
      lowTitle.includes("math") ||
      lowTitle.includes("foundation")
    ) {
      continue;
    }

    let targetKey: "Physics" | "Chemistry" | "Biology" | null = null;
    if (lowTitle.includes("physic")) {
      targetKey = "Physics";
    } else if (lowTitle.includes("chem")) {
      targetKey = "Chemistry";
    } else if (lowTitle.includes("bio") || lowTitle.includes("botany") || lowTitle.includes("zoology")) {
      targetKey = "Biology";
    }

    if (!targetKey) continue;

    for (const ch of subj.chapters || []) {
      const tests = (ch.tests || []).map((t: any) => {
        const attempt = t.attempts?.[0];
        const status: "PENDING" | "IN_PROGRESS" | "COMPLETED" = attempt
          ? attempt.status === "IN_PROGRESS"
            ? "IN_PROGRESS"
            : "COMPLETED"
          : "PENDING";
        const qCount =
          t.sections?.reduce((sum: number, s: any) => sum + (s._count?.questions || 0), 0) || 15;

        return {
          id: t.id,
          name: t.name,
          durationMin: t.durationMin || 45,
          questionCount: qCount,
          totalMarks: qCount * (t.correctMarks || 4),
          status,
          score: attempt?.score ?? null,
        };
      });

      // Find if chapter already exists in canonical list
      const existingCh = CANONICAL_SUBJECTS[targetKey].chapters.find(
        (c) => c.title.toLowerCase().trim() === (ch.title || "").toLowerCase().trim()
      );

      if (existingCh) {
        existingCh.tests = [...existingCh.tests, ...tests];
      } else {
        let branch: "PHYSICAL" | "INORGANIC" | "ORGANIC" | "BOTANY" | "ZOOLOGY" | "GENERAL" = "GENERAL";
        let branchLabel = "";

        if (targetKey === "Chemistry") {
          branch = detectChemistryBranch(ch.title, rawTitle);
          branchLabel =
            branch === "PHYSICAL"
              ? "Physical Chemistry"
              : branch === "INORGANIC"
              ? "Inorganic Chemistry"
              : "Organic Chemistry";
        } else if (targetKey === "Biology") {
          branch = detectBiologyBranch(ch.title, rawTitle);
          branchLabel = branch === "BOTANY" ? "Botany" : "Zoology";
        }

        CANONICAL_SUBJECTS[targetKey].chapters.push({
          id: ch.id,
          chapterNumber: CANONICAL_SUBJECTS[targetKey].chapters.length + 1,
          title: ch.title,
          branch,
          branchLabel,
          tests,
        });
      }
    }
  }

  // 3. Fetch Category 2: Test Series & Batch Test Series Boxes
  let dbTestSeries: any[] = [];
  try {
    dbTestSeries = await prisma.testSeries.findMany({
      include: {
        tests: {
          where: {
            status: { in: ["PUBLISHED", "DRAFT", "APPROVED"] },
            archived: false,
          },
          include: {
            attempts: {
              where: { studentId: student.id },
              select: { id: true, status: true, score: true },
            },
            sections: {
              select: { _count: { select: { questions: true } } },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("Error fetching test series:", err);
  }

  // Also fetch scheduled batch tests
  let batchSchedules: any[] = [];
  if (batchIds.length > 0) {
    try {
      batchSchedules = await prisma.batchSchedule.findMany({
        where: {
          batchId: { in: batchIds },
          test: { isNot: null },
        },
        include: {
          batch: { select: { id: true, name: true, code: true } },
          test: {
            include: {
              attempts: {
                where: { studentId: student.id },
                select: { id: true, status: true, score: true },
              },
              sections: {
                select: { _count: { select: { questions: true } } },
              },
            },
          },
        },
        orderBy: { startsAt: "asc" },
      });
    } catch (err) {
      console.error("Error fetching batch scheduled tests:", err);
    }
  }

  const testSeriesBoxes: TestSeriesBoxItem[] = [];

  // Map standalone & enrolled TestSeries into boxes
  for (const ts of dbTestSeries) {
    const testsList = (ts.tests || []).map((t: any) => {
      const attempt = t.attempts?.[0];
      const qCount = t.sections?.reduce((sum: number, s: any) => sum + (s._count?.questions || 0), 0) || 15;
      const isCompleted = attempt && attempt.status !== "IN_PROGRESS";
      const inProg = attempt?.status === "IN_PROGRESS";
      const openTime = t.openTime ? new Date(t.openTime) : null;
      const closeTime = t.closeTime ? new Date(t.closeTime) : null;
      const isUpcoming = Boolean((openTime && now < openTime) || (t.status === "DRAFT" && (!openTime || now < openTime)));
      const isClosed = Boolean(closeTime && now > closeTime);
      const canAttempt = !isCompleted && !inProg && !isUpcoming && !isClosed && t.status !== "DRAFT";
      const canResume = inProg && !isClosed;

      let statusLabel = "Available Now";
      let tone = "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30";

      if (isCompleted) {
        statusLabel = `Completed · ${attempt.score ?? 0} Marks`;
        tone = "bg-primary/15 text-primary border border-primary/30";
      } else if (inProg) {
        statusLabel = "In Progress";
        tone = "bg-secondary/15 text-secondary border border-secondary/30";
      } else if (isUpcoming) {
        statusLabel = openTime ? `Upcoming · ${format(openTime, "d MMM, h:mm a")}` : "Upcoming";
        tone = "bg-amber-500/15 text-amber-700 border border-amber-500/30";
      } else if (isClosed) {
        statusLabel = "Closed";
        tone = "bg-slate-500/15 text-slate-600 border border-slate-500/30";
      }

      return {
        id: t.id,
        name: t.name,
        durationMin: t.durationMin || 180,
        questionCount: qCount,
        totalMarks: qCount * (t.correctMarks || 4),
        statusLabel,
        tone,
        canAttempt,
        canResume,
        canViewResult: Boolean(isCompleted),
        isClosed,
        isUpcoming,
        score: attempt?.score ?? null,
        startsAt: openTime ? openTime.toISOString() : null,
        endsAt: closeTime ? closeTime.toISOString() : null,
      };
    });

    testSeriesBoxes.push({
      id: ts.id,
      code: ts.code,
      name: ts.name,
      examType: ts.examType || "NEET / JEE",
      description: ts.description,
      targetBatch: ts.targetBatch || ts.course || null,
      isEnrolled: true,
      tests: testsList,
    });
  }

  // If batch schedules have tests, group them into Batch Test Series Boxes
  const batchScheduleGroups: Record<string, { batchName: string; batchCode: string; tests: any[] }> = {};
  for (const bs of batchSchedules) {
    if (!bs.test) continue;
    const bId = bs.batchId;
    if (!batchScheduleGroups[bId]) {
      batchScheduleGroups[bId] = {
        batchName: bs.batch.name,
        batchCode: bs.batch.code,
        tests: [],
      };
    }

    const t = bs.test;
    const attempt = t.attempts?.[0];
    const qCount = t.sections?.reduce((sum: number, s: any) => sum + (s._count?.questions || 0), 0) || 15;
    const isCompleted = attempt && attempt.status !== "IN_PROGRESS";
    const inProg = attempt?.status === "IN_PROGRESS";
    const isUpcoming = !isCompleted && !inProg && now < bs.startsAt;
    const isClosed = now > bs.endsAt;
    const canAttempt = !isCompleted && !inProg && now >= bs.startsAt && now <= bs.endsAt;
    const canResume = inProg && now <= bs.endsAt;

    let statusLabel = "Live Now";
    let tone = "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30";

    if (isCompleted) {
      statusLabel = `Completed · ${attempt.score ?? 0} Marks`;
      tone = "bg-primary/15 text-primary border border-primary/30";
    } else if (inProg) {
      statusLabel = "In Progress";
      tone = "bg-secondary/15 text-secondary border border-secondary/30";
    } else if (isUpcoming) {
      statusLabel = `Upcoming · ${format(new Date(bs.startsAt), "d MMM, h:mm a")}`;
      tone = "bg-amber-500/15 text-amber-700 border border-amber-500/30";
    } else if (isClosed) {
      statusLabel = "Closed";
      tone = "bg-slate-500/15 text-slate-600 border border-slate-500/30";
    }

    batchScheduleGroups[bId].tests.push({
      id: t.id,
      name: t.name || bs.title,
      durationMin: t.durationMin || 180,
      questionCount: qCount,
      totalMarks: qCount * (t.correctMarks || 4),
      statusLabel,
      tone,
      canAttempt,
      canResume,
      canViewResult: Boolean(isCompleted),
      isClosed,
      isUpcoming,
      score: attempt?.score ?? null,
      startsAt: bs.startsAt?.toISOString(),
      endsAt: bs.endsAt?.toISOString(),
    });
  }

  for (const [bId, group] of Object.entries(batchScheduleGroups)) {
    testSeriesBoxes.push({
      id: `batch-ts-${bId}`,
      code: group.batchCode,
      name: `${group.batchName} — Scheduled Test Series`,
      examType: "Batch Series",
      description: "Official scheduled test papers and mock assessments for your batch.",
      targetBatch: group.batchName,
      isEnrolled: true,
      tests: group.tests,
    });
  }

  const subjectTestsList: SubjectChapterwiseTests[] = [
    CANONICAL_SUBJECTS.Physics,
    CANONICAL_SUBJECTS.Chemistry,
    CANONICAL_SUBJECTS.Biology,
  ];

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-16 px-2 sm:px-4">
      {/* Sleek Minimal Header with Back Button */}
      <div className="flex items-center gap-2.5">
        <Link
          href="/dashboard"
          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition shrink-0"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Tests &amp; Assessments
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Batch Test Series &amp; Chapterwise Practice Tests
          </p>
        </div>
      </div>

      {/* 2-Category Interactive Arena */}
      <AtomicPracticeTestArena
        subjectTests={subjectTestsList}
        testSeriesBoxes={testSeriesBoxes}
      />
    </div>
  );
}
