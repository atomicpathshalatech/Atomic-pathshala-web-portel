import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const metadata: Metadata = {
  title: "Lectures",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-surface-container-high text-on-surface-variant",
  PUBLISHED: "bg-primary/10 text-primary",
};

export default async function LecturesListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.LECTURE_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.LECTURE_CREATE);
  const isAdmin = await hasPermission(session.user.id, PERMISSIONS.LECTURE_PUBLISH);

  const include = {
    chapter: { include: { subject: { include: { course: { select: { title: true } } } } } },
    teacher: { include: { user: { select: { name: true } } } },
  } as const;

  let lectures;
  if (isAdmin) {
    lectures = await prisma.lecture.findMany({
      include,
      orderBy: [{ chapterId: "asc" }, { order: "asc" }],
    });
  } else {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    lectures = teacher
      ? await prisma.lecture.findMany({
          where: { teacherId: teacher.id },
          include,
          orderBy: [{ chapterId: "asc" }, { order: "asc" }],
        })
      : [];
  }

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Lectures</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            Recorded, on-demand video lectures organized by chapter. Live classes are managed separately, under
            Whiteboard.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/team/lectures/new"
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-label-md hover:opacity-90 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            New Lecture
          </Link>
        )}
      </div>

      {lectures.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No lectures yet. {canCreate && 'Upload one with "New Lecture" above.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {lectures.map((l) => (
            <li key={l.id}>
              <Link
                href={`/team/lectures/${l.id}`}
                className="glass-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 hover:shadow-md transition-all block"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                        STATUS_STYLES[l.status] ?? "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {l.status}
                    </span>
                    <span className="text-label-sm text-on-surface-variant">
                      {l.chapter.subject.course.title} — {l.chapter.subject.title} — {l.chapter.title}
                    </span>
                  </div>
                  <p className="font-label-md text-label-md text-on-surface">{l.title}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {l.teacher.user.name} · {l.language}
                  </p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
