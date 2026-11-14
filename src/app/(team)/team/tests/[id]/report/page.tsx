import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest } from "@/lib/test-engine/access";
import { TestAuditDashboard } from "@/components/test-audit/TestAuditDashboard";
import { ChevronLeft, ShieldCheck, ArrowRight } from "lucide-react";
import { runTestAudit } from "@/lib/test-audit/audit-engine";

export const metadata: Metadata = {
  title: "Test Quality Audit Report | Atomic Pathshala",
};

export default async function TestReportPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.TEST_READ);
  if (!canRead) redirect("/team");

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      auditStatus: true,
      batchScheduleId: true,
      updatedAt: true,
    },
  });

  if (!test) notFound();

  const manageable = await canManageTest(session.user.id, test.batchScheduleId);
  if (!manageable) redirect("/team/tests");

  // Fetch latest report
  let report = await prisma.testAuditReport.findFirst({
    where: { testId: params.id },
    orderBy: { reportVersion: "desc" },
    include: {
      questionAudits: {
        orderBy: { questionNumber: "asc" },
        include: {
          question: {
            select: {
              id: true,
              questionCode: true,
              subject: true,
              chapter: true,
              difficulty: true,
              imageUrl: true,
              referenceImageUrl: true,
              translations: {
                select: {
                  language: true,
                  statement: true,
                  options: true,
                  correctOptionIds: true,
                  solution: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // If test has never been audited, run initial audit automatically
  if (!report) {
    try {
      await runTestAudit({
        testId: params.id,
        userId: session.user.id,
      });

      report = await prisma.testAuditReport.findFirst({
        where: { testId: params.id },
        orderBy: { reportVersion: "desc" },
        include: {
          questionAudits: {
            orderBy: { questionNumber: "asc" },
            include: {
              question: {
                select: {
                  id: true,
                  questionCode: true,
                  subject: true,
                  chapter: true,
                  difficulty: true,
                  imageUrl: true,
                  referenceImageUrl: true,
                  translations: {
                    select: {
                      language: true,
                      statement: true,
                      options: true,
                      correctOptionIds: true,
                      solution: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    } catch (e) {
      console.error("[Test Report] Auto audit run error:", e);
    }
  }

  const initialData = {
    audited: Boolean(report),
    test,
    report,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Link
            href={`/team/tests/${params.id}`}
            className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Test Details
          </Link>
          <span>/</span>
          <Link href="/team/test-reports" className="hover:text-slate-900 transition-colors">
            All Test Reports
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-800">Quality Audit</span>
        </div>

        <Link
          href={`/team/tests/${params.id}`}
          className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
        >
          Manage Test Questions <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <TestAuditDashboard testId={params.id} initialData={initialData} />
    </div>
  );
}
