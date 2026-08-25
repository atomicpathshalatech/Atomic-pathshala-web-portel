import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageLecture } from "@/lib/lecture/access";
import { LectureForm } from "@/components/team-portal/LectureForm";
import { PublishLectureButton } from "@/components/team-portal/PublishLectureButton";

export const metadata: Metadata = {
  title: "Lecture Detail",
};

export default async function LectureDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.LECTURE_READ);
  if (!canRead) redirect("/team");

  const lecture = await prisma.lecture.findUnique({
    where: { id: params.id },
    include: {
      chapter: { include: { subject: { include: { course: { select: { title: true } } } } } },
      teacher: { include: { user: { select: { name: true } } } },
      issueReports: {
        include: { student: { include: { user: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!lecture) notFound();

  const manageable = await canManageLecture(session.user.id, lecture.teacherId);
  if (!manageable) redirect("/team/lectures");

  const canUpdate = await hasPermission(session.user.id, PERMISSIONS.LECTURE_UPDATE);
  const canPublish = await hasPermission(session.user.id, PERMISSIONS.LECTURE_PUBLISH);
  const isDraft = lecture.status === "DRAFT";

  return (
    <div className="space-y-stack-lg max-w-3xl">
      <div>
        <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
          <Link href="/team/lectures" className="hover:text-primary">
            Lectures
          </Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-primary">{lecture.title}</span>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">{lecture.title}</h1>
            <p className="text-label-sm text-on-surface-variant mt-1">
              {lecture.chapter.subject.course.title} — {lecture.chapter.subject.title} — {lecture.chapter.title} ·{" "}
              {lecture.teacher.user.name} · {lecture.language}
            </p>
          </div>
          {isDraft && canPublish && <PublishLectureButton lectureId={lecture.id} />}
        </div>
      </div>

      {canUpdate && (
        <section className="glass-card rounded-2xl p-6">
          <LectureForm
            mode="edit"
            lectureId={lecture.id}
            initialData={{
              title: lecture.title,
              language: lecture.language,
              order: lecture.order,
              videoUrl: lecture.videoUrl,
              educatorVideoUrl: lecture.educatorVideoUrl,
              slidesUrl: lecture.slidesUrl,
            }}
          />
        </section>
      )}

      {lecture.issueReports.length > 0 && (
        <section className="glass-card rounded-2xl p-6 space-y-4">
          <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">report</span>
            Reported Issues ({lecture.issueReports.length})
          </h2>
          <ul className="space-y-2">
            {lecture.issueReports.map((r) => (
              <li key={r.id} className="bg-surface-container-lowest rounded-lg px-3 py-2">
                <p className="text-label-sm text-on-surface-variant">
                  {r.student.user.name} · {new Date(r.createdAt).toLocaleString()}
                </p>
                <p className="text-body-md text-on-surface mt-1">{r.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
