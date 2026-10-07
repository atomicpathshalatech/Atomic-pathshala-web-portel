"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Play, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ExtractionJobProgressProps {
  jobId?: string;
  progress: number;
  step: string | null;
  reportJson?: any;
  status?: string;
}

export function ExtractionJobProgress({
  jobId,
  progress: initialProgress,
  step: initialStep,
  reportJson,
  status: initialStatus,
}: ExtractionJobProgressProps) {
  const router = useRouter();
  const [isDriving, setIsDriving] = useState(false);
  const [localStep, setLocalStep] = useState(initialStep || "Extracting questions...");
  const [localProgress, setLocalProgress] = useState(initialProgress);
  const isRunningRef = useRef(false);

  const chunkPlan = reportJson?.chunkPlan;
  const totalChunks = chunkPlan?.totalChunks || 0;
  const completedChunks = chunkPlan?.completedChunks || 0;
  const failedChunks = chunkPlan?.failedChunks || 0;
  const totalPages = chunkPlan?.totalPages || 0;

  // Auto-drive chunk processing when on page
  useEffect(() => {
    if (!jobId || initialStatus !== "PROCESSING" || isRunningRef.current) return;

    let unmounted = false;

    async function driveNextChunk() {
      if (unmounted || isRunningRef.current) return;
      isRunningRef.current = true;
      setIsDriving(true);

      try {
        const resumeRes = await fetch(`/api/team/question-extract/jobs/${jobId}/resume`, {
          method: "POST",
        });
        const resumeData = await resumeRes.json();

        if (resumeData.success && typeof resumeData.data?.nextChunkIndex === "number") {
          const chunkIdx = resumeData.data.nextChunkIndex;
          setLocalStep(`Processing chunk ${chunkIdx + 1} of ${totalChunks || "..."}...`);

          const processRes = await fetch(`/api/team/question-extract/jobs/${jobId}/process-chunk`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chunkIndex: chunkIdx }),
          });
          const processData = await processRes.json();

          if (processData.success) {
            if (processData.data?.isComplete) {
              setLocalStep("Extraction complete!");
              setLocalProgress(100);
              toast.success("PDF question extraction completed successfully!");
              router.refresh();
              return;
            }
          }
        }
      } catch (err) {
        console.warn("[ExtractionJobProgress] Auto-drive step notice:", err);
      } finally {
        isRunningRef.current = false;
        if (!unmounted) {
          router.refresh();
        }
      }
    }

    const interval = setInterval(() => {
      driveNextChunk();
    }, 4000);

    return () => {
      unmounted = true;
      clearInterval(interval);
    };
  }, [jobId, initialStatus, totalChunks, router]);

  const handleResume = async () => {
    if (!jobId) return;
    setIsDriving(true);
    try {
      const res = await fetch(`/api/team/question-extract/jobs/${jobId}/resume`, { method: "POST" });
      const data = await res.json();
      if (data.success && typeof data.data?.nextChunkIndex === "number") {
        toast.info(`Resuming extraction at chunk ${data.data.nextChunkIndex + 1}...`);
        await fetch(`/api/team/question-extract/jobs/${jobId}/process-chunk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chunkIndex: data.data.nextChunkIndex }),
        });
        router.refresh();
      } else {
        toast.info("All chunks appear to be processed.");
        router.refresh();
      }
    } catch {
      toast.error("Failed to resume extraction.");
    } finally {
      setIsDriving(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!jobId) return;
    setIsDriving(true);
    try {
      const res = await fetch(`/api/team/question-extract/jobs/${jobId}/retry-failed`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.data?.message || "Retrying failed chunks...");
        router.refresh();
      }
    } catch {
      toast.error("Failed to retry failed chunks.");
    } finally {
      setIsDriving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-5 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <RefreshCw className={`h-4 w-4 ${initialStatus === "PROCESSING" ? "animate-spin" : ""}`} />
          </span>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {localStep || "Processing PDF Document..."}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {totalChunks > 0
                ? `Chunk ${completedChunks} of ${totalChunks} completed (${totalPages} total pages)`
                : "Incremental chunk pipeline active — zero silent loss"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {failedChunks > 0 && (
            <button
              onClick={handleRetryFailed}
              disabled={isDriving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Retry {failedChunks} Failed</span>
            </button>
          )}

          {initialStatus !== "PROCESSING" && (failedChunks > 0 || completedChunks < totalChunks) && (
            <button
              onClick={handleResume}
              disabled={isDriving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Resume Extraction</span>
            </button>
          )}

          <span className="font-mono text-sm font-extrabold text-blue-700 dark:text-blue-300">
            {localProgress}%
          </span>
        </div>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
          style={{ width: `${Math.max(4, Math.min(100, localProgress))}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>Every extracted question is saved immediately to prevent loss.</span>
        </span>
        <span className="italic">You can safely leave or reload this page at any time.</span>
      </div>
    </div>
  );
}
