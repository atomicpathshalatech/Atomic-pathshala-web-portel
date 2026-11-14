"use client";

import React, { useState } from "react";

interface EmployeeIdCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: {
    id: string;
    employeeId: string;
    name: string;
    photoUrl?: string | null;
    designation: string;
    department: string;
    dateOfJoining: string | Date;
    employmentType: string;
    workLocation?: string | null;
    qrCodeDataUrl?: string | null;
    verificationToken?: string | null;
    status: string;
  } | null;
}

export function EmployeeIdCardModal({
  isOpen,
  onClose,
  employee,
}: EmployeeIdCardModalProps) {
  const [activeSide, setActiveSide] = useState<"front" | "back">("front");

  if (!isOpen || !employee) return null;

  const dojFormatted = new Date(employee.dateOfJoining).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const pdfUrl = `/api/team/employees/${employee.id}/id-card`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0a2463] to-[#1e3a8a] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-bold text-white">
              🪪
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Official Employee ID Card</h2>
              <p className="text-xs text-blue-200">
                CR80 Printable Specification • {employee.employeeId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Card Side Toggle */}
        <div className="px-6 pt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSide("front")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeSide === "front"
                ? "bg-[#0a2463] text-white shadow-md"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            Card Front
          </button>
          <button
            type="button"
            onClick={() => setActiveSide("back")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeSide === "back"
                ? "bg-[#0a2463] text-white shadow-md"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            Card Back (QR & Auth)
          </button>
        </div>

        {/* ID Card Visual Preview Area */}
        <div className="p-6 flex items-center justify-center bg-slate-100 dark:bg-slate-950/60">
          <div className="w-[340px] h-[480px] bg-white rounded-2xl shadow-xl border border-slate-300 relative overflow-hidden flex flex-col justify-between select-none">
            {activeSide === "front" ? (
              /* FRONT OF ID CARD */
              <>
                {/* Header Band */}
                <div className="bg-[#0a2463] text-white pt-5 pb-4 px-4 text-center border-b-2 border-amber-400">
                  <p className="text-[10px] tracking-widest font-bold uppercase text-amber-300">
                    ATOMIC PATHSHALA EDUCATION
                  </p>
                  <p className="text-base font-black tracking-tight">Atomic Pathshala</p>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-white/20 text-[9px] font-bold uppercase tracking-wider text-white">
                    STAFF IDENTITY CARD
                  </span>
                </div>

                {/* Photo & Body */}
                <div className="flex-1 flex flex-col items-center justify-center px-4 py-3 text-center space-y-3">
                  {employee.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={employee.photoUrl}
                      alt={employee.name}
                      className="w-24 h-28 rounded-xl object-cover border-2 border-[#0a2463] shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-28 rounded-xl bg-slate-100 border-2 border-slate-300 flex items-center justify-center text-slate-400 font-black text-2xl shadow-inner">
                      {employee.name.charAt(0)}
                    </div>
                  )}

                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-tight">
                      {employee.name}
                    </h3>
                    <p className="text-xs font-bold text-[#0a2463] mt-0.5">
                      {employee.designation}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {employee.department}
                    </p>
                  </div>

                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Emp ID:</span>
                      <strong className="font-mono text-slate-900 font-bold">{employee.employeeId}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Joined:</span>
                      <span className="text-slate-800 font-semibold">{dojFormatted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Type:</span>
                      <span className="text-slate-800 font-semibold">{employee.employmentType.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Band */}
                <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-[9px] text-slate-600">
                  <span>Rampur, Uttar Pradesh</span>
                  <span className="font-bold text-[#0a2463]">atomicpathshala.in</span>
                </div>
              </>
            ) : (
              /* BACK OF ID CARD */
              <>
                <div className="bg-[#0a2463] text-white py-2.5 px-4 text-center border-b-2 border-amber-400">
                  <p className="text-[11px] font-black uppercase tracking-wider">
                    SECURITY & VERIFICATION
                  </p>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 text-center space-y-3">
                  <p className="text-[10px] text-slate-500 font-semibold">
                    Scan with any smartphone camera to verify authenticity
                  </p>

                  {/* QR Code */}
                  <div className="p-2 rounded-xl bg-white border-2 border-slate-200 shadow-sm">
                    {employee.qrCodeDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={employee.qrCodeDataUrl}
                        alt="Verification QR"
                        className="w-36 h-36 object-contain"
                      />
                    ) : (
                      <div className="w-36 h-36 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                        QR Pending
                      </div>
                    )}
                  </div>

                  <p className="font-mono text-[10px] font-bold text-[#0a2463]">
                    {employee.employeeId}
                  </p>

                  {/* Terms */}
                  <div className="text-[8px] text-slate-500 leading-tight space-y-1 px-2">
                    <p>This card remains property of ATOMIC PATHSHALA EDUCATION.</p>
                    <p>If found, please return to our campus in Rampur, Uttar Pradesh, India.</p>
                  </div>
                </div>

                {/* Signature Block */}
                <div className="border-t border-slate-200 bg-slate-50 p-3 text-center">
                  <div className="font-serif italic text-xs font-bold text-slate-800">
                    Firoz Ali
                  </div>
                  <div className="border-t border-slate-300 w-32 mx-auto my-0.5" />
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-700">
                    Firoz Ali • Founder & Proprietor
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions Bar */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Official CR80 Card: 85.6mm × 53.98mm @ 300 DPI
          </p>
          <div className="flex items-center gap-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-[#0a2463] hover:bg-[#0f3a9e] text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
            >
              <span>Download Printable CR80 PDF</span>
              <span>↓</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
