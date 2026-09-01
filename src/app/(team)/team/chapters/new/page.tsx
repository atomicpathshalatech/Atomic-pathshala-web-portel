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

  const subjects = await prisma.subject.findMany({
    include: { course: true },
    orderBy: { title: "asc" },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Create Chapter</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          A unique 6-digit Chapter ID (starting with 6) will be generated automatically.
        </p>
      </div>
      <ChapterForm
        subjects={subjects.map((s) => ({ id: s.id, title: s.title, courseTitle: s.course.title }))}
      />
    </div>
  );
}
