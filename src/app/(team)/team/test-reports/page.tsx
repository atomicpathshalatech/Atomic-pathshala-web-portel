import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Award,
  Layers,
  ChevronRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Test Quality Audit Reports | Atomic Pathshala",
};

export default async function TestReportsGlobalPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.TEST_READ);
  if (!canRead) redirect("/team");

  // Fetch all tests with their latest report
  const tests = await prisma.test.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      auditStatus: true,
      updatedAt: true,
      reports: {
        orderBy: { reportVersion: "desc" },
        take: 1,
        select: {
          id: true,
          reportVersion: true,
          status: true,
          overallScore: true,
          neetAlignment: true,
          metrics: true,
          createdAt: true,
        },
      },
      sections: {
        select: {
          _count: {
            select: { questions: true },
          },
        },
      },
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Academic Test Quality Reports
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized duplicate detection, answer key validation, visual asset audit, and NEET pattern alignment.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/team/tests"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            Manage All Tests
          </Link>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            All Monitored Tests ({tests.length})
          </h2>
          <span className="text-xs text-slate-500">
            Real-time quality validation status
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Test Title & Code</th>
                <th className="py-3 px-3">Test Status</th>
                <th className="py-3 px-3">Total Questions</th>
                <th className="py-3 px-3">Audit Score</th>
                <th className="py-3 px-3">NEET Alignment</th>
                <th className="py-3 px-3">Audit State</th>
                <th className="py-3 px-3">Critical Issues</th>
                <th className="py-3 px-3">Last Audited</th>
                <th className="py-3 px-4 text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {tests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No tests found in the database.
                  </td>
                </tr>
              ) : (
                tests.map((t) => {
                  const latestReport = t.reports[0];
                  const totalQuestions = t.sections.reduce((acc, s) => acc + s._count.questions, 0);
                  const metrics = latestReport?.metrics as any;
                  const score = latestReport?.overallScore;

                  const scoreBadge =
                    score !== undefined
                      ? score >= 85
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"
                        : score >= 65
                        ? "bg-amber-50 text-amber-700 border-amber-200 font-bold"
                        : "bg-red-50 text-red-700 border-red-200 font-bold"
                      : "bg-slate-50 text-slate-400 border-slate-200";

                  const auditStateBadge =
                    t.auditStatus === "PASSED"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold"
                      : t.auditStatus === "FLAGGED"
                      ? "bg-red-100 text-red-800 border-red-300 font-semibold"
                      : t.auditStatus === "OUTDATED"
                      ? "bg-amber-100 text-amber-800 border-amber-300 font-semibold"
                      : "bg-slate-100 text-slate-600 border-slate-300";

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          href={`/team/tests/${t.id}/report`}
                          className="font-bold text-slate-900 hover:text-blue-600 transition-colors block"
                        >
                          {t.name}
                        </Link>
                        {t.code && (
                          <span className="font-mono text-[10px] text-slate-400">
                            {t.code}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {totalQuestions} Questions
                      </td>
                      <td className="py-3 px-3">
                        {score !== undefined ? (
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs border ${scoreBadge}`}>
                            {score}/100
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Not Audited</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {latestReport?.neetAlignment ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            <Award className="w-3 h-3" />
                            {latestReport.neetAlignment.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] border ${auditStateBadge}`}>
                          {t.auditStatus || "NOT_AUDITED"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {metrics?.criticalIssuesCount > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-red-600 text-xs">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {metrics.criticalIssuesCount} Issues
                          </span>
                        ) : (
                          <span className="text-emerald-600 text-xs font-semibold">0 Clean</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {latestReport ? new Date(latestReport.createdAt).toLocaleDateString() : "Never"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/team/tests/${t.id}/report`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          View Report <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
