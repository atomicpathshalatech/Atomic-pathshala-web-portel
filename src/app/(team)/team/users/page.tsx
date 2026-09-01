import type { Metadata } from "next";
import { UserManagementConsole } from "@/components/team-portal/UserManagementConsole";

export const metadata: Metadata = {
  title: "User Management & RBAC — Atomic OPS",
  description: "Enterprise user directory, role configurations, and access controls.",
};

export default function TeamUsersPage() {
  return <UserManagementConsole />;
}
