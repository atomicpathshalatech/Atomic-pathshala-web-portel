"use client";

import { useState } from "react";
import { toast } from "sonner";

export function AgreementTestEmailModal() {
  const [open, setOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    delivered: boolean;
    providerUsed: string;
    messageId?: string;
    error?: string;
    durationMs: number;
    senderUsed: string;
    diagnosticNote: string;
  } | null>(null);

  async function handleSendTest() {
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Please enter a valid recipient email address.");
      return;
    }

    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/team/agreements/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEmail: testEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to trigger test email.");
        return;
      }
      setResult(data.data);
      if (data.data.delivered) {
        toast.success(`Test email successfully delivered via ${data.data.providerUsed.toUpperCase()}!`);
      } else {
        toast.error(`Email delivery failed: ${data.data.error}`);
      }
    } catch {
      toast.error("Network error executing test email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-xs font-bold text-on-surface hover:bg-surface-container-high transition flex items-center gap-1.5"
      >
        <span className="material-symbols-outlined text-sm text-primary">mark_email_read</span>
        Test Email Delivery
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface text-on-surface rounded-3xl max-w-lg w-full p-6 md:p-8 border border-outline-variant/30 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">mark_email_read</span>
                <h3 className="font-bold text-base">Transactional Email Delivery Test</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setResult(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Verify that the Atomic Pathshala agreement mail transport, DNS SPF/DKIM alignment, and transactional provider are working properly before sending official contracts to educators.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface">Recipient Email Address</label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="e.g. director@atomicpathshala.in or your personal email"
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {result && (
              <div
                className={`p-4 rounded-2xl text-xs space-y-2 border ${
                  result.delivered
                    ? "bg-emerald-50/50 border-emerald-500/30 text-emerald-900"
                    : "bg-rose-50/50 border-rose-500/30 text-rose-900"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>Status: {result.delivered ? "PROVIDER ACCEPTED" : "TRANSMISSION FAILED"}</span>
                  <span className="font-mono text-[11px]">{result.durationMs}ms</span>
                </div>
                <p className="text-[11px] font-mono">Provider: {result.providerUsed.toUpperCase()}</p>
                <p className="text-[11px] font-mono">Sender: {result.senderUsed}</p>
                {result.messageId && (
                  <p className="text-[11px] font-mono">Message ID: {result.messageId}</p>
                )}
                {result.error && (
                  <p className="text-[11px] font-mono text-rose-700 bg-white/70 p-2 rounded">
                    Error: {result.error}
                  </p>
                )}
                <p className="text-[11px]">{result.diagnosticNote}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition"
              >
                Close
              </button>
              <button
                type="button"
                disabled={sending || !testEmail}
                onClick={handleSendTest}
                className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow hover:opacity-90 active:scale-95 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {sending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending Test...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">send</span>
                    Send Test Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
