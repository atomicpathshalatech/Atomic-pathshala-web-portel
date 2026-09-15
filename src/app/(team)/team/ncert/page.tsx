import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import NcertAdminClient from "./NcertAdminClient";

export const metadata: Metadata = {
  title: "NCERT Practice Hub & Content Ops | Atomic Pathshala",
  description: "Manage official NCERT materials, page-wise extraction, and AI question pools",
};

export default async function NcertAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const canAccess =
    (await hasPermission(session.user.id, PERMISSIONS.CHAPTER_READ)) ||
    (await hasPermission(session.user.id, PERMISSIONS.STUDY_MATERIAL_MANAGE)) ||
    (await hasPermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS));

  if (!canAccess) {
    redirect("/team");
  }

  return <NcertAdminClient />;
}
