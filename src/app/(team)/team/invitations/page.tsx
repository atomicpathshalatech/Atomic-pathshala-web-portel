import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { StaffInvitationsConsole } from "@/components/team-portal/StaffInvitationsConsole";

export const metadata: Metadata = {
  title: "Staff Invitations — Atomic Pathshala",
};

const INVITABLE_ROLES = [
  "TEACHER",
  "CONTENT_CREATOR",
  "SME",
  "QUESTION_TEAM",
  "CONTENT_TEAM",
  "ACADEMIC_HEAD",
  "SALES",
  "SUPPORT",
  "FINANCE",
  "HR",
  "MARKETING",
  "DESIGNER",
  "VIDEO_EDITOR",
  "DEPARTMENT_HEAD",
  "SUB_ADMIN",
  "ADMIN",
];

export default async function TeamInvitationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const can = await hasPermission(session.user.id, PERMISSIONS.STAFF_INVITE);
  if (!can) redirect("/team");

  return <StaffInvitationsConsole invitableRoles={INVITABLE_ROLES} />;
}
