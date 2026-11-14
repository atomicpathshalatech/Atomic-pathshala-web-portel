"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type AgreementData = {
  id: string;
  agreementNumber: string;
  title: string;
  status: string;
  effectiveDate: string | null;
  annualSalary: string | null;
  monthlySalary: string | null;
  teachingHoursMonthly: string | null;
  workLocation: string | null;
  bodyText: string;
  stamp?: {
    certificateNumber: string;
    issuingState: string;
    stampDutyAmount: string;
    instrumentCategory: string;
  } | null;
};

type SignerData = {
  id: string;
  signerName: string;
  signerEmail: string;
  status: string;
};

/**
 * Converts an uploaded signature photo into a clean, transparent PNG.
 * Automatically samples paper background, removes light/white pixels,
 * feathers stroke edges, deepens ink contrast, and crops whitespace boundaries.
 */
function convertImageToTransparentPng(
  file: File,
  onSuccess: (dataUrl: string) => void,
  onError: (msg: string) => void
) {
  const reader = new FileReader();
  reader.onerror = () => onError("Failed to read image file.");
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => onError("Failed to decode image. Please upload a valid JPG or PNG.");
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
        onError("Canvas rendering context unavailable.");
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Sample border pixels to detect ambient paper lighting
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
          // Transparent paper
          data[i + 3] = 0;
        } else if (brightness > thresholdLow) {
          // Anti-aliased transition edge
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
          // Solid ink stroke
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

      // Auto-crop bounding box with padding
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
          onSuccess(cropCanvas.toDataURL("image/png"));
          return;
        }
      }

      onSuccess(canvas.toDataURL("image/png"));
    };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}

export default function EducatorSigningPage({
  params,
}: {
  params?: { token?: string } | Promise<{ token?: string }>;
}) {
  const routeParams = useParams();
  const [token, setToken] = useState<string>(() => {
    if (params && "token" in params && typeof params.token === "string") {
      return params.token;
    }
    if (routeParams?.token) {
      return Array.isArray(routeParams.token) ? routeParams.token[0] : routeParams.token;
    }
    return "";
  });

  useEffect(() => {
    if (!token) {
      if (routeParams?.token) {
        setToken(Array.isArray(routeParams.token) ? routeParams.token[0] : routeParams.token);
      } else if (params && typeof (params as any).then === "function") {
        (params as Promise<{ token?: string }>).then((p) => {
          if (p?.token) setToken(p.token);
        });
      }
    }
  }, [params, routeParams, token]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agreement, setAgreement] = useState<AgreementData | null>(null);
  const [signer, setSigner] = useState<SignerData | null>(null);

  // Signature state
  const [mode, setMode] = useState<"draw" | "upload" | "type">("draw");
  const [typedName, setTypedName] = useState("");
  const [uploadedSignatureUrl, setUploadedSignatureUrl] = useState<string | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signedSuccess, setSignedSuccess] = useState(false);

  // Canvas drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  function handleSignatureFileUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file (JPG, PNG, WEBP).");
      return;
    }
    setProcessingImage(true);
    convertImageToTransparentPng(
      file,
      (dataUrl) => {
        setUploadedSignatureUrl(dataUrl);
        setProcessingImage(false);
      },
      (errorMsg) => {
        alert(errorMsg || "Failed to process signature image.");
        setProcessingImage(false);
      }
    );
  }

  useEffect(() => {
    if (!token) return;
    async function loadAgreement() {
      try {
        const res = await fetch(`/api/agreements/sign/${token}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || "Invalid, expired, or already-signed agreement link.");
          return;
        }
        setAgreement(data.data.agreement);
        setSigner(data.data.signer);
        setTypedName(data.data.signer?.signerName || "");
      } catch {
        setError("Network error loading agreement. Please refresh or try again.");
      } finally {
        setLoading(false);
      }
    }
    loadAgreement();
  }, [token]);

  // Canvas Drawing Handlers
  function getCoordinates(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
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

  async function handleSignSubmit() {
    if (!agreeTerms) {
      alert("Please confirm the agreement acceptance declaration before submitting.");
      return;
    }

    let signatureDataUrl: string | undefined;
    let signatureMethod: "ELECTRONIC_DRAWN" | "ELECTRONIC_TYPED" | "ELECTRONIC_UPLOADED" = "ELECTRONIC_DRAWN";

    if (mode === "draw") {
      if (!hasDrawn || !canvasRef.current) {
        alert("Please draw your signature in the signature box.");
        return;
      }
      signatureDataUrl = canvasRef.current.toDataURL("image/png");
      signatureMethod = "ELECTRONIC_DRAWN";
    } else if (mode === "upload") {
      if (!uploadedSignatureUrl) {
        alert("Please upload a photo of your signature first.");
        return;
      }
      signatureDataUrl = uploadedSignatureUrl;
      signatureMethod = "ELECTRONIC_UPLOADED";
    } else {
      if (!typedName.trim() || typedName.trim().length < 2) {
        alert("Please enter your legal signature name.");
        return;
      }
      signatureMethod = "ELECTRONIC_TYPED";
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/agreements/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedName: typedName.trim() || signer?.signerName || "Educator",
          signatureDataUrl,
          signatureMethod,
          agreeTerms: true,
        }),
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        alert(body.error || "Could not record signature.");
        return;
      }

      setSignedSuccess(true);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">
            Securely verifying invitation token and loading agreement...
          </p>
        </div>
      </div>
    );
  }

  if (error || !agreement) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">lock_clock</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Signing Link Unavailable</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{error}</p>
          <div className="pt-2">
            <Link
              href="mailto:agreements@atomicpathshala.in"
              className="inline-block px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
            >
              Contact Legal &amp; Compliance
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (signedSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-3xl p-8 md:p-10 border border-slate-200 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <span className="material-symbols-outlined text-4xl">verified</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            Agreement Electronically Signed!
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Thank you, <strong>{typedName || signer?.signerName}</strong>. Your electronic signature for <strong>{agreement.title}</strong> (Ref: <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-sky-700">{agreement.agreementNumber}</code>) has been cryptographically recorded.
          </p>

          <div className="bg-slate-50 rounded-2xl p-4 text-left text-xs space-y-2 border border-slate-200/80">
            <div className="flex justify-between">
              <span className="text-slate-500">Signing Status</span>
              <span className="font-bold text-emerald-600">Completed by Educator</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Next Stage</span>
              <span className="font-bold text-sky-700">Founder and Director Countersignature</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Document Security</span>
              <span className="font-bold text-slate-800 font-mono">SHA-256 Locked</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Once the Director completes countersignature, you will receive the final executed PDF via email at <strong>{signer?.signerEmail}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 uppercase tracking-wide">
                Official Faculty Agreement
              </span>
              <span className="font-mono text-xs text-slate-400">
                {agreement.agreementNumber}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">{agreement.title}</h1>
            <p className="text-xs text-slate-500 mt-1">
              Issued to: <strong className="text-slate-800">{signer?.signerName}</strong> ({signer?.signerEmail})
            </p>
          </div>

          {agreement.stamp && (
            <div className="bg-emerald-50 border border-emerald-200/60 rounded-2xl p-3.5 text-xs text-emerald-900 shrink-0">
              <div className="font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-emerald-600">verified</span>
                Government e-Stamp Attached
              </div>
              <div className="text-[11px] text-emerald-700 font-mono mt-0.5">
                Cert: {agreement.stamp.certificateNumber} &bull; INR {agreement.stamp.stampDutyAmount}/- ({agreement.stamp.issuingState})
              </div>
            </div>
          )}
        </div>

        {/* Agreement Text Review Box */}
        <div className="bg-white rounded-3xl p-6 md:p-10 border border-slate-200 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              Complete Legal Agreement Document
            </span>
            <span className="text-xs text-sky-700 font-semibold">
              Please scroll and read all terms thoroughly before signing
            </span>
          </div>

          <div className="max-h-[500px] overflow-y-auto pr-3 border border-slate-100 rounded-2xl p-5 bg-slate-50/70 text-slate-800 text-xs font-mono leading-relaxed whitespace-pre-wrap selection:bg-sky-200">
            {agreement.bodyText}
          </div>
        </div>

        {/* Electronic Signature Execution Box */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border-2 border-sky-600/30 shadow-2xl space-y-6 bg-gradient-to-br from-sky-50/30 via-white to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">draw</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Educator Electronic Signature
              </h3>
              <p className="text-xs text-slate-500">
                Pursuant to Section 5 &amp; 10A of the Information Technology Act, 2000.
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-md">
            <button
              type="button"
              onClick={() => setMode("draw")}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all text-center ${
                mode === "draw" ? "bg-white text-sky-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Draw Signature
            </button>
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all text-center ${
                mode === "upload" ? "bg-white text-sky-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Upload Signature (PNG)
            </button>
            <button
              type="button"
              onClick={() => setMode("type")}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all text-center ${
                mode === "type" ? "bg-white text-sky-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Type Legal Name
            </button>
          </div>

          {/* Mode 1: Draw Mode */}
          {mode === "draw" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Sign inside the box using your mouse, touchpad, or finger:</span>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-rose-600 hover:underline font-semibold"
                >
                  Clear Canvas
                </button>
              </div>
              <div className="border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden bg-white shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={160}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-40 touch-none cursor-crosshair block"
                />
              </div>
            </div>
          )}

          {/* Mode 2: Upload Signature Mode */}
          {mode === "upload" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Upload a clear photo/scan of your signature on paper:</span>
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
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleSignatureFileUpload(file);
                  }}
                  className="border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/40 hover:bg-sky-50/70 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-3"
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
                      <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs font-bold text-sky-700">
                        Processing image &amp; removing background to transparent PNG...
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          Click to upload signature photo or drag &amp; drop
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Supports JPG, PNG, WEBP &bull; Paper background is automatically converted to transparent PNG
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
                      className="text-sky-600 hover:underline font-bold"
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
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Type Your Full Legal Name
              </label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="e.g. Dr. Aryan Sharma"
                className="w-full rounded-2xl border border-slate-300 bg-white py-3 px-4 text-xl outline-none focus:ring-2 focus:ring-sky-600 font-serif italic text-sky-900 font-bold"
              />
            </div>
          )}

          {/* Acceptance Declaration */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600 shrink-0 cursor-pointer"
              />
              <span className="text-xs text-slate-700 leading-relaxed select-none">
                I, <strong>{typedName || signer?.signerName}</strong>, hereby confirm that I have read, understood, and unconditionally accept all terms, compensation schedules, teaching hours, and annexures of this <strong>{agreement.title}</strong>. I acknowledge this electronic signature as legally binding under the Information Technology Act, 2000.
              </span>
            </label>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 font-mono">
              Signer IP, browser metadata, and UTC timestamp will be immutably sealed into the audit log.
            </span>
            <button
              type="button"
              disabled={
                submitting ||
                !agreeTerms ||
                (mode === "draw" && !hasDrawn) ||
                (mode === "upload" && !uploadedSignatureUrl) ||
                (mode === "type" && !typedName.trim())
              }
              onClick={handleSignSubmit}
              className="px-8 py-3.5 rounded-2xl bg-sky-600 text-white font-bold text-sm shadow-lg hover:bg-sky-500 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Recording Signature...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  Confirm &amp; Electronically Sign
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
