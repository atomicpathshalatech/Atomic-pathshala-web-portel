import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { EmployeeManagementClient } from "@/components/team-portal/EmployeeManagementClient";
import { syncFacultyToEmployees } from "@/lib/employees/employee-service";

export const metadata: Metadata = {
  title: "Employee ID & Public Verification | Atomic Pathshala",
  description: "Organizational Employee ID management, QR verification, ID cards, and official service certificates.",
};

export default async function TeamEmployeesPage() {
  await requireTeamSession();

  // Auto-sync any registered faculty or staff members so they appear automatically
  await syncFacultyToEmployees().catch((err) => {
    console.warn("[TeamEmployeesPage] Auto-sync faculty notice:", err);
  });

  // Load all employees with related stats
  const employees = await prisma.employee.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      certificates: {
        select: {
          id: true,
          certificateNumber: true,
          certificateType: true,
          issueDate: true,
          status: true,
        },
      },
      _count: {
        select: {
          certificates: true,
          verificationLogs: true,
        },
      },
    },
  });

  const total = employees.length;
  const active = employees.filter(
    (e) => e?.status === "ACTIVE" && (e?.verificationStatus === "VERIFIED" || e?.verificationStatus === "ACTIVE")
  ).length;
  const former = employees.filter((e) => e?.status === "FORMER").length;
  const revoked = employees.filter(
    (e) => e?.verificationStatus === "REVOKED" || e?.status === "TERMINATED"
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-[#0a2463] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
              ATOMIC PATHSHALA EDUCATION
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
            Employee Identity & Verification Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Internal organizational system for unique Employee IDs, QR security tokens, CR80 ID cards, and signed certificates.
          </p>
        </div>
      </div>

      {/* Main Client Workspace */}
      <EmployeeManagementClient
        initialEmployees={employees as any}
        stats={{ total, active, former, revoked }}
      />
    </div>
  );
}
      />
    </div>
  );
}
