import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SelfProfileForm } from "@/components/team-portal/SelfProfileForm";

export const metadata: Metadata = {
  title: "My Profile",
};

export default async function MyProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <div className="space-y-stack-lg max-w-2xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">My Profile</h1>
        <p className="text-on-surface-variant font-body-md mt-1">{session.user.email}</p>
      </div>

      {!teacher ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">
          Your account doesn&apos;t have a faculty profile — this page is for teaching staff.
        </div>
      ) : (
        <>
          <div className="glass-card rounded-xl p-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-label-sm text-on-surface-variant">Employee Code</p>
              <p className="font-label-md text-on-surface">{teacher.employeeCode}</p>
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant">Department</p>
              <p className="font-label-md text-on-surface">{teacher.department}</p>
            </div>
          </div>
          <p className="text-label-sm text-on-surface-variant">
            Employee code and department are set by HR/Academic Head — contact them for changes.
          </p>
          <SelfProfileForm initialData={{ subjects: teacher.subjects, bio: teacher.bio ?? undefined }} />
        </>
      )}
    </div>
  );
}
