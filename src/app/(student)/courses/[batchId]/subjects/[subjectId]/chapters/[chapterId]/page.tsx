import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isEnrolledInCourse } from "@/lib/lecture/access";
import { requiredDppCountForPosition, getSubmittedLevel1DppCount } from "@/lib/chapters/progression";
import { ChapterDetailView, ChapterDetailData } from "@/components/chapter-detail/ChapterDetailView";
import { RoadmapTopicGroup } from "@/components/chapter-detail/ChapterRoadmapTimeline";

import { getEffectiveScheduleStatus } from "@/lib/schedule/access-rules";

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

  if (!chapter || (chapter.status !== "PUBLISHED" && chapter.status !== "APPROVED") || chapter.subjectId !== params.subjectId) {
    notFound();
  }

  const enrolled =
    (await isEnrolledInCourse(student.id, chapter.subject.courseId)) ||
    (await prisma.batchEnrollment.count({
      where: {
        studentId: student.id,
        status: "ACTIVE",
      },
    })) > 0;
  if (!enrolled) redirect("/courses");

  const [lectures, standaloneSchedules, dpps, tests, notices] = await Promise.all([
    prisma.lecture.findMany({
      where: {
        chapterId: chapter.id,
        status: { in: ["PUBLISHED", "DRAFT"] },
      },
      orderBy: { order: "asc" },
      include: {
        teacher: { include: { user: { select: { name: true, photoUrl: true, email: true } } } },
        batchSchedules: {
          include: {
            liveWhiteboardSession: {
              select: {
                id: true,
                status: true,
                livePhase: true,
                recordingStatus: true,
                recordingStorageKey: true,
              },
            },
          },
        },
      },
    }),
    prisma.batchSchedule.findMany({
      where: {
        chapterId: chapter.id,
        batchId: params.batchId,
        lectureId: null,
      },
      orderBy: { startsAt: "asc" },
      include: {
        teacher: { include: { user: { select: { name: true, photoUrl: true, email: true } } } },
        liveWhiteboardSession: {
          select: {
            id: true,
            status: true,
            livePhase: true,
            recordingStatus: true,
            recordingStorageKey: true,
          },
        },
      },
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
    prisma.chapterNotice.findMany({
      where: { chapterId: chapter.id },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
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
  const firstLectureTeacher = lectures[0]?.teacher || standaloneSchedules[0]?.teacher;
  const teacherName = firstLectureTeacher?.user?.name || "Senior Subject Faculty";
  const teacherPhoto = firstLectureTeacher?.user?.photoUrl || null;

  // Build 1-to-1 Roadmap steps: from lectures and standalone scheduled live classes
  const lectureSteps: RoadmapTopicGroup[] = lectures.map((l, idx) => {
    const matchedSchedule =
      l.batchSchedules?.find((s) => s.batchId === params.batchId) ||
      l.batchSchedules?.[0];

    let isCancelled = false;
    if (matchedSchedule) {
      const effStatus = getEffectiveScheduleStatus(matchedSchedule);
      if (
        effStatus === "CANCELLED" ||
        matchedSchedule.status === "CANCELLED" ||
        matchedSchedule.liveWhiteboardSession?.livePhase === "CANCELLED"
      ) {
        if (!l.videoUrl && matchedSchedule.liveWhiteboardSession?.recordingStatus !== "READY") {
          isCancelled = true;
        }
      }
    }

    return {
      id: `step-${l.id}`,
      stepNumber: l.order || idx + 1,
      title: l.title || `${chapter.title} Lec : ${String(idx + 1).padStart(2, "0")}`,
      lectures: [
        {
          id: l.id,
          title: l.title,
          order: l.order || idx + 1,
          videoUrl: l.videoUrl,
          notesUrl: l.slidesUrl,
          slidesUrl: l.slidesUrl,
          isCompleted: completedLectureIds.has(l.id),
          isLocked: false,
          isCancelled,
        },
      ],
      notes: [
        {
          id: `notes-${l.id}`,
          title: `${l.title} — Class Notes (PDF)`,
          pdfUrl: l.slidesUrl || undefined,
        },
      ],
    };
  });

  // Add any standalone batch schedules for this chapter
  const standaloneSteps: RoadmapTopicGroup[] = standaloneSchedules.map((s, idx) => {
    const effStatus = getEffectiveScheduleStatus(s);
    const isCancelled =
      (effStatus === "CANCELLED" ||
        s.status === "CANCELLED" ||
        s.liveWhiteboardSession?.livePhase === "CANCELLED") &&
      s.liveWhiteboardSession?.recordingStatus !== "READY";

    const stepNum = lectureSteps.length + idx + 1;
    return {
      id: `step-sched-${s.id}`,
      stepNumber: stepNum,
      title: s.title || `${chapter.title} Live Session : ${String(stepNum).padStart(2, "0")}`,
      lectures: [
        {
          id: s.id,
          title: s.title,
          order: stepNum,
          videoUrl: `/live-class/${s.id}`,
          isCompleted: effStatus === "COMPLETED",
          isLocked: false,
          isCancelled,
        },
      ],
      notes: [],
    };
  });

  const combinedSteps = [...lectureSteps, ...standaloneSteps];

  const roadmapGroups: RoadmapTopicGroup[] =
    combinedSteps.length > 0
      ? combinedSteps
      : [
          {
            id: "step-1",
            stepNumber: 1,
            title: `${chapter.title} Lec : 01`,
            lectures: [
              {
                id: "lec-demo-1",
                title: `${chapter.title} Lec : 01`,
                order: 1,
                videoUrl: "#",
                isCompleted: false,
                isLocked: false,
              },
            ],
            notes: [
              {
                id: "notes-demo-1",
                title: `${chapter.title} Lec : 01 — Class Notes (PDF)`,
              },
            ],
          },
        ];

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
        avatarColor: "bg-blue-500/30 text-blue-300",
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
    notices: notices.map((n) => ({
      id: n.id,
      chapterId: n.chapterId,
      title: n.title,
      content: n.content,
      category: n.category,
      isPinned: n.isPinned,
      authorName: n.authorName,
      authorRole: n.authorRole,
      createdAt: n.createdAt.toISOString(),
    })),
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