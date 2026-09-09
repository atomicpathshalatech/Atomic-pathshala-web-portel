import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { StudyMaterialManager } from "@/components/team-portal/StudyMaterialManager";

export const metadata: Metadata = {
  title: "Study Material — Atomic Pathshala",
};

export default async function TeamStudyMaterialPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canManage = await hasPermission(session.user.id, PERMISSIONS.STUDY_MATERIAL_MANAGE);
  if (!canManage) redirect("/team");

  return <StudyMaterialManager />;
}
