import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ChapterForm } from "@/components/team-portal/ChapterForm";
import type { MediumValue } from "@/lib/validation/chapter";

export const metadata: Metadata = {
  title: "Edit Chapter",
};

export default async function EditChapterPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canUpdate = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_UPDATE);
  if (!canUpdate) redirect(`/team/chapters/${params.id}`);

  const [chapter, courses] = await Promise.all([
    prisma.chapter.findUnique({
      where: { id: params.id },
      include: { subject: { include: { course: true } } },
    }),
    prisma.course.findMany({
      include: { subjects: { orderBy: { title: "asc" } } },
      orderBy: { title: "asc" },
    }),
  ]);

  if (!chapter) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Edit Chapter</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Update chapter details for <span className="font-semibold text-on-surface">{chapter.title}</span> ({chapter.chapterId ?? chapter.id}).
        </p>
      </div>
      <ChapterForm
        courses={courses.map((c) => ({
          id: c.id,
          title: c.title,
          subjects: c.subjects.map((s) => ({ id: s.id, title: s.title })),
        }))}
        initialData={{
          id: chapter.id,
          title: chapter.title,
          courseId: chapter.subject.courseId,
          subjectId: chapter.subjectId,
          medium: (chapter.medium ?? "ENGLISH") as MediumValue,
          order: chapter.order,
        }}
      />
    </div>
  );
}
