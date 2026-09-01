import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { DppForm } from "@/components/team-portal/DppForm";

export const metadata: Metadata = {
  title: "Create DPP",
};

export default async function NewDppPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.DPP_CREATE);
  if (!canCreate) redirect("/team/dpp");

  const subjects = await prisma.subject.findMany({
    include: { chapters: { select: { id: true, title: true } } },
    orderBy: { title: "asc" },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Create DPP</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          A unique code (e.g. AP0001) will be generated automatically.
        </p>
      </div>
      <DppForm subjects={subjects} defaultFacultyName={session.user.name ?? undefined} />
    </div>
  );
}
