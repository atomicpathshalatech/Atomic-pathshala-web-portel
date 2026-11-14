"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function DirectorCountersignPanel({
  agreementId,
  agreementNumber,
  status,
  educatorSigned,
  educatorSignedName,
  finalPdfUrl,
}: {
  agreementId: string;
  agreementNumber: string;
  status: string;
  educatorSigned: boolean;
  educatorSignedName?: string;
  finalPdfUrl?: string | null;
}) {
  const router = useRouter();

  // Sending state
  const [sendingInvite, setSendingInvite] = useState(false);

  // Countersigning state
  const [mode, setMode] = useState<"type" | "draw">("type");
  const [directorName, setDirectorName] = useState("Firoz Ali");
  const [submittingSign, setSubmittingSign] = useState(false);

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);

  // Canvas Handlers
  function getCoordinates(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDrawing(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  async function handleSendInvitation() {
    setSendingInvite(true);
    try {
      const res = await fetch(`/api/team/agreements/${agreementId}/send`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to dispatch agreement email.");
        return;
      }
      toast.success("Invitation email dispatched to educator successfully!");
      router.refresh();
    } catch {
      toast.error("Network error sending invitation.");
    } finally {
      setSendingInvite(false);
    }
  }

  async function handleCountersign() {
    if (!directorName.trim()) {
      toast.error("Please enter the Director legal name.");
      return;
    }

    let signatureDataUrl: string | undefined;
    if (mode === "draw") {
      if (!hasDrawn || !canvasRef.current) {
        toast.error("Please draw your signature in the canvas.");
        return;
      }
      signatureDataUrl = canvasRef.current.toDataURL("image/png");
    }

    setSubmittingSign(true);
    try {
      const res = await fetch(`/api/team/agreements/${agreementId}/countersign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directorSignedName: directorName.trim(),
          signatureDataUrl,
          signatureMethod: mode === "draw" ? "ELECTRONIC_DRAWN" : "ELECTRONIC_TYPED",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Countersigning failed.");
        return;
      }

      toast.success("Agreement countersigned! Final executed PDF delivered to both parties.");
      router.refresh();
    } catch {
      toast.error("Network error executing countersignature.");
    } finally {
      setSubmittingSign(false);
    }
  }

  async function handleReject(actionType: "REJECTED" | "CORRECTION_REQUESTED") {
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      toast.error("Please provide a reason (minimum 5 characters).");
      return;
    }

    setSubmittingReject(true);
    try {
      const res = await fetch(`/api/team/agreements/${agreementId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: rejectReason.trim(),
          actionType,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Action failed.");
        return;
      }
      toast.success(`Agreement marked as ${actionType}.`);
      setRejectModalOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setSubmittingReject(false);
    }
  }

  // 1. If FULLY EXECUTED: Show execution certificate & download
  if (status === "FULLY_EXECUTED") {
    return (
      <div className="glass-card p-6 md:p-8 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50/40 via-surface to-surface space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
              <span className="material-symbols-outlined text-2xl">verified</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-on-surface">Fully Executed Document</h3>
              <p className="text-xs text-on-surface-variant">
                Both Educator and Founder &amp; Proprietor have electronically executed this document. Cryptographically locked.
              </p>
            </div>
          </div>

          {finalPdfUrl && (
            <a
              href={finalPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={`Atomic_Pathshala_${agreementNumber}.pdf`}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md hover:bg-emerald-700 transition flex items-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-base">download</span>
              Download Executed PDF
            </a>
          )}
        </div>
      </div>
    );
  }

  // 2. If DRAFT or EMAIL_DELIVERY_FAILED: Allow Admin to send invitation
  if (status === "DRAFT" || status === "STAMP_ATTACHED" || status === "EMAIL_DELIVERY_FAILED") {
    return (
      <div className="glass-card p-6 rounded-3xl border border-outline-variant/30 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-sm text-on-surface">Dispatch Agreement to Educator</h3>
            <p className="text-xs text-on-surface-variant">
              Generate a secure, single-use encrypted invitation link and email it to the educator for electronic signing.
            </p>
          </div>

          <button
            type="button"
            disabled={sendingInvite}
            onClick={handleSendInvitation}
            className="px-6 py-3 rounded-2xl bg-primary text-on-primary font-bold text-xs shadow-lg hover:opacity-90 active:scale-95 transition flex items-center gap-2 disabled:opacity-50"
          >
            {sendingInvite ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Dispatching Invitation...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">forward_to_inbox</span>
                {status === "EMAIL_DELIVERY_FAILED" ? "Retry Email Invitation" : "Send for Educator Signature"}
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // 3. If SENT_TO_EDUCATOR or VIEWED_BY_EDUCATOR: Educator hasn't signed yet
  if (!educatorSigned) {
    return (
      <div className="glass-card p-6 rounded-3xl border border-outline-variant/30 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">hourglass_top</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-on-surface">Awaiting Educator Electronic Signature</h3>
              <p className="text-xs text-on-surface-variant">
                The secure invitation has been dispatched. Waiting for the educator to open the link and sign.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={sendingInvite}
            onClick={handleSendInvitation}
            className="px-4 py-2 rounded-xl border border-outline-variant/40 bg-surface text-xs font-semibold hover:bg-surface-container-high transition flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">mark_email_read</span>
            Resend Invitation Email
          </button>
        </div>
      </div>
    );
  }

  // 4. If EDUCATOR_SIGNED / AWAITING_DIRECTOR_SIGNATURE: Founder / Director Countersigning Panel
  return (
    <>
      <div className="glass-card p-6 md:p-8 rounded-3xl border-2 border-amber-500/40 shadow-xl space-y-6 bg-gradient-to-br from-amber-50/20 via-surface to-surface">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-outline-variant/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">
              <span className="material-symbols-outlined text-2xl">history_edu</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-on-surface">
                Founder &amp; Proprietor Countersignature
              </h3>
              <p className="text-xs text-on-surface-variant">
                Educator <strong>{educatorSignedName || "Faculty"}</strong> has signed. Please review and countersign to generate the final executed document.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRejectModalOpen(true)}
            className="px-4 py-2 rounded-xl border border-rose-500/30 text-rose-600 hover:bg-rose-50 text-xs font-bold transition flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">cancel</span>
            Reject / Correction
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-2 p-1 bg-surface-container-high rounded-xl max-w-xs">
          <button
            type="button"
            onClick={() => setMode("type")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === "type" ? "bg-surface text-primary shadow-xs" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Type Legal Name
          </button>
          <button
            type="button"
            onClick={() => setMode("draw")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === "draw" ? "bg-surface text-primary shadow-xs" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Draw Signature
          </button>
        </div>

        {mode === "type" ? (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-on-surface">
              Authorized Signatory Full Legal Name
            </label>
            <input
              type="text"
              value={directorName}
              onChange={(e) => setDirectorName(e.target.value)}
              className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-lowest py-3 px-4 text-xl outline-none focus:ring-2 focus:ring-primary font-serif italic text-primary font-bold"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <span>Draw your signature in the box:</span>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-rose-600 hover:underline font-semibold"
              >
                Clear
              </button>
            </div>
            <div className="border-2 border-dashed border-outline-variant/50 rounded-2xl overflow-hidden bg-surface-container-lowest">
              <canvas
                ref={canvasRef}
                width={600}
                height={140}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-36 touch-none cursor-crosshair block"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 flex-wrap gap-4">
          <span className="text-[11px] text-on-surface-variant font-mono">
            IP, UTC timestamp &amp; audit trail will be sealed onto the final PDF.
          </span>
          <button
            type="button"
            disabled={submittingSign || (mode === "draw" && !hasDrawn)}
            onClick={handleCountersign}
            className="px-7 py-3 rounded-2xl bg-primary text-on-primary font-bold text-xs shadow-lg hover:opacity-90 active:scale-95 transition flex items-center gap-2 disabled:opacity-50"
          >
            {submittingSign ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Executing Final PDF &amp; Emailing...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">verified</span>
                Countersign &amp; Fully Execute Agreement
              </>
            )}
          </button>
        </div>
      </div>

      {/* Rejection / Correction Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface text-on-surface rounded-3xl max-w-md w-full p-6 border border-outline-variant/30 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-rose-600">Reject or Request Correction</h3>
            <p className="text-xs text-on-surface-variant">
              Specify the exact reason or correction required for this agreement. This will be recorded in the audit history.
            </p>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Compensation terms require revision or teaching hours adjustment needed."
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 text-xs outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingReject}
                onClick={() => handleReject("CORRECTION_REQUESTED")}
                className="px-4 py-2 rounded-xl border border-amber-500/40 text-amber-700 text-xs font-bold hover:bg-amber-50 transition"
              >
                Request Correction
              </button>
              <button
                type="button"
                disabled={submittingReject}
                onClick={() => handleReject("REJECTED")}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition"
              >
                Reject Agreement
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
