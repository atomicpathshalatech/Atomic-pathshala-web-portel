"use client";

import React, { useState } from "react";
import { FileText, CheckCircle, Download, ExternalLink, Sparkles, X, Printer, ShieldAlert } from "lucide-react";

interface TestPdfDownloadModalProps {
  testId: string;
  testName: string;
  testCode?: string;
  isOpen?: boolean;
  onClose?: () => void;
  triggerButton?: React.ReactNode;
}

export function TestPdfDownloadModal({
  testId,
  testName,
  testCode,
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  triggerButton,
}: TestPdfDownloadModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isModalOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;
  const closeModal = controlledOnClose || (() => setInternalOpen(false));
  const openModal = () => setInternalOpen(true);

  const handleDownload = (withSolution: boolean) => {
    const type = withSolution ? "with-solution" : "without-solution";
    const url = `/api/tests/${testId}/export?type=${type}`;
    window.open(url, "_blank");
  };

  return (
    <>
      {triggerButton ? (
        <div onClick={openModal} className="inline-block cursor-pointer">
          {triggerButton}
        </div>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition hover:shadow"
        >
          <FileText className="w-4 h-4" />
          <span>Download Test PDF</span>
        </button>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative">
              <button
                type="button"
                onClick={closeModal}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bilingual Test Booklet Export</span>
              </div>
              <h2 className="text-lg font-extrabold text-white leading-tight">
                {testName}
              </h2>
              {testCode && (
                <div className="mt-1 inline-block px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-mono text-indigo-200">
                  {testCode}
                </div>
              )}
            </div>

            {/* Modal Body: Two Primary Download Options */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Choose the export format you require. Both options are generated with full Atomic Pathshala branding, bilingual typesetting (Hindi + English), and mathematical formulas.
              </p>

              {/* Option 1: WITHOUT SOLUTION */}
              <div className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/50 transition group flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                        1
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Question Paper (Without Solution)
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                      Exam Mode
                    </span>
                  </div>

                  <ul className="mt-2.5 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Atomic Pathshala Front Cover & Official Instructions</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Section-wise bilingual questions (Hindi + English parallel columns)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>1 Intermediate Rough Page + 2 Final Rough Work Pages</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Back Cover final examination rules</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownload(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download / Print Question Paper</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </button>
              </div>

              {/* Option 2: WITH SOLUTION */}
              <div className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 transition group flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                        2
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Full Paper + Solutions & Answer Key
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                      Complete Key
                    </span>
                  </div>

                  <ul className="mt-2.5 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Includes all questions + front & back cover instructions</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span><strong>180-Question Official Answer Key Grid Table</strong></span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Step-by-step detailed Hints, Solutions, and Formulas</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownload(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download / Print with Solutions</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1">
                <Printer className="w-3.5 h-3.5 text-indigo-500" />
                <span>Print Dialog / PDF Save ready</span>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="font-bold text-slate-600 dark:text-slate-300 hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
