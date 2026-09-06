"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface TeacherPostClassModalProps {
  sessionId: string;
  batchScheduleId: string;
  sessionTitle: string;
  onClose: () => void;
}

export function TeacherPostClassModal({
  sessionId,
  batchScheduleId,
  sessionTitle,
  onClose,
}: TeacherPostClassModalProps) {
  // Slides download state
  const [status, setStatus] = useState<{
    pdfStatus: string;
    pptxStatus: string;
    pdfError?: string | null;
    pptxError?: string | null;
  }>({
    pdfStatus: "GENERATING",
    pptxStatus: "GENERATING",
  });
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingPptx, setDownloadingPptx] = useState(false);

  // Technical Feedback Form State
  const [networkOk, setNetworkOk] = useState(true);
  const [audioOk, setAudioOk] = useState(true);
  const [videoOk, setVideoOk] = useState(true);
  const [whiteboardOk, setWhiteboardOk] = useState(true);
  const [engagementOk, setEngagementOk] = useState(true);
  const [issueDescription, setIssueDescription] = useState("");
  const [rating, setRating] = useState(5);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Poll slides generation status
  useEffect(() => {
    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;

    async function checkStatus() {
      try {
        const res = await fetch(`/api/whiteboard/sessions/${sessionId}/slides?format=status`);
        const json = await res.json();
        if (!cancelled && json.success && json.data) {
          setStatus(json.data);
          // If both are finished (READY or FAILED), stop polling
          if (
            (json.data.pdfStatus === "READY" || json.data.pdfStatus === "FAILED") &&
            (json.data.pptxStatus === "READY" || json.data.pptxStatus === "FAILED")
          ) {
            return;
          }
        }
      } catch {
        // silent
      }
      if (!cancelled) {
        timer = setTimeout(checkStatus, 3000);
      }
    }

    checkStatus();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  async function handleDownload(format: "pdf" | "pptx") {
    if (format === "pdf") setDownloadingPdf(true);
    if (format === "pptx") setDownloadingPptx(true);

    try {
      const res = await fetch(`/api/whiteboard/sessions/${sessionId}/slides?format=${format}`);
      const json = await res.json();
      if (json.success && json.data?.downloadUrl) {
        window.open(json.data.downloadUrl, "_blank");
      } else {
        alert(json.error || `Could not download ${format.toUpperCase()}.`);
      }
    } catch {
      alert(`Download request failed for ${format.toUpperCase()}.`);
    } finally {
      if (format === "pdf") setDownloadingPdf(false);
      if (format === "pptx") setDownloadingPptx(false);
    }
  }

  async function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingFeedback(true);
    setFeedbackError(null);

    try {
      const res = await fetch(`/api/whiteboard/sessions/${sessionId}/feedback/teacher`, {
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
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedbackSubmitted(true);
      } else {
        setFeedbackError(json.error || "Could not submit feedback.");
      }
    } catch {
      setFeedbackError("Something went wrong. Please check your connection.");
    } finally {
      setSubmittingFeedback(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#161824] border border-[#2d2e3b] rounded-3xl p-6 sm:p-8 shadow-2xl text-white my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2d2e3b] pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <span className="material-symbols-outlined text-xl">check_circle</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Live Class Concluded</h2>
              <p className="text-xs text-gray-400 truncate max-w-md">{sessionTitle}</p>
            </div>
          </div>
          <Link
            href="/team/batches"
            className="w-8 h-8 rounded-full bg-[#202232] text-gray-400 hover:text-white flex items-center justify-center transition"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </Link>
        </div>

        {/* Section 1: Slide Exports */}
        <div className="bg-[#10121d] border border-[#262838] rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-400 text-lg">download_for_offline</span>
              <h3 className="text-sm font-bold text-gray-200">Teaching Materials &amp; Whiteboard Exports</h3>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">16:9 HD Branded</span>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Authoritative class slides have been autosaved and formatted with the Atomic Pathshala watermark. Students receive view-only access to the PDF in their Class Notes roadmap.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* PDF Card */}
            <div className="bg-[#171926] border border-[#2d2e3b] rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">Class Notes (PDF)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                    Public
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {status.pdfStatus === "READY"
                    ? "Ready to view & download"
                    : status.pdfStatus === "FAILED"
                    ? "Generation error"
                    : "Finalizing PDF..."}
                </p>
              </div>

              {status.pdfStatus === "READY" ? (
                <button
                  type="button"
                  disabled={downloadingPdf}
                  onClick={() => handleDownload("pdf")}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  {downloadingPdf ? "Opening..." : "Download"}
                </button>
              ) : status.pdfStatus === "FAILED" ? (
                <span className="text-xs text-rose-400 font-semibold">Failed</span>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-amber-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  Generating...
                </div>
              )}
            </div>

            {/* PPTX Card (Teacher Only) */}
            <div className="bg-[#171926] border border-[#2d2e3b] rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">Presentation (PPTX)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                    Faculty Only
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {status.pptxStatus === "READY"
                    ? "Ready for PowerPoint editing"
                    : status.pptxStatus === "FAILED"
                    ? "Generation error"
                    : "Building presentation..."}
                </p>
              </div>

              {status.pptxStatus === "READY" ? (
                <button
                  type="button"
                  disabled={downloadingPptx}
                  onClick={() => handleDownload("pptx")}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  {downloadingPptx ? "Opening..." : "Download"}
                </button>
              ) : status.pptxStatus === "FAILED" ? (
                <span className="text-xs text-rose-400 font-semibold">Failed</span>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-amber-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  Generating...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Technical Feedback Form */}
        <div className="bg-[#10121d] border border-[#262838] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400 text-lg">rate_review</span>
              <h3 className="text-sm font-bold text-gray-200">Educator Technical &amp; Delivery Feedback</h3>
            </div>
            <span className="text-[10px] text-gray-400">Continuous Quality Check</span>
          </div>

          {feedbackSubmitted ? (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 text-center my-4 space-y-1">
              <span className="material-symbols-outlined text-emerald-400 text-2xl">task_alt</span>
              <p className="text-xs font-bold text-emerald-300">Thank you! Your feedback has been recorded.</p>
              <p className="text-[11px] text-gray-400">Our engineering and academic team reviews this for continuous optimization.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmitFeedback} className="space-y-4 mt-3">
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
                  <span>Whiteboard &amp; Tools Smooth</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#171926] border border-[#2d2e3b] cursor-pointer hover:border-gray-600 transition col-span-2 sm:col-span-1">
                  <input
                    type="checkbox"
                    checked={engagementOk}
                    onChange={(e) => setEngagementOk(e.target.checked)}
                    className="accent-indigo-500 rounded"
                  />
                  <span>Chat / Hand-Raise Active</span>
                </label>
              </div>

              {/* Overall Rating */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Session Overall Rating:</span>
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

              {/* Note / Issue description */}
              <div>
                <textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Optional: Note down any student queries, connection drops, or topics to review next class..."
                  className="w-full h-20 bg-[#171926] border border-[#2d2e3b] rounded-xl p-3 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Link
                  href="/team/batches"
                  className="text-xs text-gray-400 hover:text-white transition underline underline-offset-4"
                >
                  Skip &amp; Return to Dashboard
                </Link>

                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg disabled:opacity-60"
                >
                  {submittingFeedback ? "Saving..." : "Submit Technical Review"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Return Button */}
        <div className="mt-6 flex justify-end">
          <Link
            href="/team/batches"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30"
          >
            Finish &amp; Go to Batches &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
