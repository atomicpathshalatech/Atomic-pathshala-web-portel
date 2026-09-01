import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ContractCreatorForm } from "@/components/team-portal/ContractCreatorForm";

export const metadata: Metadata = {
  title: "Create Employee Agreement",
};

export default async function NewContractPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canCreate =
    (await hasPermission(session.user.id, PERMISSIONS.CONTRACT_CREATE)) ||
    (await hasPermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS));

  if (!canCreate) {
    redirect("/team/contracts");
  }

  const teachers = await prisma.teacher.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1">
            <Link href="/team/contracts" className="hover:text-primary transition-colors">
              Contracts
            </Link>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span>New Agreement</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary">
            Generate Educator / Employee Agreement
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Select an educator to auto-fill their profile data, customize deliverables and compensation, and dispatch for secure electronic signature.
          </p>
        </div>
      </div>

      <ContractCreatorForm teachers={teachers} />
    </div>
  );
}
