"use client";

import { useEffect, useState } from "react";
import { WhiteboardPdfDownloadButton } from "@/components/whiteboard/WhiteboardPdfDownloadButton";
import { LectureVideoPlayer } from "@/components/video-player/LectureVideoPlayer";

/**
 * Catch-up playback for a live class that's already been recorded (Room
 * Composite Egress -> R2, see src/lib/livekit/egress.ts). Used both for a
 * student who joined late wanting to start from the beginning, and for
 * anyone revisiting a class after it ended.
 *
 * Polls the recording endpoint while status isn't READY yet (LiveKit
 * finalizes and uploads the file asynchronously after the teacher ends
 * class, typically well under a minute for a short session) rather than
 * making the caller figure out when to check back.
 */
export function RecordingPlayer({ whiteboardSessionId }: { whiteboardSessionId: string }) {
  const [state, setState] = useState<{
    status: string;
    available: boolean;
    url: string | null;
    durationSeconds: number | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/whiteboard/sessions/${whiteboardSessionId}/recording`);
        const json = await res.json();
        if (cancelled) return;

        if (!res.ok || !json.success) {
          setError(json.error || "Could not load the recording.");
          return;
        }

        setState(json.data);
        setError(null);

        if (
          !json.data.available &&
          json.data.status !== "FAILED" &&
          json.data.status !== "RECORDING_FAILED" &&
          json.data.status !== "NONE"
        ) {
          timer = setTimeout(poll, 5000);
        }
      } catch {
        if (!cancelled) setError("Could not load the recording.");
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [whiteboardSessionId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-gray-400">
        <span className="material-symbols-outlined text-3xl text-gray-600">error</span>
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-gray-400 text-sm">
        <span className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
        Checking for a recording…
      </div>
    );
  }

  if (state.status === "NONE") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-gray-400">
        <span className="material-symbols-outlined text-3xl text-gray-600">videocam_off</span>
        <span className="text-sm">This class wasn't recorded.</span>
      </div>
    );
  }

  if (state.status === "FAILED" || state.status === "RECORDING_FAILED") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-gray-400">
        <span className="material-symbols-outlined text-3xl text-amber-500">warning</span>
        <span className="text-sm">Recording failed for this class. Nothing to play back.</span>
      </div>
    );
  }

  if (!state.available || !state.url) {
    const isLiveRecording =
      state.status === "RECORDING" ||
      state.status === "RECORDING_STARTING" ||
      state.status === "STARTING";

    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-gray-400">
        <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-sm">
          {isLiveRecording
            ? "Class is currently recording — playback will be ready shortly after class concludes."
            : "Processing the recording — usually ready within a minute."}
        </span>
      </div>
    );
  }


  return (
    <div className="w-full rounded-xl overflow-hidden border border-[#252836] bg-black">
      <div className="w-full aspect-video bg-black">
        <LectureVideoPlayer
          mode="recorded"
          lectureId={whiteboardSessionId}
          videoUrl={state.url!}
          title="Class Recording Replay"
        />
      </div>
      <div className="flex items-center justify-end gap-3 px-3 py-2 bg-[#12131c] border-t border-[#252836]">
        <WhiteboardPdfDownloadButton
          sessionId={whiteboardSessionId}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm shrink-0 disabled:opacity-60"
          title="Download Board Notes PDF"
        >
          <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
          <span>Download PDF (नोट्स)</span>
        </WhiteboardPdfDownloadButton>
      </div>
    </div>
  );
}
