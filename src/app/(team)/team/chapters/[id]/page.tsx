import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ChapterTeamViewWrapper } from "@/components/team-portal/ChapterTeamViewWrapper";
import { ChapterDetailData } from "@/components/chapter-detail/ChapterDetailView";
import { RoadmapTopicGroup } from "@/components/chapter-detail/ChapterRoadmapTimeline";

export const metadata: Metadata = {
  title: "Chapter Detail",
};

export default async function ChapterDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_READ);
  if (!canRead) redirect("/team");

  const canUpdate = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_UPDATE);
  const canReviewPermission = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_REVIEW);

  const chapter = await prisma.chapter.findUnique({
    where: { id: params.id },
    include: {
      subject: { include: { course: true } },
    },
  });
  if (!chapter) notFound();

  const [user, lectures, dpps, tests, reviews] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    }),
    prisma.lecture.findMany({
      where: { chapterId: chapter.id },
      include: { teacher: { include: { user: { select: { name: true, photoUrl: true, email: true } } } } },
      orderBy: { order: "asc" },
    }),
    prisma.dpp.findMany({
      where: { chapterId: chapter.id },
      include: { _count: { select: { questions: true } } },
      orderBy: { level: "asc" },
    }),
    prisma.test.findMany({
      where: { chapterId: chapter.id },
      include: { _count: { select: { sections: true, attempts: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.chapterReview.findMany({
      where: { chapterId: chapter.id },
      include: {
        actor: { select: { name: true, email: true, photoUrl: true, role: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const isAdmin = user?.role?.name === "SUPER_ADMIN" || user?.role?.name === "ADMIN";
  const canReview = canReviewPermission && (isAdmin || chapter.createdById !== session.user.id);

  const mediumLabel =
    chapter.medium === "HINDI" ? "Hindi" : chapter.medium === "HINGLISH" ? "Hinglish" : "English";

  const firstLectureTeacher = lectures[0]?.teacher;
  const teacherName = firstLectureTeacher?.user?.name || session.user.name || "Senior Faculty";
  const teacherPhoto = firstLectureTeacher?.user?.photoUrl || null;

  // Build 1-to-1 Roadmap steps: exactly 1 lecture per step
  const roadmapGroups: RoadmapTopicGroup[] =
    lectures.length > 0
      ? lectures.map((l, idx) => ({
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
              isCompleted: false,
              isLocked: false,
            },
          ],
          notes: [
            {
              id: `notes-${l.id}`,
              title: `${l.title} — Class Notes (PDF)`,
              pdfUrl: l.slidesUrl || undefined,
            },
          ],
        }))
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

  const studentPreviewData: ChapterDetailData = {
    id: chapter.id,
    title: chapter.title,
    medium: mediumLabel,
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
      designation: `Faculty in ${chapter.subject.title} · Atomic Pathshala`,
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
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Main View Wrapper with Teacher Overview and Unified Schedule */}
      <ChapterTeamViewWrapper
        chapterId={chapter.id}
        chapterCode={chapter.chapterId}
        chapterTitle={chapter.title}
        chapterMedium={chapter.medium}
        chapterStatus={chapter.status}
        subjectTitle={chapter.subject.title}
        courseTitle={chapter.subject.course?.title}
        teacherName={teacherName}
        teacherPhoto={teacherPhoto}
        initialLectures={lectures.map((l) => ({
          id: l.id,
          title: l.title,
          videoUrl: l.videoUrl,
          educatorVideoUrl: l.educatorVideoUrl,
          slidesUrl: l.slidesUrl,
          scheduledDate: l.scheduledDate,
          startTime: l.startTime,
          endTime: l.endTime,
          durationMin: l.durationMin,
          language: l.language,
          order: l.order,
          status: l.status,
          createdAt: l.createdAt,
          teacher: l.teacher,
        }))}
        initialDpps={dpps.map((d) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          level: d.level,
          difficulty: d.difficulty,
          estimatedTimeMin: d.estimatedTimeMin,
          correctMarks: d.correctMarks,
          incorrectMarks: d.incorrectMarks,
          status: d.status,
          createdAt: d.createdAt,
          _count: d._count,
        }))}
        initialTests={tests.map((t) => ({
          id: t.id,
          code: t.code,
          name: t.name,
          durationMin: t.durationMin,
          correctMarks: t.correctMarks,
          incorrectMarks: t.incorrectMarks,
          examType: t.examType,
          status: t.status,
          createdAt: t.createdAt,
          _count: t._count,
        }))}
        canEdit={canUpdate}
        canReview={canReview}
        reviews={reviews.map((r) => ({
          id: r.id,
          action: r.action,
          comment: r.comment,
          previousStatus: r.previousStatus,
          newStatus: r.newStatus,
          createdAt: r.createdAt,
          actor: {
            name: r.actor.name,
            email: r.actor.email,
            photoUrl: r.actor.photoUrl,
            role: r.actor.role ? { name: r.actor.role.name } : null,
          },
        }))}
        studentPreviewData={studentPreviewData}
      />
    </div>
  );
}