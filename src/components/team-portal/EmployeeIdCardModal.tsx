"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

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
  const [cardData, setCardData] = useState<{
    html: string;
    verifyUrl: string;
    pdfUrl: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !employee) return;
    setLoading(true);
    setError(null);
    setCardData(null);

    fetch(`/api/team/employees/${employee.id}/id-card?format=json`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to load ID card");
        }
        return res.json();
      })
      .then((data) => {
        if (data?.html) {
          setCardData(data);
        } else {
          throw new Error("Invalid ID card data received");
        }
      })
      .catch((err) => {
        console.error("[EmployeeIdCardModal] Load error:", err);
        setError(err.message || "Failed to load official ID card");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, employee]);

  if (!isOpen || !employee) return null;

  const pdfUrl = `/api/team/employees/${employee.id}/id-card`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0a2463] to-[#1e3a8a] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-bold text-white text-base">
              🪪
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">
                Official Atomic Pathshala ID Card
              </h2>
              <p className="text-xs text-blue-200">
                CR80 Plastic Card Specification • {employee.name} ({employee.employeeId})
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

        {/* Card Body & Preview Area */}
        <div className="p-6 flex-1 overflow-y-auto flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950/60 min-h-[460px]">
          {loading ? (
            <div className="w-[324px] h-[480px] rounded-[22px] border-2 border-dashed border-[#1d4ed8]/40 bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-center p-6 gap-3">
              <span className="material-symbols-outlined text-[44px] text-[#0a2463] animate-spin">
                sync
              </span>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                Loading Official ID Card...
              </p>
              <p className="text-xs text-slate-500">
                Rendering live corporate typography, vector QR code & signatures.
              </p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-center space-y-2 max-w-sm">
              <p className="font-bold text-sm">Could not load ID Card</p>
              <p className="text-xs">{error}</p>
              <Link
                href={`/team/id-cards?tab=team&q=${encodeURIComponent(employee.name)}`}
                className="inline-block px-3 py-1.5 rounded-lg bg-[#0a2463] text-white text-xs font-bold mt-2"
              >
                Open in ID Cards Management
              </Link>
            </div>
          ) : cardData?.html ? (
            <div className="space-y-3 flex flex-col items-center">
              {/* Authentic CR80 Preview in isolated iframe */}
              <div
                className="rounded-[22px] shadow-[0_20px_45px_-12px_rgba(10,36,99,0.45)] overflow-hidden bg-white border border-slate-200"
                style={{ width: 324, height: 514 }}
              >
                <iframe
                  title="Atomic Pathshala Official ID Card"
                  srcDoc={cardData.html}
                  sandbox=""
                  scrolling="no"
                  className="border-0 block"
                  style={{ width: 324, height: 514 }}
                />
              </div>

              <span className="text-[11px] font-semibold text-slate-500">
                Official single-instance ID Card registered with Atomic Pathshala
              </span>
            </div>
          ) : null}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              CR80 Standard (54 × 85.6 mm)
            </span>
            <span className="block text-[11px]">
              Single unified card used for mobile, print & verification
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            {/* View on Public Verification */}
            {cardData?.verifyUrl && (
              <a
                href={cardData.verifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                title="Open Public Verification Link"
              >
                ↗ Public QR
              </a>
            )}

            {/* Direct Link to ID Cards Admin */}
            <Link
              href={`/team/id-cards?tab=team&q=${encodeURIComponent(employee.name)}`}
              className="px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/50 text-[#0a2463] dark:text-blue-300 text-xs font-bold transition-colors"
              title="Manage photo, details, and permissions in official ID Cards system"
            >
              ⚙️ Manage Details
            </Link>

            {/* Download Official PDF */}
            <a
              href={cardData?.pdfUrl || pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-[#0a2463] hover:bg-[#0f3a9e] text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
            >
              <span>Download Printable PDF</span>
              <span>↓</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
