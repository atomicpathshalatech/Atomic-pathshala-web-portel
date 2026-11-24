import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY_GST_DETAILS } from "@/lib/invoicing/gst";

export const metadata: Metadata = {
  title: "Contact Us — Atomic Pathshala",
  description: "Get in touch with the Atomic Pathshala admissions, student support, and academic guidance team.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#fbfcff] text-[#121c2c] py-12 px-4 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">We Are Here To Help</span>
          <h1 className="text-3xl sm:text-4xl font-black text-[#031635]">Contact Atomic Pathshala</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Have questions regarding batch enrollment, technical issues, or scholarship tests? Connect with our dedicated support staff.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">mail</span>
            </div>
            <h3 className="font-black text-sm text-[#031635]">Email Support</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              For general queries, billing disputes, and technical classroom help:
            </p>
            <p className="text-xs font-mono font-bold text-primary">support@atomicpathshala.in</p>
            <p className="text-[11px] text-slate-400">Response within 24 business hours</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">call</span>
            </div>
            <h3 className="font-black text-sm text-[#031635]">Student Helpline</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Direct line for academic counselling and admissions assistance:
            </p>
            <p className="text-xs font-mono font-bold text-emerald-700">+91 98765 43210</p>
            <p className="text-[11px] text-slate-400">Mon &ndash; Sat: 9:00 AM &ndash; 7:00 PM IST</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">location_on</span>
            </div>
            <h3 className="font-black text-sm text-[#031635]">Corporate Office</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {COMPANY_GST_DETAILS.legalName}
              <br />
              {COMPANY_GST_DETAILS.address}
            </p>
            <p className="text-[11px] font-mono text-slate-400">
              GSTIN: {COMPANY_GST_DETAILS.gstin}
            </p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-[#031635]">Grievance Redressal &amp; Regulatory Compliance</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            In accordance with Information Technology Act 2000 and the Consumer Protection (E-Commerce) Rules, 2020, the contact details of the Grievance Officer are provided below:
          </p>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs space-y-1 text-slate-700">
            <p><b>Officer Name:</b> Academic Grievance Cell</p>
            <p><b>Email:</b> grievance@atomicpathshala.in</p>
            <p><b>Address:</b> {COMPANY_GST_DETAILS.address}</p>
          </div>
        </div>

        <div className="pt-4 text-center">
          <Link href="/" className="text-xs text-primary font-bold hover:underline">
            &larr; Back to Atomic Pathshala Home
          </Link>
        </div>
      </div>
    </div>
  );
}
