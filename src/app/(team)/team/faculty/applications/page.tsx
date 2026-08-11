import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ApplicationsQueue } from "@/components/team-portal/ApplicationsQueue";

export const metadata: Metadata = {
  title: "Faculty Applications",
};

export default async function FacultyApplicationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.TEACHER_READ);
  if (!canRead) redirect("/team");

  const canApprove = await hasPermission(session.user.id, PERMISSIONS.TEACHER_CREATE);

  return <ApplicationsQueue canApprove={canApprove} />;
}
