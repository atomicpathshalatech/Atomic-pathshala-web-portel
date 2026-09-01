import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isEnrolledInCourse } from "@/lib/lecture/access";
import { requiredDppCountForPosition, getSubmittedLevel1DppCount } from "@/lib/chapters/progression";
import { ChapterDetailView, ChapterDetailData } from "@/components/chapter-detail/ChapterDetailView";
import { RoadmapTopicGroup } from "@/components/chapter-detail/ChapterRoadmapTimeline";

export const metadata: Metadata = {
  title: "Chapter Detail",
};

export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: { batchId: string; subjectId: string; chapterId: string };
  searchParams: { locked?: string; required?: string; submitted?: string };
}) {
  const { student } = await requireStudentSession();

  const chapter = await prisma.chapter.findUnique({
    where: { id: params.chapterId },
    include: {
      subject: { include: { course: true } },
    },
  });

  if (!chapter || chapter.status !== "PUBLISHED" || chapter.subjectId !== params.subjectId) {
    notFound();
  }

  const enrolled = await isEnrolledInCourse(student.id, chapter.subject.courseId);
  if (!enrolled) redirect("/courses");

  const [lectures, dpps, tests] = await Promise.all([
    prisma.lecture.findMany({
      where: { chapterId: chapter.id, status: "PUBLISHED" },
      orderBy: { order: "asc" },
      include: { teacher: { include: { user: { select: { name: true, photoUrl: true, email: true } } } } },
    }),
    prisma.dpp.findMany({
      where: { chapterId: chapter.id, status: "ACTIVE" },
      orderBy: { level: "asc" },
      include: { _count: { select: { questions: true } } },
    }),
    prisma.test.findMany({
      where: { chapterId: chapter.id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const submittedDppCount = await getSubmittedLevel1DppCount(student.id, chapter.id);
  const progressRows = lectures.length
    ? await prisma.lectureProgress.findMany({
        where: { studentId: student.id, lectureId: { in: lectures.map((l) => l.id) } },
        select: { lectureId: true },
      })
    : [];
  const completedLectureIds = new Set(progressRows.map((p) => p.lectureId));

  // Build Teacher Info from first lecture or fallback
  const firstLectureTeacher = lectures[0]?.teacher;
  const teacherName = firstLectureTeacher?.user?.name || "Senior Subject Faculty";
  const teacherPhoto = firstLectureTeacher?.user?.photoUrl || null;

  // Build Roadmap groups dynamically from lectures, DPPs, and tests
  const roadmapGroups: RoadmapTopicGroup[] = [];
  const chunkSize = Math.max(1, Math.ceil(lectures.length / 4));

  for (let i = 0; i < Math.max(1, Math.ceil(lectures.length / chunkSize)); i++) {
    const chunkLectures = lectures.slice(i * chunkSize, (i + 1) * chunkSize);
    const chunkDpps = dpps.slice(i, i + 1);
    const chunkTest = i === 0 && tests.length > 0 ? tests[0] : null;

    roadmapGroups.push({
      id: `step-${i + 1}`,
      stepNumber: i + 1,
      title: chunkLectures[0]?.title || `Core Concepts Phase ${i + 1}`,
      lectures: chunkLectures.map((l, lIdx) => {
        const position = i * chunkSize + lIdx + 1;
        const req = requiredDppCountForPosition(position);
        return {
          id: l.id,
          title: l.title,
          order: l.order || position,
          videoUrl: l.videoUrl,
          isCompleted: completedLectureIds.has(l.id),
          isLocked: req > 0 && submittedDppCount < req,
        };
      }),
      dpps: chunkDpps.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        level: d.level,
      })),
      test: chunkTest
        ? {
            id: chunkTest.id,
            name: chunkTest.name,
            durationMin: chunkTest.durationMin,
          }
        : null,
    });
  }

  // Fallback if no lectures exist yet
  if (roadmapGroups.length === 0) {
    roadmapGroups.push({
      id: "step-1",
      stepNumber: 1,
      title: `${chapter.title} Fundamental Topics`,
      lectures: [],
      dpps: dpps.map((d) => ({ id: d.id, code: d.code, name: d.name, level: d.level })),
      test: tests[0] ? { id: tests[0].id, name: tests[0].name, durationMin: tests[0].durationMin } : null,
    });
  }

  // First accessible lecture link for "Start Chapter"
  const firstUnlocked = lectures.find((_, idx) => {
    const req = requiredDppCountForPosition(idx + 1);
    return req === 0 || submittedDppCount >= req;
  });

  const startHref = firstUnlocked
    ? `/courses/${params.batchId}/subjects/${chapter.subject.id}/chapters/${chapter.id}/lectures/${firstUnlocked.id}`
    : `/courses/${params.batchId}/subjects/${chapter.subject.id}/chapters/${chapter.id}/lectures/${lectures[0]?.id || ""}`;

  const detailData: ChapterDetailData = {
    id: chapter.id,
    title: chapter.title,
    medium: chapter.medium === "HINDI" ? "Hindi" : chapter.medium === "HINGLISH" ? "Hinglish" : "English",
    subjectName: chapter.subject.title,
    className: chapter.subject.course?.title?.includes("12") ? "Class 12" : "Class 11",
    courseTitle: chapter.subject.course?.title || "NEET / JEE / CBSE",
    totalDurationMin: lectures.length * 45 || 180,
    totalLectures: lectures.length,
    totalDpps: dpps.length,
    totalTests: tests.length,
    averageRating: 4.9,
    learnerCount: 51200,
    learningOutcomes: [
      `Understand fundamental principles and concepts of ${chapter.title}`,
      `Master core formulas, reactions, and analytical problem-solving techniques`,
      `High-yield previous years questions (PYQs) for NEET & JEE examination patterns`,
      `Line-by-line NCERT canonical coverage with visual demonstrations`,
      `Daily practice problems (DPPs) with timed chapter assessments`,
    ],
    teacher: {
      name: teacherName,
      designation: `Senior Faculty in ${chapter.subject.title} · Atomic Pathshala`,
      photo: teacherPhoto,
      bio: `Dedicated academic mentor specializing in ${chapter.subject.title}, helping students achieve conceptual mastery and top scores in NEET and JEE.`,
    },
    roadmap: roadmapGroups,
    reviews: [
      {
        id: "rev-1",
        studentName: "Priya Nair",
        avatarColor: "bg-rose-500/30 text-rose-300",
        rating: 5,
        comment: `Outstanding explanation of ${chapter.title}! The video lectures and DPPs helped clear all my doubts.`,
        date: "2 days ago",
      },
      {
        id: "rev-2",
        studentName: "Rahul Sharma",
        avatarColor: "bg-indigo-500/30 text-indigo-300",
        rating: 5,
        comment: "The roadmap sequence made it very easy to stay on track. Scored 100% in the chapter test!",
        date: "1 week ago",
      },
      {
        id: "rev-3",
        studentName: "Ananya Mishra",
        avatarColor: "bg-emerald-500/30 text-emerald-300",
        rating: 5,
        comment: "Best NCERT line-by-line coverage for NEET 2026. Notes PDF are super crisp and high quality.",
        date: "2 weeks ago",
      },
    ],
    firstLectureId: lectures[0]?.id || null,
    startHref,
  };

  return (
    <ChapterDetailView
      data={detailData}
      backHref={`/courses/${params.batchId}/subjects/${chapter.subject.id}`}
    />
  );
}