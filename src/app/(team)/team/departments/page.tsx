import type { Metadata } from "next";
import { DepartmentPositionManager } from "@/components/team-portal/DepartmentPositionManager";

export const metadata: Metadata = {
  title: "Departments & Positions Catalog — Atomic OPS",
  description: "Standardize organizational positions and department hierarchies.",
};

export default function TeamDepartmentsPage() {
  return <DepartmentPositionManager />;
}
