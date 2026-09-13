import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { BatchForm } from "@/components/team-portal/BatchForm";
import { CANONICAL_COURSE_SLUGS } from "@/lib/academic/canonical-courses";

export const metadata: Metadata = {
  title: "Edit Batch",
};

export default async function EditBatchPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canUpdate = await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE);
  if (!canUpdate) redirect(`/team/batches/${params.id}`);

  const batch = await prisma.batch.findUnique({ where: { id: params.id } });
  if (!batch) notFound();

  const courses = await prisma.course.findMany({
    where: { OR: [{ slug: { in: [...CANONICAL_COURSE_SLUGS] } }, ...(batch.courseId ? [{ id: batch.courseId }] : [])] },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <div className="space-y-stack-lg max-w-3xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Edit Batch</h1>
        <p className="text-on-surface-variant font-body-md mt-1">{batch.name}</p>
      </div>
      <BatchForm
        mode="edit"
        batchId={batch.id}
        courses={courses}
        initialData={{
          name: batch.name,
          code: batch.code,
          description: batch.description ?? "",
          targetExam: batch.targetExam ?? "",
          courseId: batch.courseId ?? "",
          status: batch.status,
          startDate: batch.startDate ?? undefined,
          endDate: batch.endDate ?? undefined,
          capacity: batch.capacity ?? undefined,
        }}
      />
    </div>
  );
}
