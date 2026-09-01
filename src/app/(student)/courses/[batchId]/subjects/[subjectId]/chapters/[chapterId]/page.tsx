import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isEnrolledInCourse } from "@/lib/lecture/access";
import { requiredDppCountForPosition, getSubmittedLevel1DppCount } from "@/lib/chapters/progression";

export const metadata: Metadata = {
  title: "Chapter",
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
      lectures: {
        where: { status: "PUBLISHED" },
        orderBy: { order: "asc" },
        include: { teacher: { include: { user: { select: { name: true } } } } },
      },
    },
  });
  if (!chapter || chapter.subjectId !== params.subjectId) notFound();

  const enrolled = await isEnrolledInCourse(student.id, chapter.subject.courseId);
  if (!enrolled) redirect("/courses");

  // Same lecture-driven DPP progression rule enforced on the lecture page
  // itself — computed here just to render lock state, one DPP-count query
  // total rather than one per lecture (`requiredDppCountForPosition` is a
  // pure function of position, so only the submitted count needs the DB).
  const submittedDppCount = await getSubmittedLevel1DppCount(student.id, chapter.id);
  const progressRows = chapter.lectures.length
    ? await prisma.lectureProgress.findMany({
        where: { studentId: student.id, lectureId: { in: chapter.lectures.map((l) => l.id) } },
        select: { lectureId: true },
      })
    : [];
  const completedLectureIds = new Set(progressRows.map((p) => p.lectureId));

  const lockedNoticePosition = searchParams.locked ? Number(searchParams.locked) : null;
  const lockedNoticeRequired = searchParams.required ? Number(searchParams.required) : null;
  const lockedNoticeSubmitted = searchParams.submitted ? Number(searchParams.submitted) : null;

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div>
        <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2 flex-wrap">
          <Link href="/courses" className="hover:text-primary">
            Courses
          </Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <Link href={`/courses/${params.batchId}/subjects/${chapter.subject.id}`} className="hover:text-primary">
            {chapter.subject.title}
          </Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-primary">{chapter.title}</span>
        </p>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{chapter.title}</h1>
      </div>

      {lockedNoticePosition !== null && (
        <div className="glass-card rounded-xl p-4 bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600">lock</span>
          <p className="text-body-sm text-on-surface">
            Lecture {lockedNoticePosition} is locked. Submit {lockedNoticeRequired ?? 0} Level-1 DPP
            {(lockedNoticeRequired ?? 0) === 1 ? "" : "s"} from this chapter first — you&apos;ve submitted{" "}
            {lockedNoticeSubmitted ?? 0} so far.
          </p>
        </div>
      )}

      {chapter.lectures.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No video lectures published for this chapter yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {chapter.lectures.map((l, i) => {
            const position = i + 1;
            const requiredDppCount = requiredDppCountForPosition(position);
            const unlocked = requiredDppCount === 0 || submittedDppCount >= requiredDppCount;
            const isCompleted = completedLectureIds.has(l.id);
            const href = `/courses/${params.batchId}/subjects/${chapter.subject.id}/chapters/${chapter.id}/lectures/${l.id}`;

            const cardInner = (
              <>
                <span
                  className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-label-md text-label-md ${
                    isCompleted
                      ? "bg-green-500/10 text-green-600"
                      : unlocked
                        ? "bg-primary/10 text-primary"
                        : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {isCompleted ? <span className="material-symbols-outlined text-lg">check</span> : position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-label-md text-label-md text-on-surface truncate">{l.title}</p>
                  <p className="text-label-sm text-on-surface-variant mt-0.5">
                    {unlocked
                      ? `${l.teacher.user.name} · ${l.language}`
                      : `Locked · submit ${requiredDppCount} Level-1 DPP${requiredDppCount === 1 ? "" : "s"} to unlock (${submittedDppCount}/${requiredDppCount} done)`}
                  </p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant shrink-0">
                  {unlocked ? "play_circle" : "lock"}
                </span>
              </>
            );

            return (
              <li key={l.id}>
                {unlocked ? (
                  <Link
                    href={href}
                    className="glass-card rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-all block"
                  >
                    {cardInner}
                  </Link>
                ) : (
                  <div className="glass-card rounded-xl p-4 flex items-center gap-4 opacity-70 cursor-not-allowed">
                    {cardInner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
