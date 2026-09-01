import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ChapterStatusActions } from "@/components/team-portal/ChapterStatusActions";
import { ChapterContentManager } from "@/components/team-portal/ChapterContentManager";
import type { ChapterStatusValue } from "@/lib/chapters/state-machine";

export const metadata: Metadata = {
  title: "Chapter Detail",
};

export default async function ChapterDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_READ);
  if (!canRead) redirect("/team");

  const canUpdate = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_UPDATE);

  const chapter = await prisma.chapter.findUnique({
    where: { id: params.id },
    include: {
      subject: { include: { course: true } },
      lectures: {
        include: { teacher: { include: { user: { select: { name: true, email: true } } } } },
        orderBy: { order: "asc" },
      },
      dpps: {
        include: { _count: { select: { questions: true } } },
        orderBy: { level: "asc" },
      },
      tests: {
        include: { _count: { select: { sections: true, attempts: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!chapter) notFound();

  const mediumLabel =
    chapter.medium === "HINDI" ? "Hindi" : chapter.medium === "HINGLISH" ? "Hinglish" : "English";

  return (
    <div className="space-y-stack-lg max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-label-sm font-mono text-outline-variant bg-surface-container-high px-2 py-0.5 rounded">
              {chapter.chapterId ?? "—"}
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
              {mediumLabel}
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">{chapter.title}</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            {chapter.subject.title} · {chapter.subject.course?.title}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canUpdate && (
            <Link
              href={`/team/chapters/${chapter.id}/edit`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-outline-variant text-label-md hover:bg-surface-container-high transition-colors text-on-surface"
            >
              <span className="material-symbols-outlined text-base">edit</span>
              Edit Chapter
            </Link>
          )}
          <span className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-container text-on-primary-container">
            {chapter.status.replaceAll("_", " ")}
          </span>
        </div>
      </div>

      {/* Move Chapter Forward */}
      <div className="glass-card p-stack-lg rounded-xl space-y-3">
        <h3 className="font-headline-md text-headline-md text-primary">Move Chapter Forward</h3>
        <ChapterStatusActions chapterId={chapter.id} status={chapter.status as ChapterStatusValue} />
      </div>

      {/* Interactive Content Manager: Lectures, DPPs, and Chapter Tests */}
      <div className="glass-card p-stack-lg rounded-2xl space-y-4">
        <ChapterContentManager
          chapterId={chapter.id}
          chapterTitle={chapter.title}
          chapterMedium={chapter.medium}
          initialLectures={chapter.lectures.map((l) => ({
            id: l.id,
            title: l.title,
            videoUrl: l.videoUrl,
            educatorVideoUrl: l.educatorVideoUrl,
            slidesUrl: l.slidesUrl,
            language: l.language,
            order: l.order,
            status: l.status,
            createdAt: l.createdAt,
            teacher: l.teacher,
          }))}
          initialDpps={chapter.dpps.map((d) => ({
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
          initialTests={chapter.tests.map((t) => ({
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
        />
      </div>
    </div>
  );
}