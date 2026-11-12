"use client";

import React, { useState, useEffect } from "react";
import {
  Smartphone,
  QrCode,
  KeyRound,
  Clock,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  X,
  Copy,
  Download,
} from "lucide-react";
import { toast } from "sonner";

interface PairDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDevicePaired?: () => void;
}

export function PairDeviceModal({ isOpen, onClose, onDevicePaired }: PairDeviceModalProps) {
  const [loading, setLoading] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      generateCode();
    }
  }, [isOpen]);

  async function generateCode() {
    setLoading(true);
    try {
      const res = await fetch("/api/calling/devices/pair-code", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success && data.data) {
        setPairingCode(data.data.pairingCode);
        setQrPayload(data.data.qrPayload);
        setExpiresAt(data.data.expiresAt);
      } else {
        toast.error(data.error || "Failed to generate pairing code");
      }
    } catch {
      toast.error("Error communicating with pairing service");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-outline-variant/30 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-outline-variant/20 bg-surface-container-lowest flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">Pair Android Handset</h2>
              <p className="text-[11px] text-on-surface-variant">Connect companion phone to CRM</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center space-y-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">
              Physical SIM Cellular Calling
            </span>
            <p className="text-xs text-on-surface-variant mt-2 max-w-xs mx-auto">
              Open <strong>Atomic Calling</strong> app on your Android handset and scan the QR code or enter this 6-digit PIN.
            </p>
          </div>

          {/* 6-Digit PIN Canvas */}
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-5 space-y-2">
            <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Pairing PIN (Valid for 15 mins)
            </p>
            {loading ? (
              <div className="py-2 text-sm text-on-surface-variant animate-pulse">Generating secure PIN...</div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-3xl font-extrabold tracking-widest text-blue-600 bg-surface px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-900 shadow-sm">
                  {pairingCode || "------"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (pairingCode) {
                      navigator.clipboard.writeText(pairingCode);
                      toast.success("Pairing code copied!");
                    }
                  }}
                  className="p-2.5 rounded-xl border border-outline-variant/30 hover:bg-surface-container text-on-surface-variant transition"
                  title="Copy PIN"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Security Features */}
          <div className="text-left bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30 rounded-2xl p-4 space-y-1.5 text-xs text-emerald-900 dark:text-emerald-300">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Secure Mobile Channel
            </div>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-400 leading-relaxed">
              Once paired, calls initiated on your CRM laptop will directly trigger outbound cellular calls through this phone&apos;s physical SIM card using your unlimited operator calling pack.
            </p>
          </div>

          {/* Direct APK Download Link */}
          <div className="bg-surface-container-low border border-outline-variant/20 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-left">
            <div>
              <p className="text-xs font-bold text-on-surface">App not installed on phone yet?</p>
              <p className="text-[11px] text-on-surface-variant">Download Atomic Calling APK directly</p>
            </div>
            <a
              href="/downloads/AtomicCalling.apk"
              download="AtomicCalling.apk"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition shrink-0 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Download APK
            </a>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={generateCode}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-xs font-semibold text-on-surface hover:bg-surface-container flex items-center justify-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> New Code
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
