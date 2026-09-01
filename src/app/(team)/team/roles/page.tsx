import type { Metadata } from "next";
import { RolesPermissionMatrixView } from "@/components/team-portal/RolesPermissionMatrixView";

export const metadata: Metadata = {
  title: "Roles & Permissions Matrix — Atomic OPS",
  description: "Configure system roles, granular action permissions, and custom access profiles.",
};

export default function TeamRolesPage() {
  return <RolesPermissionMatrixView />;
}
