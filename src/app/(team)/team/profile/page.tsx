import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserProfileHeaderCard } from "@/components/team-portal/UserProfileHeaderCard";
import { SelfProfileForm } from "@/components/team-portal/SelfProfileForm";
import { ProfileImagesSection } from "@/components/team-portal/ProfileImagesSection";
import { TeacherProfileChaptersSection } from "@/components/team-portal/TeacherProfileChaptersSection";

export const metadata: Metadata = {
  title: "My Profile",
};

export default async function MyProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      role: { select: { name: true, label: true } },
      teacher: true,
    },
  });

  if (!user) redirect("/login");

  const roleName = user.role?.name || (session.user as any)?.role || "TEAM_MEMBER";

  let teacherChaptersData: any[] = [];
  if (user.teacher) {
    const chapters = await prisma.chapter.findMany({
      where: {
        OR: [
          { lectures: { some: { teacherId: user.teacher.id } } },
          { createdById: user.id },
        ],
      },
      include: {
        subject: { select: { title: true, course: { select: { title: true } } } },
        _count: { select: { lectures: true } },
        batchAssignments: {
          include: { batch: { select: { id: true, name: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    });

    const displayChapters =
      chapters.length > 0
        ? chapters
        : await prisma.chapter.findMany({
            where: { status: { in: ["PUBLISHED", "APPROVED", "READY_TO_PUBLISH", "LECTURES_IN_PROGRESS"] } },
            include: {
              subject: { select: { title: true, course: { select: { title: true } } } },
              _count: { select: { lectures: true } },
              batchAssignments: {
                include: { batch: { select: { id: true, name: true } } },
              },
            },
            orderBy: { updatedAt: "desc" },
            take: 6,
          });

    teacherChaptersData = displayChapters.map((ch) => ({
      id: ch.id,
      chapterId: ch.chapterId,
      title: ch.title,
      medium: ch.medium,
      status: ch.status,
      subjectTitle: ch.subject?.title,
      courseTitle: ch.subject?.course?.title,
      lectureCount: ch._count.lectures,
      assignedBatches: ch.batchAssignments.map((bc) => ({ id: bc.batch.id, name: bc.batch.name })),
    }));
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-[#031635] dark:text-white font-black">My Profile</h1>
        <p className="text-slate-500 font-body-md mt-1">Manage your personal account identity, contact details, and credentials.</p>
      </div>

      <UserProfileHeaderCard
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          photoUrl: user.photoUrl,
          role: roleName,
          department: user.teacher?.department || undefined,
          employeeCode: user.teacher?.employeeCode || undefined,
        }}
      />

      {user.teacher ? (
        <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <TeacherProfileChaptersSection chapters={teacherChaptersData} />

          <h2 className="font-headline-md text-headline-md text-[#031635] dark:text-white font-bold pt-4 border-t border-slate-200 dark:border-slate-800">
            Faculty Credentials & Scope
          </h2>
          <div className="glass-card rounded-xl p-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-label-sm text-on-surface-variant">Employee Code</p>
              <p className="font-label-md text-on-surface font-semibold">{user.teacher.employeeCode}</p>
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant">Department</p>
              <p className="font-label-md text-on-surface font-semibold">{user.teacher.department}</p>
            </div>
          </div>
          <ProfileImagesSection
            initialPhotoUrl={user.photoUrl}
            initialCreativePngUrl={user.teacher.creativePngUrl}
            initialHasAlpha={user.teacher.creativePngHasAlpha}
          />
          <SelfProfileForm
            initialData={{
              subjects: user.teacher.subjects,
              displayName: user.teacher.displayName ?? undefined,
              targetExams: user.teacher.targetExams ?? [],
              classes: user.teacher.classes ?? [],
              languages: user.teacher.languages ?? [],
              experienceYears: user.teacher.experienceYears ?? undefined,
              qualifications: (user.teacher.qualifications as any) ?? [],
              experienceList: (user.teacher.experienceList as any) ?? [],
              bio: user.teacher.bio ?? undefined,
              photoUrl: user.photoUrl ?? undefined,
            }}
          />
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-sm text-slate-500">
          You are currently signed in with an administrative/staff role (<span className="font-bold text-slate-700 dark:text-slate-300">{roleName.replace(/_/g, " ")}</span>). You can update your name, email, phone number, and avatar photo above.
        </div>
      )}
    </div>
  );
}
