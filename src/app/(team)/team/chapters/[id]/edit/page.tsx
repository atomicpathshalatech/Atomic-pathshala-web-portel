import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ChapterForm } from "@/components/team-portal/ChapterForm";
import type { MediumValue } from "@/lib/validation/chapter";
import { CANONICAL_COURSE_SLUGS } from "@/lib/academic/canonical-courses";

export const metadata: Metadata = {
  title: "Edit Chapter",
};

export default async function EditChapterPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canUpdate = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_UPDATE);
  if (!canUpdate) redirect(`/team/chapters/${params.id}`);

  const chapter = await prisma.chapter.findUnique({
    where: { id: params.id },
    include: { subject: { include: { course: true } } },
  });
  if (!chapter) notFound();

  // Canonical list, plus this chapter's own current course even if it's
  // not one of the four (e.g. a pre-existing chapter under the excluded
  // "Foundation" course) — otherwise the edit form would load with a
  // selected course value missing from its own dropdown options.
  const courses = await prisma.course.findMany({
    where: { OR: [{ slug: { in: [...CANONICAL_COURSE_SLUGS] } }, { id: chapter.subject.courseId }] },
    include: { subjects: { orderBy: { title: "asc" } } },
    orderBy: { title: "asc" },
  });

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
          description: chapter.description,
          learningObjectives: chapter.learningObjectives,
          prerequisites: chapter.prerequisites,
        }}
      />
    </div>
  );
}
