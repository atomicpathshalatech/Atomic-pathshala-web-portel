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
  const [mode, setMode] = useState<"official" | "upload" | "draw" | "type">("official");
  const [directorName, setDirectorName] = useState("Firoz Ali");
  const [uploadedSignatureUrl, setUploadedSignatureUrl] = useState<string | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [submittingSign, setSubmittingSign] = useState(false);

  // Canvas & File Input Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  function handleSignatureFileUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (JPG, PNG, WEBP).");
      return;
    }
    setProcessingImage(true);
    const reader = new FileReader();
    reader.onerror = () => {
      toast.error("Failed to read image file.");
      setProcessingImage(false);
    };
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => {
        toast.error("Failed to decode image.");
        setProcessingImage(false);
      };
      img.onload = () => {
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          toast.error("Canvas context unavailable.");
          setProcessingImage(false);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        let borderSum = 0;
        let samples = 0;
        const step = Math.max(1, Math.floor(w / 30));
        for (let x = 0; x < w; x += step) {
          const topIdx = x * 4;
          borderSum += 0.299 * data[topIdx] + 0.587 * data[topIdx + 1] + 0.114 * data[topIdx + 2];
          const botIdx = ((h - 1) * w + x) * 4;
          borderSum += 0.299 * data[botIdx] + 0.587 * data[botIdx + 1] + 0.114 * data[botIdx + 2];
          samples += 2;
        }
        const paperBrightness = samples > 0 ? borderSum / samples : 240;
        const thresholdHigh = Math.max(160, Math.min(245, paperBrightness - 15));
        const thresholdLow = Math.max(60, thresholdHigh - 65);

        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;
        let inkPixels = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          const idx = i / 4;
          const x = idx % w;
          const y = Math.floor(idx / w);

          if (brightness >= thresholdHigh) {
            data[i + 3] = 0;
          } else if (brightness > thresholdLow) {
            const ratio = (thresholdHigh - brightness) / (thresholdHigh - thresholdLow);
            data[i + 3] = Math.round(255 * Math.pow(ratio, 1.15));
            data[i] = Math.round(r * 0.7);
            data[i + 1] = Math.round(g * 0.7);
            data[i + 2] = Math.round(b * 0.85);
            if (data[i + 3] > 30) {
              inkPixels++;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          } else {
            data[i + 3] = 255;
            data[i] = Math.min(r, 25);
            data[i + 1] = Math.min(g, 45);
            data[i + 2] = Math.min(b, 90);
            inkPixels++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }

        ctx.putImageData(imgData, 0, 0);

        if (inkPixels > 10 && minX < maxX && minY < maxY) {
          const pad = 16;
          const cx = Math.max(0, minX - pad);
          const cy = Math.max(0, minY - pad);
          const cw = Math.min(w - cx, maxX - minX + pad * 2);
          const ch = Math.min(h - cy, maxY - minY + pad * 2);
          const cropCanvas = document.createElement("canvas");
          cropCanvas.width = cw;
          cropCanvas.height = ch;
          const cropCtx = cropCanvas.getContext("2d");
          if (cropCtx) {
            cropCtx.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
            setUploadedSignatureUrl(cropCanvas.toDataURL("image/png"));
            setProcessingImage(false);
            return;
          }
        }
        setUploadedSignatureUrl(canvas.toDataURL("image/png"));
        setProcessingImage(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

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
    let signatureMethod: "ELECTRONIC_DRAWN" | "ELECTRONIC_TYPED" | "ELECTRONIC_UPLOADED" = "ELECTRONIC_UPLOADED";

    if (mode === "official") {
      signatureMethod = "ELECTRONIC_UPLOADED";
      signatureDataUrl = undefined; // Backend embeds public/brand/signature.png
    } else if (mode === "upload") {
      if (!uploadedSignatureUrl) {
        toast.error("Please upload a photo of your signature first.");
        return;
      }
      signatureDataUrl = uploadedSignatureUrl;
      signatureMethod = "ELECTRONIC_UPLOADED";
    } else if (mode === "draw") {
      if (!hasDrawn || !canvasRef.current) {
        toast.error("Please draw your signature in the canvas.");
        return;
      }
      signatureDataUrl = canvasRef.current.toDataURL("image/png");
      signatureMethod = "ELECTRONIC_DRAWN";
    } else {
      signatureMethod = "ELECTRONIC_TYPED";
    }

    setSubmittingSign(true);
    try {
      const res = await fetch(`/api/team/agreements/${agreementId}/countersign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directorSignedName: directorName.trim(),
          signatureDataUrl,
          signatureMethod,
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
                Both Educator and Founder and Director have electronically executed this document. Cryptographically locked.
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
                Founder and Director Countersignature
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
        <div className="flex items-center gap-1.5 p-1 bg-surface-container-high rounded-xl max-w-xl">
          <button
            type="button"
            onClick={() => setMode("official")}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all text-center ${
              mode === "official" ? "bg-surface text-primary shadow-xs" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Official Universal Sign
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all text-center ${
              mode === "upload" ? "bg-surface text-primary shadow-xs" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Upload Sign (PNG)
          </button>
          <button
            type="button"
            onClick={() => setMode("draw")}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all text-center ${
              mode === "draw" ? "bg-surface text-primary shadow-xs" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Draw Signature
          </button>
          <button
            type="button"
            onClick={() => setMode("type")}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all text-center ${
              mode === "type" ? "bg-surface text-primary shadow-xs" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Type Legal Name
          </button>
        </div>

        {/* Mode 1: Official Saved Universal Sign */}
        {mode === "official" && (
          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-primary/25 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface">Universal Handwritten Signature</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">verified</span> ID Card Approved Signature
              </span>
            </div>
            <div className="bg-white rounded-xl p-3 border border-outline-variant/30 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/signature.png" alt="Official Signature" className="h-16 object-contain filter drop-shadow-sm" />
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              This will directly seal your verified handwritten signature (<strong>Firoz Ali</strong>, Founder and Director) onto the executed bilateral contract.
            </p>
          </div>
        )}

        {/* Mode 2: Upload Signature Mode */}
        {mode === "upload" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <span>Upload photo/scan of handwritten signature on paper:</span>
              {uploadedSignatureUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setUploadedSignatureUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-rose-600 hover:underline font-semibold"
                >
                  Clear &amp; Re-upload
                </button>
              )}
            </div>

            {!uploadedSignatureUrl ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-primary/30 hover:border-primary bg-surface-container-lowest rounded-2xl p-6 text-center cursor-pointer transition-all space-y-3"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSignatureFileUpload(file);
                  }}
                  className="hidden"
                />
                {processingImage ? (
                  <div className="py-4 space-y-2">
                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-bold text-primary">
                      Processing &amp; converting to transparent PNG...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">Click to upload signature photo</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        White paper background is automatically converted to transparent PNG
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className="border-2 border-emerald-400/80 rounded-2xl p-4 bg-white shadow-inner flex items-center justify-center min-h-[140px]"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)",
                    backgroundSize: "16px 16px",
                    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadedSignatureUrl}
                    alt="Transparent Signature"
                    className="max-h-28 max-w-full object-contain filter drop-shadow-sm"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-emerald-700 font-medium px-1">
                  <span className="flex items-center gap-1 font-bold">
                    <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                    White background removed &bull; Transparent PNG ready
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary hover:underline font-bold"
                  >
                    Choose Different Photo
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSignatureFileUpload(file);
                    }}
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mode 3: Type Mode */}
        {mode === "type" && (
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
        )}

        {/* Mode 4: Draw Mode */}
        {mode === "draw" && (
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
            disabled={
              submittingSign ||
              (mode === "draw" && !hasDrawn) ||
              (mode === "upload" && !uploadedSignatureUrl) ||
              (mode === "type" && !directorName.trim())
            }
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
