import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { LectureForm } from "@/components/team-portal/LectureForm";

export const metadata: Metadata = {
  title: "New Lecture",
};

export default async function NewLecturePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.LECTURE_CREATE);
  if (!canCreate) redirect("/team/lectures");

  const chapters = await prisma.chapter.findMany({
    include: { subject: { include: { course: { select: { title: true } } } } },
    orderBy: { title: "asc" },
  });
  const chapterOptions = chapters.map((c) => ({
    id: c.id,
    title: c.title,
    subjectTitle: c.subject.title,
    courseTitle: c.subject.course.title,
  }));

  // Only fetch a faculty picker when the signed-in user has no Teacher
  // profile of their own — the common case (a teacher uploading their own
  // lecture) doesn't need one; the form defaults to self server-side.
  const myTeacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  let teacherOptions: { id: string; name: string; employeeCode: string }[] | null = null;
  if (!myTeacher) {
    const teachers = await prisma.teacher.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { employeeCode: "asc" },
    });
    teacherOptions = teachers.map((t) => ({ id: t.id, name: t.user.name, employeeCode: t.employeeCode }));
  }

  return (
    <div className="space-y-stack-lg max-w-3xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">New Lecture</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Uploaded as a draft. It won't be visible to students until an academic head publishes it.
        </p>
      </div>
      <LectureForm mode="create" chapterOptions={chapterOptions} teacherOptions={teacherOptions} />
    </div>
  );
}
