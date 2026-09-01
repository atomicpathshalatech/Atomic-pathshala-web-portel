import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { BatchCreatorWizard } from "@/components/team-portal/BatchCreatorWizard";

export const metadata: Metadata = {
  title: "Create High-End Batch",
};

export default async function NewBatchPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canCreate =
    (await hasPermission(session.user.id, PERMISSIONS.BATCH_CREATE)) ||
    (await hasPermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS));

  if (!canCreate) redirect("/team/batches");

  const [courses, teachers] = await Promise.all([
    prisma.course.findMany({
      select: { id: true, title: true, slug: true },
      orderBy: { title: "asc" },
    }),
    prisma.teacher.findMany({
      select: {
        id: true,
        employeeCode: true,
        department: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1">
          <Link href="/team/batches" className="hover:text-primary transition-colors">
            Batches
          </Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span>New Batch Wizard</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg font-bold text-primary">
          High-End Batch Creator &amp; Academic Flow
        </h1>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Configure cohort details, link to courses, assign educators, and launch with zero duplicate master content.
        </p>
      </div>

      <BatchCreatorWizard courses={courses} teachers={teachers} />
    </div>
  );
}
