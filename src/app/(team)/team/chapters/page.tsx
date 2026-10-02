import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Plus } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ChaptersBoard, type ChapterCard } from "@/components/team-portal/ChaptersBoard";
import { chapterListWhere, getChapterScope } from "@/lib/chapters/access";

export const metadata: Metadata = {
  title: "Chapters",
};

export default async function ChaptersListPage({
  searchParams,
}: {
  searchParams: { status?: string; subject?: string; subjectId?: string; teacher?: string; q?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_READ);
  if (!canRead) redirect("/team");

  const [canCreate, canReview] = await Promise.all([
    hasPermission(session.user.id, PERMISSIONS.CHAPTER_CREATE),
    hasPermission(session.user.id, PERMISSIONS.CHAPTER_REVIEW),
  ]);

  // Teachers see only their own chapters (created by them or with a lecture
  // they teach); Super Admin / "manage all chapters" sees every chapter.
  const scope = await getChapterScope(session.user.id);
  const chapters = await prisma.chapter.findMany({
    where: chapterListWhere(scope),
    select: {
      id: true,
      chapterId: true,
      title: true,
      medium: true,
      status: true,
      updatedAt: true,
      subject: { select: { id: true, title: true, course: { select: { id: true, title: true } } } },
      _count: { select: { lectures: true, dpps: true, tests: true } },
      lectures: {
        orderBy: { order: "asc" },
        select: { teacher: { select: { id: true, displayName: true, user: { select: { name: true, photoUrl: true } } } } },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const cards: ChapterCard[] = chapters.map((ch) => {
    // Every teacher who teaches a lecture of this chapter, in lecture order.
    const teachers = new Map<string, { id: string; name: string; photo: string | null }>();
    for (const l of ch.lectures) {
      const t = l.teacher;
      if (t && !teachers.has(t.id)) teachers.set(t.id, { id: t.id, name: t.displayName || t.user?.name || "Teacher", photo: t.user?.photoUrl ?? null });
    }
    return {
      id: ch.id,
      code: ch.chapterId,
      title: ch.title,
      medium: ch.medium,
      status: ch.status,
      updatedAt: ch.updatedAt.toISOString(),
      subjectId: ch.subject?.id ?? "",
      subjectTitle: ch.subject?.title ?? "General",
      courseId: ch.subject?.course?.id ?? "",
      courseTitle: ch.subject?.course?.title ?? "",
      lectures: ch._count.lectures,
      dpps: ch._count.dpps,
      tests: ch._count.tests,
      teachers: Array.from(teachers.values()),
    };
  });

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Chapters</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {cards.length} chapter{cards.length === 1 ? "" : "s"} across {new Set(cards.map((c) => c.subjectId)).size} subject
            {new Set(cards.map((c) => c.subjectId)).size === 1 ? "" : "s"}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/team/chapters/new"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            New chapter
          </Link>
        )}
      </div>

      <ChaptersBoard
        chapters={cards}
        canReview={canReview}
        canCreate={canCreate}
        initial={{
          status: searchParams.status ?? "",
          subject: searchParams.subject ?? searchParams.subjectId ?? "",
          teacher: searchParams.teacher ?? "",
          q: searchParams.q ?? "",
        }}
      />
    </div>
  );
}
