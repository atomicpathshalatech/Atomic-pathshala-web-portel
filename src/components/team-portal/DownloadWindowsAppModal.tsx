"use client";

import { useState } from "react";

export function DownloadWindowsAppModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    setDownloading(true);
    // Direct trigger to download Windows installer .exe
    window.location.href = "/api/desktop/download";
    setTimeout(() => setDownloading(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface rounded-3xl max-w-lg w-full flex flex-col shadow-2xl border border-outline-variant/30 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-outline-variant/20 flex items-center justify-between bg-gradient-to-r from-orange-500/10 via-primary/5 to-transparent">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-0.5 shadow-md flex items-center justify-center shrink-0">
              <img
                src="/icon.png"
                alt="Atomic Pathshala"
                className="w-full h-full rounded-2xl object-cover bg-white"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-extrabold">
                  Atomic Pathshala Teacher
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 text-[10px] font-black uppercase tracking-wider">
                  Windows App
                </span>
              </div>
              <p className="text-label-sm text-on-surface-variant mt-0.5">
                Dedicated Classroom &amp; Live Streaming Studio for Faculty
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-on-surface">
          {/* Key Advantages */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-orange-500 text-xl shrink-0 mt-0.5">
                youtube_activity
              </span>
              <div>
                <h4 className="text-xs font-bold">1-Click YouTube Live</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                  OBS या स्ट्रीम-की की जरूरत नहीं, ऐप से सीधे यूट्यूब लाइव जाएं।
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">
                draw
              </span>
              <div>
                <h4 className="text-xs font-bold">Ultra-Smooth Whiteboard</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                  पेन टैबलेट (Graphic Tablet) के साथ ज़ीरो लैग और स्मूथ राइटिंग।
                </p>
              </div>
            </div>
          </div>

          {/* 3 Simple Steps */}
          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-primary">verified</span>
              ऐप इनस्टॉल करने के 3 आसान स्टेप्स:
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-on-surface">
                  नीचे दिए गए <strong>"Download App (.exe)"</strong> बटन पर क्लिक करके फाइल डाउनलोड करें।
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-on-surface">
                  डाउनलोड हुई फाइल पर डबल-क्लिक करके <strong>Install</strong> करें।
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                  3
                </span>
                <p className="text-on-surface">
                  ऐप खोलें, अपने <strong>Teacher आईडी/पासवर्ड</strong> से लॉगिन करें और लाइव पढ़ाना शुरू करें।
                </p>
              </div>
            </div>
          </div>

          {/* System Info */}
          <div className="p-3 rounded-2xl bg-surface-container-high/40 border border-outline-variant/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-on-surface-variant">
                laptop_windows
              </span>
              <span className="text-on-surface-variant">Windows 10 / 11 (64-bit Compatible)</span>
            </div>
            <span className="text-[11px] font-bold text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
              Ready to Install
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-outline-variant/20 bg-surface-container-lowest flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-outline-variant/30 text-label-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-full px-6 py-2.5 font-label-md text-label-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg">{downloading ? "sync" : "download"}</span>
            <span>{downloading ? "Starting Download…" : "Download App (.exe)"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

