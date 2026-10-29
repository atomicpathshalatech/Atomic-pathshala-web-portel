import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { studentRecordedAccess } from "@/lib/recorded-lectures/access";
import { watermarkLabel } from "@/lib/recorded-lectures/files";
import { RecordedLecturePlayer } from "@/components/recorded-lectures/RecordedLecturePlayer";
import { SummaryLanguageTabs } from "@/components/recorded-lectures/SummaryLanguageTabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recorded Lecture",
};

/**
 * A recorded lecture for a student: checked on the server against the
 * student's ACTIVE enrollment and the lecture's published state (changing
 * the id in the URL does not get around it), then the player (which asks
 * for its own short-lived playback URL) and the approved summary.
 */
export default async function RecordedLectureWatchPage({ params }: { params: { lectureId: string } }) {
  const { student } = await requireStudentSession();
  const lectureId = decodeURIComponent(params.lectureId).trim();

  const access = await studentRecordedAccess(student.id, lectureId);
  if (!access.ok) {
    if (access.reason === "NOT_FOUND") notFound();
    redirect(`/courses?blocked=1&reason=${encodeURIComponent(access.reason === "NOT_ENROLLED" ? "This lecture is for students of another batch." : "This lecture is not available right now.")}`);
  }

  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: {
      id: true,
      title: true,
      language: true,
      chapter: { select: { id: true, title: true, subject: { select: { id: true, title: true } } } },
      teacher: { select: { displayName: true, user: { select: { name: true } } } },
      recordedMedia: { select: { lectureNumber: true, durationSec: true } },
      summaries: { where: { status: "PUBLISHED" }, select: { content: true, language: true }, orderBy: { publishedAt: "asc" }, take: 4 },
      progress: { where: { studentId: student.id }, select: { id: true }, take: 1 },
    },
  });
  if (!lecture) notFound();

  // One published summary per language; the lecture's own language first.
  const summaries = [...lecture.summaries].sort((a, b) => Number(b.language === lecture.language) - Number(a.language === lecture.language));
  const teacher = lecture.teacher.displayName || lecture.teacher.user.name;
  const watermark = watermarkLabel(student.user.name, student.studentIdCode ?? student.enrollmentNumber);
  const backHref = `/courses/${access.batchId}`;

  return (
    <div className="max-w-5xl mx-auto space-y-5 px-0 sm:px-2 pb-10">
      <Link href={backHref} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        Back to batch
      </Link>

      <RecordedLecturePlayer lectureId={lecture.id} watermark={watermark} initiallyCompleted={lecture.progress.length > 0} />

      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
          {lecture.chapter.subject.title} · {lecture.chapter.title}
        </p>
        <h1 className="text-xl sm:text-2xl font-black text-[#031635] dark:text-white">
          {lecture.recordedMedia?.lectureNumber ? `Lecture ${String(lecture.recordedMedia.lectureNumber).padStart(2, "0")} · ` : ""}
          {lecture.title}
        </h1>
        <p className="text-sm text-slate-500">
          {teacher} · {lecture.language}
          {lecture.recordedMedia?.durationSec ? ` · ${Math.round(lecture.recordedMedia.durationSec / 60)} min` : ""}
        </p>
      </header>

      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-3">
        <h2 className="text-base font-extrabold text-[#031635] dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">summarize</span>
          Lecture Summary
        </h2>
        {summaries.length ? (
          <SummaryLanguageTabs summaries={summaries} />
        ) : (
          <p className="text-sm text-slate-500">The teacher has not published a summary for this lecture yet. The video is ready to watch.</p>
        )}
      </section>
    </div>
  );
}
