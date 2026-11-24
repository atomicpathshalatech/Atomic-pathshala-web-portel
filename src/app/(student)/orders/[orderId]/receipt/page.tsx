import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PrintInvoiceButton } from "@/components/student/PrintInvoiceButton";
import { COMPANY_GST_DETAILS, calculateGstBreakdown } from "@/lib/invoicing/gst";
import QRCode from "qrcode";

export const metadata: Metadata = {
  title: "Tax Invoice & Fee Receipt — Atomic Pathshala",
};

export default async function BatchOrderReceiptPage({ params }: { params: { orderId: string } }) {
  const { student } = await requireStudentSession();

  const order = await prisma.batchOrder.findUnique({
    where: { id: params.orderId },
    include: {
      batch: true,
      student: { include: { user: true } },
      coupon: { select: { code: true, value: true, type: true } },
      refunds: { where: { status: "SUCCESS" } },
    },
  });

  if (!order || order.studentId !== student.id) {
    notFound();
  }

  if (order.status !== "SUCCESS" || !order.invoiceNumber) {
    redirect("/subscription/billing");
  }

  const refundedAmount = order.refunds.reduce((sum, r) => sum + r.amount, 0);
  const gst = calculateGstBreakdown(order.amount, null);

  const verificationPayload = JSON.stringify({
    invoiceNumber: order.invoiceNumber,
    orderNumber: order.orderNumber,
    studentId: order.student.studentIdCode,
    amount: order.amount,
    date: order.createdAt.toISOString(),
    gstin: COMPANY_GST_DETAILS.gstin,
  });

  let qrCodeDataUrl = "";
  try {
    qrCodeDataUrl = await QRCode.toDataURL(verificationPayload, { width: 120, margin: 1 });
  } catch {}

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 px-4 font-sans">
      {/* Non-printed header navigation */}
      <div className="print:hidden flex items-center justify-between">
        <Link href="/subscription/billing" className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Billing History
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium">Original for Recipient</span>
          <PrintInvoiceButton />
        </div>
      </div>

      {/* Official Tax Invoice Document */}
      <div className="bg-white border border-slate-200 print:border-none print:shadow-none rounded-3xl p-8 md:p-12 space-y-8 shadow-lg text-[#121c2c]">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6 border-b border-slate-200 pb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-3xl">science</span>
              <span className="text-2xl font-black text-[#031635] tracking-tight">
                {COMPANY_GST_DETAILS.brandName}
              </span>
            </div>
            <p className="text-xs font-bold text-primary uppercase tracking-wider mt-1">
              Course Fee Tax Invoice &amp; Receipt
            </p>
            <p className="text-xs text-slate-500 max-w-sm mt-2 leading-relaxed">
              {COMPANY_GST_DETAILS.legalName}
              <br />
              {COMPANY_GST_DETAILS.address}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-2 font-mono">
              <span><b>GSTIN:</b> {COMPANY_GST_DETAILS.gstin}</span>
              <span><b>PAN:</b> {COMPANY_GST_DETAILS.pan}</span>
            </div>
          </div>

          <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4">
            {qrCodeDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrCodeDataUrl}
                alt="Digital Verification QR"
                className="w-24 h-24 rounded-xl border border-slate-200 p-1 bg-white"
              />
            )}
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Invoice Number</p>
              <p className="font-mono text-sm font-black text-[#031635]">{order.invoiceNumber}</p>
              {order.orderNumber && (
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">Order: {order.orderNumber}</p>
              )}
            </div>
          </div>
        </div>

        {/* Student & Payment Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs border-b border-slate-200 pb-8">
          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-400 uppercase font-black tracking-wider">Billed To (Student)</p>
            <p className="font-black text-sm text-[#031635]">{order.student.user.name}</p>
            <p className="text-slate-600 font-mono">ID: {order.student.studentIdCode} · Roll: {order.student.enrollmentNumber}</p>
            <p className="text-slate-600">Email: {order.student.user.email}</p>
            {order.student.user.phone && <p className="text-slate-600">Phone: {order.student.user.phone}</p>}
            <p className="text-slate-600">Class: {order.student.class} · Exam: {order.student.targetExam}</p>
          </div>

          <div className="sm:text-right space-y-1.5">
            <p className="text-[11px] text-slate-400 uppercase font-black tracking-wider">Payment Details</p>
            <p className="text-slate-600">
              <b>Date:</b>{" "}
              {order.createdAt.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
            <p className="text-slate-600">
              <b>Method:</b> {order.gatewayProvider || "ONLINE"}
            </p>
            <p className="text-slate-600">
              <b>Place of Supply:</b> {COMPANY_GST_DETAILS.state} ({COMPANY_GST_DETAILS.stateCode})
            </p>
            <p className="text-emerald-700 font-bold">Status: PAID / CONFIRMED</p>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="space-y-3">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <th className="py-2.5">Item Description</th>
                <th className="py-2.5">SAC Code</th>
                <th className="py-2.5 text-right">Taxable Value</th>
                <th className="py-2.5 text-right">GST ({gst.isInterState ? "IGST 18%" : "CGST 9% + SGST 9%"})</th>
                <th className="py-2.5 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-4 pr-4">
                  <p className="font-bold text-[#031635] text-sm">{order.batch.name}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Cohort Code: {order.batch.code}</p>
                  {order.coupon && (
                    <span className="inline-block mt-1 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono font-bold">
                      Coupon Applied: {order.coupon.code}
                    </span>
                  )}
                </td>
                <td className="py-4 font-mono text-slate-500">{COMPANY_GST_DETAILS.sacCode}</td>
                <td className="py-4 text-right font-mono">₹{gst.taxableAmount.toLocaleString("en-IN")}</td>
                <td className="py-4 text-right font-mono">₹{gst.totalTax.toLocaleString("en-IN")}</td>
                <td className="py-4 text-right font-mono font-bold text-[#031635]">
                  ₹{order.amount.toLocaleString("en-IN")}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Pricing Totals Breakdown */}
          <div className="flex justify-end pt-4 border-t border-slate-200">
            <div className="w-full max-w-xs space-y-2 text-xs">
              {order.originalAmount && order.originalAmount > order.amount && (
                <div className="flex justify-between text-slate-500">
                  <span>Gross Course Fee:</span>
                  <span className="font-mono">₹{order.originalAmount.toLocaleString("en-IN")}</span>
                </div>
              )}
              {order.discountAmount && order.discountAmount > 0 ? (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Discount:</span>
                  <span className="font-mono">-₹{order.discountAmount.toLocaleString("en-IN")}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-slate-500">
                <span>Taxable Value:</span>
                <span className="font-mono">₹{gst.taxableAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Total GST (18%):</span>
                <span className="font-mono">₹{gst.totalTax.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-[#031635] pt-2 border-t border-slate-200">
                <span>Total Paid:</span>
                <span className="font-mono">₹{order.amount.toLocaleString("en-IN")}</span>
              </div>
              {refundedAmount > 0 && (
                <div className="flex justify-between text-xs font-bold text-rose-600 pt-1">
                  <span>Total Refunded:</span>
                  <span className="font-mono">-₹{refundedAmount.toLocaleString("en-IN")}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="border-t border-slate-200 pt-6 text-[11px] text-slate-400 space-y-1">
          <p>
            * This is a computer-generated invoice and receipt for educational course enrollment. No physical signature is required.
          </p>
          <p>
            For any billing inquiries, email <b>support@atomicpathshala.in</b> quoting your invoice number.
          </p>
        </div>
      </div>
    </div>
  );
}
