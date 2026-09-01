import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ChapterForm } from "@/components/team-portal/ChapterForm";

export const metadata: Metadata = {
  title: "Create Chapter",
};

export default async function NewChapterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_CREATE);
  if (!canCreate) redirect("/team/chapters");

  const courses = await prisma.course.findMany({
    include: {
      subjects: { orderBy: { title: "asc" } },
    },
    orderBy: { title: "asc" },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Create Chapter</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Select the Course/Exam, choose the Subject, and enter the chapter details. A unique 6-digit Chapter ID (starting with 6) will be generated automatically.
        </p>
      </div>
      <ChapterForm
        courses={courses.map((c) => ({
          id: c.id,
          title: c.title,
          subjects: c.subjects.map((s) => ({ id: s.id, title: s.title })),
        }))}
      />
    </div>
  );
}
