import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY_GST_DETAILS } from "@/lib/invoicing/gst";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — Atomic Pathshala",
  description: "Official cancellation and refund policy for Atomic Pathshala courses, batches, and subscriptions.",
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[#fbfcff] text-[#121c2c] py-12 px-4 font-sans">
      <div className="max-w-3xl mx-auto space-y-8 bg-white p-8 md:p-12 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Compliance &amp; Consumer Protection</span>
          <h1 className="text-3xl font-black text-[#031635] mt-1">Refund &amp; Cancellation Policy</h1>
          <p className="text-xs text-slate-500 mt-2">
            Last updated: November 2026 · Effective across all Atomic Pathshala digital courses and cohort batches.
          </p>
        </div>

        <div className="prose prose-sm text-slate-600 space-y-6 leading-relaxed text-xs">
          <section className="space-y-2">
            <h2 className="text-base font-black text-[#031635]">1. Overview &amp; Commitment</h2>
            <p>
              At <b>{COMPANY_GST_DETAILS.legalName}</b> (operating as &ldquo;{COMPANY_GST_DETAILS.brandName}&rdquo;), we are committed to providing the highest standard of academic excellence for NEET UG, JEE Main, JEE Advanced, and foundation courses. We maintain transparent, fair, and clear terms regarding fees, access, and refunds.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-black text-[#031635]">2. Live Batch &amp; Course Enrollment Refund Terms</h2>
            <p>
              Students enrolling in any live cohort batch or recorded course are entitled to evaluate the pedagogy and learning experience under our satisfaction guarantee:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <b>7-Day Money-Back Window:</b> You may request a refund within seven (7) calendar days from the date of your purchase or the official batch start date (whichever is later).
              </li>
              <li>
                <b>Attendance Threshold:</b> To be eligible for a refund, the student must not have attended more than three (3) live classes or completed more than fifteen percent (15%) of the pre-recorded video lectures and course materials.
              </li>
              <li>
                <b>Printed Physical Modules:</b> If physical printed study materials, formulas books, or test modules have already been dispatched or delivered, the cost of materials and shipping will be deducted from the total refund amount.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-black text-[#031635]">3. Subscription Plans (Monthly, Quarterly, Annual)</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <b>Free Trial:</b> Subscriptions with trial periods will not incur charges if cancelled before the conclusion of the specified trial days.
              </li>
              <li>
                <b>Mid-Cycle Cancellations:</b> Once a subscription billing cycle (monthly, quarterly, or annual) has been charged, cancellations take effect at the end of the current billing cycle. Access remains active until the end of the paid term.
              </li>
              <li>
                <b>Billing Disputes:</b> Erroneous duplicate charges or unauthorized renewals will be refunded in full upon verification.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-black text-[#031635]">4. Refund Initiation &amp; Processing Timelines</h2>
            <p>
              To initiate a refund request, send an email to <a href="mailto:support@atomicpathshala.in" className="text-primary font-bold underline">support@atomicpathshala.in</a> from your registered student email address with the following details:
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Full Student Name &amp; Registered Mobile Number</li>
              <li>Order ID (e.g. <code>ORD-2026-000001</code>) or Invoice Number</li>
              <li>Batch / Course Name</li>
              <li>Reason for cancellation</li>
            </ol>
            <p className="mt-2">
              <b>Processing SLA:</b> Approved refunds will be initiated within 48 business hours. The funds will be credited directly back to the original source of payment (Bank Account, Credit/Debit Card, or UPI handle) within <b>5 to 7 business days</b>, subject to your issuing bank&rsquo;s clearing cycle.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-black text-[#031635]">5. Grievance &amp; Escalation Officer</h2>
            <p>
              If your refund request is not addressed within 7 business days, you may escalate the matter to our Grievance Redressal Officer at:
            </p>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 font-mono text-[11px] space-y-1 text-slate-700">
              <p><b>Attn:</b> Grievance Officer, Consumer Care</p>
              <p><b>Email:</b> grievance@atomicpathshala.in</p>
              <p><b>Entity:</b> {COMPANY_GST_DETAILS.legalName}</p>
              <p><b>Address:</b> {COMPANY_GST_DETAILS.address}</p>
            </div>
          </section>
        </div>

        <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-xs">
          <Link href="/" className="text-primary hover:underline font-bold">
            &larr; Back to Home
          </Link>
          <div className="flex gap-4 text-slate-500">
            <Link href="/terms" className="hover:text-primary">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-primary">Privacy Policy</Link>
            <Link href="/contact" className="hover:text-primary">Contact Us</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
