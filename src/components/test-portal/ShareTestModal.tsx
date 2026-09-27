"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  X,
  Clock,
  Sparkles,
  Smartphone,
} from "lucide-react";

export interface ShareTestModalProps {
  testId: string;
  testName: string;
  testCode?: string | null;
  durationMin?: number | null;
  seriesName?: string | null;
  type?: "test" | "series";
  triggerButton?: React.ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
}

export function ShareTestModal({
  testId,
  testName,
  testCode,
  durationMin,
  seriesName,
  type = "test",
  triggerButton,
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}: ShareTestModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isControlled = typeof controlledIsOpen === "boolean";
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  const handleClose = () => {
    if (isControlled) {
      controlledOnClose?.();
    } else {
      setInternalOpen(false);
    }
  };

  const handleOpen = () => {
    if (isControlled) {
      // controlled by parent
    } else {
      setInternalOpen(true);
    }
  };

  // Build the student direct link
  const getShareUrl = () => {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    if (type === "series") {
      return `${origin}/tests?series=${testId}`;
    }
    return `${origin}/tests/${testId}/attempt`;
  };

  const shareUrl = getShareUrl();

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success(
        type === "series"
          ? "Test Series link copied to clipboard!"
          : "Test exam link copied to clipboard!"
      );
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Failed to copy link to clipboard");
    }
  };

  // WhatsApp formatted share text
  const handleShareWhatsApp = () => {
    const title = type === "series" ? "📚 Test Series" : "📝 Online Test";
    const durationText = durationMin ? `\n⏱️ *Duration:* ${durationMin} Minutes` : "";
    const seriesText = seriesName ? `\n📌 *Series:* ${seriesName}` : "";
    const codeText = testCode ? `\n🏷️ *Code:* ${testCode}` : "";

    const message = encodeURIComponent(
      `🎯 *Atomic Pathshala — ${title}*\n` +
      `*${testName}*` +
      `${codeText}` +
      `${durationText}` +
      `${seriesText}\n\n` +
      `👉 *Attempt / Access Link:* ${shareUrl}\n\n` +
      `Click the link to log in and attempt the test now!`
    );

    window.open(`https://api.whatsapp.com/send?text=${message}`, "_blank");
  };

  // Telegram share
  const handleShareTelegram = () => {
    const text = encodeURIComponent(
      `Atomic Pathshala - ${testName}\nClick link to attempt test:`
    );
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`,
      "_blank"
    );
  };

  // Native share sheet (for mobile browsers / Capacitor)
  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: testName,
          text: `Attempt ${testName} on Atomic Pathshala:`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <>
      {/* Trigger Button if not strictly controlled */}
      {!isControlled &&
        (triggerButton ? (
          <div onClick={handleOpen} className="inline-block cursor-pointer">
            {triggerButton}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleOpen}
            className="px-3.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            title="Share Test Link"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Link</span>
          </button>
        ))}

      {/* Share Dialog Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-tight">
                    Share {type === "series" ? "Test Series" : "Test Link"}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Share this link with students to attempt the exam
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Test Summary Box */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {testCode && (
                    <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      {testCode}
                    </span>
                  )}
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {testName}
                  </h4>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  {durationMin && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>{durationMin} Minutes</span>
                    </span>
                  )}
                  {seriesName && (
                    <span className="flex items-center gap-1 truncate">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">{seriesName}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Direct Link Input with Copy Button */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Student Direct Link:</span>
                  <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400">
                    Direct Exam Access
                  </span>
                </label>

                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 pl-3">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="w-full bg-transparent text-xs font-mono text-slate-700 dark:text-slate-200 outline-none select-all truncate"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      copied
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Students clicking this link will be taken straight to the test room.
                </p>
              </div>

              {/* Quick Social Share Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Share via:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {/* WhatsApp */}
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <span className="text-base">💬</span>
                    <span>WhatsApp</span>
                  </button>

                  {/* Telegram */}
                  <button
                    type="button"
                    onClick={handleShareTelegram}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <span className="text-base">✈️</span>
                    <span>Telegram</span>
                  </button>
                </div>

                {/* Device Share Button (Mobile/Native) */}
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="w-full mt-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                >
                  <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                  <span>More Share Options</span>
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Preview Student View</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium"
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
