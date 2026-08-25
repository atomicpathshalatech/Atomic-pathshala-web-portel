import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { TestForm } from "@/components/team-portal/TestForm";

export const metadata: Metadata = {
  title: "New Test",
};

export default async function NewTestPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.TEST_CREATE);
  if (!canCreate) redirect("/team/tests");

  const isAdmin = await hasPermission(session.user.id, PERMISSIONS.TEST_PUBLISH);
  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });

  let batchIdFilter: string[] | undefined;
  if (!isAdmin) {
    const assignedBatchIds = new Set<string>();
    if (teacher) {
      const [directSchedules, batchAssignments] = await Promise.all([
        prisma.batchSchedule.findMany({ where: { teacherId: teacher.id }, select: { batchId: true } }),
        prisma.batchTeacher.findMany({ where: { teacherId: teacher.id }, select: { batchId: true } }),
      ]);
      directSchedules.forEach((s) => assignedBatchIds.add(s.batchId));
      batchAssignments.forEach((b) => assignedBatchIds.add(b.batchId));
    }
    batchIdFilter = Array.from(assignedBatchIds);
  }

  const eligibleSchedules = await prisma.batchSchedule.findMany({
    where: {
      type: "TEST",
      test: null,
      ...(batchIdFilter && { batchId: { in: batchIdFilter } }),
    },
    include: { batch: { select: { name: true } } },
    orderBy: { startsAt: "asc" },
  });

  return (
    <div className="space-y-stack-lg max-w-3xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">New Test</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Bind this test to an existing "Test" timetable slot — its start/end time becomes the
          test's open window.
        </p>
      </div>
      <TestForm
        mode="create"
        scheduleOptions={eligibleSchedules.map((s) => ({
          id: s.id,
          title: s.title,
          batchName: s.batch.name,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
        }))}
      />
    </div>
  );
}
