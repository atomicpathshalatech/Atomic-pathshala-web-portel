import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ChapterStatusActions } from "@/components/team-portal/ChapterStatusActions";
import type { ChapterStatusValue } from "@/lib/chapters/state-machine";

export const metadata: Metadata = {
  title: "Chapter Detail",
};

export default async function ChapterDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_READ);
  if (!canRead) redirect("/team");

  const chapter = await prisma.chapter.findUnique({
    where: { id: params.id },
    include: {
      subject: { include: { course: true } },
      lectures: { orderBy: { order: "asc" } },
      dpps: { orderBy: { level: "asc" } },
      tests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!chapter) notFound();

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <p className="text-label-sm text-outline-variant">{chapter.chapterId ?? "—"}</p>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">{chapter.title}</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            {chapter.subject.title} · {chapter.subject.course?.title}
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-container text-on-primary-container">
          {chapter.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="glass-card p-stack-lg rounded-xl space-y-3">
        <h3 className="font-headline-md text-headline-md text-primary">Move Chapter Forward</h3>
        <ChapterStatusActions chapterId={chapter.id} status={chapter.status as ChapterStatusValue} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-gutter">
        <div className="glass-card p-4 rounded-xl">
          <p className="text-label-sm text-on-surface-variant">Lectures</p>
          <p className="text-headline-sm font-headline-sm text-primary">{chapter.lectures.length}</p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-label-sm text-on-surface-variant">DPPs</p>
          <p className="text-headline-sm font-headline-sm text-primary">{chapter.dpps.length}</p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-label-sm text-on-surface-variant">Chapter Tests</p>
          <p className="text-headline-sm font-headline-sm text-primary">{chapter.tests.length}</p>
        </div>
      </div>

      {chapter.lectures.length > 0 && (
        <div className="glass-card rounded-xl p-stack-lg space-y-stack-md">
          <h3 className="font-headline-md text-headline-md text-primary">Lectures</h3>
          <ol className="space-y-2 list-decimal list-inside">
            {chapter.lectures.map((l) => (
              <li key={l.id} className="text-body-md flex items-center justify-between gap-2">
                <span>{l.title}</span>
                <span className="text-label-sm text-on-surface-variant">{l.status}</span>
              </li>
            ))}
          </ol>
          <Link href="/team/lectures/new" className="text-label-sm text-primary hover:underline">
            + Add a lecture to this chapter
          </Link>
        </div>
      )}

      {chapter.dpps.length > 0 && (
        <div className="glass-card rounded-xl p-stack-lg space-y-stack-md">
          <h3 className="font-headline-md text-headline-md text-primary">DPPs</h3>
          <ol className="space-y-2 list-decimal list-inside">
            {chapter.dpps.map((d) => (
              <li key={d.id} className="text-body-md flex items-center justify-between gap-2">
                <span>
                  {d.name} {d.level ? `· Level ${d.level}` : ""}
                </span>
                <span className="text-label-sm text-on-surface-variant">{d.status}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
