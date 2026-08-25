import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { BatchForm } from "@/components/team-portal/BatchForm";

export const metadata: Metadata = {
  title: "New Batch",
};

export default async function NewBatchPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.BATCH_CREATE);
  if (!canCreate) redirect("/team/batches");

  const courses = await prisma.course.findMany({
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <div className="space-y-stack-lg max-w-3xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">New Batch</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Create a cohort you can assign teachers to, enroll students into, and build a timetable for.
        </p>
      </div>
      <BatchForm mode="create" courses={courses} />
    </div>
  );
}
