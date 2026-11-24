import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import Link from "next/link";
import { ArrowLeft, Printer, ShieldCheck } from "lucide-react";
import { PrintButton } from "@/components/team-portal/PrintButton";

export const metadata: Metadata = {
  title: "Employee Payslip",
};

export default async function PayslipPage({
  params,
}: {
  params: { itemId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const item = await prisma.payrollItem.findUnique({
    where: { id: params.itemId },
    include: {
      payrollRun: true,
      employee: true,
    },
  });

  if (!item) {
    redirect("/team/hr/payroll");
  }

  const isOwner = item.employee.userId === session.user.id;
  const canViewAny = await hasPermission(session.user.id, PERMISSIONS.HR_PAYSLIP_VIEW_ANY);

  if (!isOwner && !canViewAny) {
    redirect("/team");
  }

  const profile = await prisma.businessProfile.findFirst({
    orderBy: { createdAt: "desc" },
  });

  const gstSetting = await prisma.gstSetting.findFirst({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-800">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Action Bar */}
        <div className="flex items-center justify-between no-print">
          <Link
            href="/team/hr/payroll"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Payroll
          </Link>
          <PrintButton />
        </div>

        {/* Payslip Card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 print:shadow-none print:border-none">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start border-b border-slate-200 pb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {profile?.tradeName || "Atomic Pathshala"}
              </h1>
              <p className="text-xs text-slate-500 font-mono">
                {profile?.legalName || "Atomic Pathshala Education Private Limited"}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                {profile?.registeredAddress || "Civil Lines, Rampur, Uttar Pradesh - 244901"}
              </p>
              {gstSetting?.registrationStatus === "ACTIVE" && gstSetting.gstin && (
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  GSTIN: {gstSetting.gstin}
                </p>
              )}
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200 uppercase tracking-wide">
                Salary Slip
              </span>
              <p className="text-lg font-bold text-slate-900 mt-2">
                {item.payrollRun.title}
              </p>
              <p className="text-xs font-mono text-slate-500">
                Payslip No: {item.payslipNumber}
              </p>
              <p className="text-xs text-slate-500">
                Status: <span className="font-semibold text-emerald-600">{item.payoutStatus}</span>
              </p>
            </div>
          </div>

          {/* Employee & Bank Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-b border-slate-200 text-xs">
            <div>
              <p className="text-slate-500">Employee Name</p>
              <p className="font-semibold text-slate-900 text-sm mt-0.5">{item.employee.name}</p>
              <p className="text-slate-500 font-mono mt-1">ID: {item.employee.employeeId}</p>
            </div>
            <div>
              <p className="text-slate-500">Department & Designation</p>
              <p className="font-semibold text-slate-900 text-sm mt-0.5">{item.employee.designation}</p>
              <p className="text-slate-500 mt-1">{item.employee.department}</p>
            </div>
            <div>
              <p className="text-slate-500">Bank Details</p>
              <p className="font-semibold text-slate-900 mt-0.5">
                {item.bankName || "Bank Transfer"}
              </p>
              <p className="text-slate-500 font-mono mt-1">
                A/C: {item.bankAccountNumberMasked || "••••••••4589"}
              </p>
              <p className="text-slate-500 font-mono">
                IFSC: {item.bankIfsc || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Attendance & Days</p>
              <p className="font-semibold text-slate-900 mt-0.5">
                Working Days: {item.workingDays}
              </p>
              <p className="text-slate-500 mt-1">
                Present: {Number(item.presentDays)} | Leave: {Number(item.unpaidLeaves)}
              </p>
              {item.paymentMode === "PER_LECTURE" && (
                <p className="text-slate-500">Lectures: {item.lecturesDelivered}</p>
              )}
            </div>
          </div>

          {/* Earnings & Deductions Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
            {/* Earnings */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Earnings (A)
              </h2>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 text-slate-600">Base Salary / Lecture Earnings</td>
                    <td className="py-2 text-right font-medium text-slate-900">
                      ₹{Number(item.basePay).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  {Number(item.hra) > 0 && (
                    <tr>
                      <td className="py-2 text-slate-600">House Rent Allowance (HRA)</td>
                      <td className="py-2 text-right font-medium text-slate-900">
                        ₹{Number(item.hra).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                  {Number(item.allowances) > 0 && (
                    <tr>
                      <td className="py-2 text-slate-600">Special & Other Allowances</td>
                      <td className="py-2 text-right font-medium text-slate-900">
                        ₹{Number(item.allowances).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                  {Number(item.incentives) > 0 && (
                    <tr>
                      <td className="py-2 text-slate-600">Performance Incentives</td>
                      <td className="py-2 text-right font-medium text-slate-900">
                        ₹{Number(item.incentives).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-slate-200 font-semibold bg-slate-50">
                    <td className="py-2 px-2 text-slate-900">Gross Earnings</td>
                    <td className="py-2 px-2 text-right text-slate-900">
                      ₹{Number(item.grossPay).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Deductions */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Deductions (B)
              </h2>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 text-slate-600">Provident Fund (PF)</td>
                    <td className="py-2 text-right font-medium text-slate-900">
                      ₹{Number(item.pfDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">Employee State Insurance (ESI)</td>
                    <td className="py-2 text-right font-medium text-slate-900">
                      ₹{Number(item.esiDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">Tax Deducted at Source (TDS)</td>
                    <td className="py-2 text-right font-medium text-slate-900">
                      ₹{Number(item.tdsDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  {Number(item.leaveDeduction) > 0 && (
                    <tr>
                      <td className="py-2 text-slate-600">Unpaid Leave Deduction</td>
                      <td className="py-2 text-right font-medium text-slate-900">
                        ₹{Number(item.leaveDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-slate-200 font-semibold bg-slate-50">
                    <td className="py-2 px-2 text-slate-900">Total Deductions</td>
                    <td className="py-2 px-2 text-right text-slate-900">
                      ₹{Number(item.totalDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Net Salary Banner */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex justify-between items-center mt-4">
            <div>
              <p className="text-xs font-semibold text-indigo-900 uppercase tracking-wider">
                Net Pay (A - B)
              </p>
              <p className="text-xs text-indigo-700 mt-0.5">
                Disbursed to linked bank account
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-indigo-950 font-mono">
                ₹{Number(item.netPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Footer & Verification */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Digitally verified computer-generated payslip. No signature required.</span>
            </div>
            <div>
              <span>Generated on {new Date(item.createdAt).toLocaleDateString("en-IN")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
