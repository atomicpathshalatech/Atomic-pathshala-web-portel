"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface TeacherPostClassModalProps {
  sessionId: string;
  batchScheduleId: string;
  sessionTitle: string;
  onClose: () => void;
}

interface MaterialStatus {
  pdfStatus: string;
  pptxStatus: string;
  pdfError?: string | null;
  pptxError?: string | null;
  hasOriginalPresentation?: boolean;
  presentationType?: string | null;
  presentationName?: string | null;
  hasOriginalPpt?: boolean;
  originalPptName?: string | null;
  hasOriginalPdf?: boolean;
  originalPdfName?: string | null;
}

export function TeacherPostClassModal({
  sessionId,
  batchScheduleId,
  sessionTitle,
  onClose,
}: TeacherPostClassModalProps) {
  const router = useRouter();

  // Slides & presentation download state
  const [status, setStatus] = useState<MaterialStatus>({
    pdfStatus: "GENERATING",
    pptxStatus: "GENERATING",
  });
  const [recordingInfo, setRecordingInfo] = useState<{
    status: string;
    available: boolean;
    durationSeconds: number | null;
  }>({ status: "PROCESSING", available: false, durationSeconds: null });

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingOriginalPpt, setDownloadingOriginalPpt] = useState(false);
  const [downloadingOriginalPdf, setDownloadingOriginalPdf] = useState(false);

  // Technical Feedback & Notes State
  const [networkOk, setNetworkOk] = useState(true);
  const [audioOk, setAudioOk] = useState(true);
  const [videoOk, setVideoOk] = useState(true);
  const [whiteboardOk, setWhiteboardOk] = useState(true);
  const [engagementOk, setEngagementOk] = useState(true);
  const [issueDescription, setIssueDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [rating, setRating] = useState(5);
  const [submittingClass, setSubmittingClass] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Poll materials and recording generation status
  useEffect(() => {
    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;

    async function checkStatus() {
      try {
        const [slidesRes, recRes] = await Promise.all([
          fetch(`/api/whiteboard/sessions/${sessionId}/slides?format=status`),
          fetch(`/api/whiteboard/sessions/${sessionId}/recording`),
        ]);

        const slidesJson = await slidesRes.json();
        const recJson = await recRes.json();

        if (!cancelled && slidesJson.success && slidesJson.data) {
          setStatus(slidesJson.data);
        }
        if (!cancelled && recJson.success && recJson.data) {
          setRecordingInfo({
            status: recJson.data.status,
            available: recJson.data.available,
            durationSeconds: recJson.data.durationSeconds,
          });
        }
      } catch {
        // silent
      }
      if (!cancelled) {
        timer = setTimeout(checkStatus, 4000);
      }
    }

    checkStatus();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  async function handleDownload(format: "pdf" | "original_ppt" | "original_pdf") {
    if (format === "pdf") setDownloadingPdf(true);
    if (format === "original_ppt") setDownloadingOriginalPpt(true);
    if (format === "original_pdf") setDownloadingOriginalPdf(true);

    try {
      const res = await fetch(`/api/whiteboard/sessions/${sessionId}/slides?format=${format}`);
      const json = await res.json();
      if (json.success && json.data?.downloadUrl) {
        window.open(json.data.downloadUrl, "_blank");
      } else {
        alert(json.error || `Could not download requested file.`);
      }
    } catch {
      alert(`Download request failed.`);
    } finally {
      if (format === "pdf") setDownloadingPdf(false);
      if (format === "original_ppt") setDownloadingOriginalPpt(false);
      if (format === "original_pdf") setDownloadingOriginalPdf(false);
    }
  }

  async function handleSubmitClass(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSubmittingClass(true);
    setFeedbackError(null);

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/whiteboard/sessions/${sessionId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          networkOk,
          audioOk,
          videoOk,
          whiteboardOk,
          engagementOk,
          issueDescription: issueDescription.trim() || undefined,
          rating,
          tags: tags.length > 0 ? tags : undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFinalized(true);
        setTimeout(() => {
          router.push("/team/batches");
        }, 1200);
      } else {
        setFeedbackError(json.error || "Could not finalize class.");
      }
    } catch {
      setFeedbackError("Network error occurred while finalizing class.");
    } finally {
      setSubmittingClass(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#161824] border border-[#2d2e3b] rounded-3xl p-6 sm:p-8 shadow-2xl text-white my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2d2e3b] pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <span className="material-symbols-outlined text-xl">check_circle</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Class Ended &amp; Finalization</h2>
              <p className="text-xs text-gray-400 truncate max-w-md">{sessionTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#202232] text-gray-400 hover:text-white flex items-center justify-center transition"
            title="Close"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Section 1: Teaching Materials & Recording Status */}
        <div className="bg-[#10121d] border border-[#262838] rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-400 text-lg">folder_zip</span>
              <h3 className="text-sm font-bold text-gray-200">Preserved Class Resources &amp; Recording</h3>
            </div>

            {/* Recording status badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border bg-[#171926] border-[#2d2e3b]">
              <span
                className={`w-2 h-2 rounded-full ${
                  recordingInfo.status === "READY"
                    ? "bg-emerald-400"
                    : recordingInfo.status === "FAILED" || recordingInfo.status === "RECORDING_FAILED"
                    ? "bg-rose-400"
                    : "bg-amber-400 animate-ping"
                }`}
              />
              <span className="text-gray-300">
                {recordingInfo.status === "READY"
                  ? "Recording Ready"
                  : recordingInfo.status === "FAILED" || recordingInfo.status === "RECORDING_FAILED"
                  ? "Recording Incomplete"
                  : "Finalizing Recording..."}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Download your original teaching files and vector-annotated whiteboard notes. Student attendance and room logs have been preserved.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 1: Original Uploaded PPT Presentation (if uploaded) */}
            {status.hasOriginalPpt && (
              <div className="bg-[#171926] border border-[#2d2e3b] rounded-xl p-3.5 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-amber-300 truncate">Original PPT Presentation</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono shrink-0">
                      Original
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate" title={status.originalPptName || "Presentation.pptx"}>
                    {status.originalPptName || "Original uploaded PowerPoint"}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={downloadingOriginalPpt}
                  onClick={() => handleDownload("original_ppt")}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  {downloadingOriginalPpt ? "Opening..." : "Download Original PPT"}
                </button>
              </div>
            )}

            {/* Card 2: Original Uploaded PDF Document (if uploaded) */}
            {status.hasOriginalPdf && (
              <div className="bg-[#171926] border border-[#2d2e3b] rounded-xl p-3.5 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-sky-300 truncate">Original Teaching PDF</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono shrink-0">
                      Original
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate" title={status.originalPdfName || "Document.pdf"}>
                    {status.originalPdfName || "Original uploaded PDF"}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={downloadingOriginalPdf}
                  onClick={() => handleDownload("original_pdf")}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  {downloadingOriginalPdf ? "Opening..." : "Download Original PDF"}
                </button>
              </div>
            )}

            {/* Card 3: Annotated Whiteboard Export (PDF) */}
            <div
              className={`bg-[#171926] border border-[#2d2e3b] rounded-xl p-3.5 flex items-center justify-between ${
                !status.hasOriginalPpt && !status.hasOriginalPdf ? "sm:col-span-2" : ""
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-indigo-300 truncate">Export Whiteboard (PDF)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono shrink-0">
                    Handwritten Notes
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {status.pdfStatus === "READY"
                    ? "Annotated board notes with all drawings & formulas"
                    : status.pdfStatus === "FAILED"
                    ? "Generation error (click retry to rebuild)"
                    : "Finalizing whiteboard notes export..."}
                </p>
              </div>

              {status.pdfStatus === "READY" ? (
                <button
                  type="button"
                  disabled={downloadingPdf}
                  onClick={() => handleDownload("pdf")}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  {downloadingPdf ? "Opening..." : "Download Notes PDF"}
                </button>
              ) : status.pdfStatus === "FAILED" ? (
                <button
                  type="button"
                  disabled={downloadingPdf}
                  onClick={() => handleDownload("pdf")}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  Retry Export
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono shrink-0">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  Generating...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Technical Feedback & Notes Form */}
        <div className="bg-[#10121d] border border-[#262838] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400 text-lg">rate_review</span>
              <h3 className="text-sm font-bold text-gray-200">Educator Technical Review &amp; Class Notes</h3>
            </div>
            <span className="text-[10px] text-gray-400">Class Finalization</span>
          </div>

          {finalized ? (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 text-center my-4 space-y-1">
              <span className="material-symbols-outlined text-emerald-400 text-2xl">task_alt</span>
              <p className="text-xs font-bold text-emerald-300">Class Successfully Finalized!</p>
              <p className="text-[11px] text-gray-400">Attendance and resources have been completed. Redirecting to Batches...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmitClass} className="space-y-4 mt-3">
              {feedbackError && (
                <div className="text-xs text-rose-400 bg-rose-950/50 border border-rose-500/40 rounded-lg p-2.5">
                  {feedbackError}
                </div>
              )}

              {/* Checklist flags */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#171926] border border-[#2d2e3b] cursor-pointer hover:border-gray-600 transition">
                  <input
                    type="checkbox"
                    checked={networkOk}
                    onChange={(e) => setNetworkOk(e.target.checked)}
                    className="accent-indigo-500 rounded"
                  />
                  <span>Network / Stream Smooth</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#171926] border border-[#2d2e3b] cursor-pointer hover:border-gray-600 transition">
                  <input
                    type="checkbox"
                    checked={audioOk}
                    onChange={(e) => setAudioOk(e.target.checked)}
                    className="accent-indigo-500 rounded"
                  />
                  <span>Audio &amp; Mic Clear</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#171926] border border-[#2d2e3b] cursor-pointer hover:border-gray-600 transition">
                  <input
                    type="checkbox"
                    checked={videoOk}
                    onChange={(e) => setVideoOk(e.target.checked)}
                    className="accent-indigo-500 rounded"
                  />
                  <span>Camera Feed Crisp</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#171926] border border-[#2d2e3b] cursor-pointer hover:border-gray-600 transition">
                  <input
                    type="checkbox"
                    checked={whiteboardOk}
                    onChange={(e) => setWhiteboardOk(e.target.checked)}
                    className="accent-indigo-500 rounded"
                  />
                  <span>Whiteboard Smooth</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#171926] border border-[#2d2e3b] cursor-pointer hover:border-gray-600 transition col-span-2 sm:col-span-1">
                  <input
                    type="checkbox"
                    checked={engagementOk}
                    onChange={(e) => setEngagementOk(e.target.checked)}
                    className="accent-indigo-500 rounded"
                  />
                  <span>Student Active</span>
                </label>
              </div>

              {/* Overall Rating */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Class Delivery Rating:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="text-lg transition text-amber-400 hover:scale-110"
                    >
                      <span className="material-symbols-outlined">
                        {star <= rating ? "star" : "star_border"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Note / Teacher notes */}
              <div>
                <textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Teacher notes / Topics covered / Items to review in next lecture..."
                  className="w-full h-16 bg-[#171926] border border-[#2d2e3b] rounded-xl p-3 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>

              {/* Optional tags */}
              <div>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="Optional tags (e.g. Thermodynamics, Class 12, DPP-04)..."
                  className="w-full bg-[#171926] border border-[#2d2e3b] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-gray-400 hover:text-white transition px-2 py-1"
                >
                  Stay in Room
                </button>

                <button
                  type="submit"
                  disabled={submittingClass}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-sm">task_alt</span>
                  <span>{submittingClass ? "Finalizing Class..." : "Submit Class"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}


