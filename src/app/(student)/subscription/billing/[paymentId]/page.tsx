import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PrintInvoiceButton } from "@/components/student/PrintInvoiceButton";
import { COMPANY_GST_DETAILS, calculateGstBreakdown } from "@/lib/invoicing/gst";
import QRCode from "qrcode";

export const metadata: Metadata = {
  title: "Tax Invoice & Receipt",
};

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: "1 Month Recurring",
  QUARTERLY: "3 Months (Quarterly)",
  HALF_YEARLY: "6 Months (Half-Yearly)",
  ANNUAL: "12 Months (Annual)",
};

const PLAN_LABELS: Record<string, string> = { BASIC: "Basic Plan", PRO: "Pro Plan (Full Access)" };

export default async function InvoicePage({ params }: { params: { paymentId: string } }) {
  const { student } = await requireStudentSession();

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: params.paymentId },
    include: {
      subscription: { include: { student: { include: { user: true } } } },
      coupon: { select: { code: true, value: true, type: true } },
      refunds: { where: { status: "SUCCESS" } },
    },
  });

  if (!payment || payment.subscription.studentId !== student.id) notFound();
  if (payment.status !== "SUCCESS" || !payment.invoiceNumber) redirect("/subscription/billing");

  const refundedAmount = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
  const sub = payment.subscription;
  const gst = calculateGstBreakdown(payment.amount, null);

  // Generate QR Code for digital verification
  const verificationPayload = JSON.stringify({
    invoiceNumber: payment.invoiceNumber,
    studentId: sub.student.studentIdCode,
    amount: payment.amount,
    date: payment.createdAt.toISOString(),
    gstin: COMPANY_GST_DETAILS.gstin,
  });

  let qrCodeDataUrl = "";
  try {
    qrCodeDataUrl = await QRCode.toDataURL(verificationPayload, { width: 120, margin: 1 });
  } catch {}

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Non-printed header navigation */}
      <div className="print:hidden flex items-center justify-between">
        <Link href="/subscription/billing" className="text-label-sm text-primary hover:underline flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Billing History
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-on-surface-variant font-medium">Original for Recipient</span>
          <PrintInvoiceButton />
        </div>
      </div>

      {/* Official Tax Invoice Document */}
      <div className="bg-surface border border-outline-variant/30 print:border-none print:shadow-none print:bg-white rounded-3xl p-8 md:p-12 space-y-8 shadow-xl text-on-surface">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6 border-b border-outline-variant/20 pb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-3xl">science</span>
              <span className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
                {COMPANY_GST_DETAILS.brandName}
              </span>
            </div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mt-1">
              Tax Invoice / Fee Receipt
            </p>
            <p className="text-xs text-on-surface-variant max-w-sm mt-2 leading-relaxed">
              {COMPANY_GST_DETAILS.legalName}
              <br />
              {COMPANY_GST_DETAILS.address}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant mt-2 font-mono">
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
                className="w-24 h-24 rounded-lg border border-outline-variant/30 shadow-sm p-1 bg-white"
              />
            )}
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wider">Invoice Number</p>
              <p className="font-mono text-sm md:text-base font-bold text-primary">{payment.invoiceNumber}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Date:{" "}
                {payment.createdAt.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Bill To & Payment Meta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20">
          <div>
            <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
              Student / Billed To
            </p>
            <p className="font-label-lg font-bold text-on-surface">{sub.student.user.name}</p>
            <p className="text-xs text-on-surface-variant mt-0.5">{sub.student.user.email}</p>
            <p className="text-xs text-on-surface-variant">Phone: {sub.student.user.phone || "N/A"}</p>
            <p className="text-xs text-on-surface-variant mt-1 font-mono">
              Student ID: <b>{sub.student.studentIdCode}</b> | Roll: <b>{sub.student.enrollmentNumber}</b>
            </p>
          </div>

          <div className="sm:text-right">
            <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
              Transaction Details
            </p>
            <p className="text-xs text-on-surface">
              Mode: <b className="uppercase">{payment.method === "RAZORPAY" ? "Online / Razorpay" : "Cash / Offline"}</b>
            </p>
            {payment.razorpayPaymentId && (
              <p className="text-xs text-on-surface-variant font-mono break-all mt-0.5">
                Txn ID: {payment.razorpayPaymentId}
              </p>
            )}
            <p className="text-xs text-on-surface-variant mt-1">
              Status: <span className="text-primary font-bold">PAID & ACTIVATED</span>
            </p>
          </div>
        </div>

        {/* Line Items Table with GST & SAC */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-outline-variant/30 text-left uppercase tracking-wider text-on-surface-variant font-bold">
                <th className="py-3 px-2">Services / Item Description</th>
                <th className="py-3 px-2">SAC</th>
                <th className="py-3 px-2 text-right">Taxable Value</th>
                <th className="py-3 px-2 text-right">GST (18%)</th>
                <th className="py-3 px-2 text-right">Total (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              <tr>
                <td className="py-4 px-2">
                  <p className="font-bold text-sm text-on-surface">
                    {PLAN_LABELS[sub.plan] ?? sub.plan} — {CYCLE_LABELS[sub.billingCycle] ?? sub.billingCycle}
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Course access & live interactive classes for {sub.student.targetExam} Aspirant
                  </p>
                  {payment.periodStart && payment.periodEnd && (
                    <p className="text-[11px] text-on-surface-variant font-mono mt-1">
                      Validity: {payment.periodStart.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} — {payment.periodEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                  {payment.coupon && (
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-primary/10 text-primary font-bold rounded">
                      Discount Applied ({payment.coupon.code})
                    </span>
                  )}
                </td>
                <td className="py-4 px-2 font-mono text-on-surface-variant align-top">{COMPANY_GST_DETAILS.sacCode}</td>
                <td className="py-4 px-2 text-right font-mono align-top">₹{gst.taxableAmount.toFixed(2)}</td>
                <td className="py-4 px-2 text-right font-mono align-top">
                  {gst.isInterState ? (
                    <span>IGST (18%): ₹{gst.igstAmount.toFixed(2)}</span>
                  ) : (
                    <span>
                      CGST (9%): ₹{gst.cgstAmount.toFixed(2)}
                      <br />
                      SGST (9%): ₹{gst.sgstAmount.toFixed(2)}
                    </span>
                  )}
                </td>
                <td className="py-4 px-2 text-right font-bold font-mono text-sm text-on-surface align-top">
                  ₹{payment.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-outline-variant/30 text-on-surface font-bold">
                <td colSpan={4} className="py-3 px-2 text-right text-xs uppercase">
                  Grand Total (Inclusive of all taxes):
                </td>
                <td className="py-3 px-2 text-right font-mono text-base text-primary">
                  ₹{payment.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
              {refundedAmount > 0 && (
                <tr className="text-error font-medium">
                  <td colSpan={4} className="py-1 px-2 text-right text-xs">
                    Less: Refunded Amount:
                  </td>
                  <td className="py-1 px-2 text-right font-mono">
                    −₹{refundedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {/* Footer Authorization Stamp & Signatory */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-outline-variant/20 text-xs text-on-surface-variant">
          <div className="space-y-1 text-center sm:text-left">
            <p className="font-semibold text-on-surface">Terms & Conditions:</p>
            <p>1. Fees once paid are subject to institutional terms and refund policy.</p>
            <p>2. This is a legally valid digitally generated tax invoice.</p>
          </div>

          <div className="text-center sm:text-right space-y-1">
            <div className="inline-block p-2 border border-dashed border-primary/40 rounded-xl bg-primary/5 mb-1">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                Digitally Verified & Signed
              </span>
              <span className="text-[11px] font-bold text-on-surface">Atomic Pathshala Accounts</span>
            </div>
            <p className="text-[10px] text-on-surface-variant">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
}
