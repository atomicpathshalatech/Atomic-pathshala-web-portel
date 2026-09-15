"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface VoiceRecorderProps {
  onRecorded: (result: { url: string; durationSec: number }) => void;
  onCancel?: () => void;
  className?: string;
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export function VoiceRecorder({
  onRecorded,
  onCancel,
  className = "",
}: VoiceRecorderProps) {
  const [status, setStatus] = useState<"idle" | "recording" | "preview" | "uploading">("idle");
  const [recordSec, setRecordSec] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Audio recording is not supported in this browser");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        setAudioBlob(finalBlob);
        const objUrl = URL.createObjectURL(finalBlob);
        setPreviewUrl(objUrl);
        setStatus("preview");

        // Stop mic tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start(250); // collect 250ms chunks
      setStatus("recording");
      setRecordSec(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordSec((prev) => {
          if (prev >= 600) {
            // max 10 minutes limit
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Microphone permission denied. Please allow microphone access.");
      } else {
        toast.error("Could not start microphone recording.");
      }
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAudioBlob(null);
    setPreviewUrl(null);
    setStatus("idle");
    setRecordSec(0);
    onCancel?.();
  };

  const handleUploadAndSave = async () => {
    if (!audioBlob) return;
    setStatus("uploading");

    try {
      const ext = audioBlob.type.includes("mp4") ? "mp4" : audioBlob.type.includes("ogg") ? "ogg" : "webm";
      const mime = audioBlob.type || (ext === "mp4" ? "audio/mp4" : ext === "ogg" ? "audio/ogg" : "audio/webm");
      const file = new File([audioBlob], `doubt-voice-${Date.now()}.${ext}`, {
        type: mime,
      });

      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "doubt-audio");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!res.ok || !json.success || !json.data?.url) {
        throw new Error(json.error?.message || "Failed to upload voice recording");
      }

      toast.success("Voice answer uploaded successfully!");
      onRecorded({
        url: json.data.url,
        durationSec: Math.max(1, recordSec),
      });

      // Cleanup
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setAudioBlob(null);
      setPreviewUrl(null);
      setStatus("idle");
      setRecordSec(0);
    } catch (err: any) {
      console.error("Voice upload error:", err);
      toast.error(err.message || "Failed to upload voice answer");
      setStatus("preview");
    }
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 transition-all ${className}`}
    >
      {status === "idle" && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <span className="material-symbols-outlined text-lg">mic</span>
            </span>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Record Voice Answer</p>
              <p className="text-[11px] text-slate-400">Explain the solution aloud for the student</p>
            </div>
          </div>
          <button
            type="button"
            onClick={startRecording}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
          >
            <span className="material-symbols-outlined text-base">mic</span>
            <span>Record Voice</span>
          </button>
        </div>
      )}

      {status === "recording" && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600" />
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                Recording…
              </span>
              <span className="font-mono text-sm font-bold text-slate-800 dark:text-white bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                {formatTimer(recordSec)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-rose-500 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition"
            >
              <span className="material-symbols-outlined text-base">stop</span>
              <span>Done</span>
            </button>
          </div>
        </div>
      )}

      {status === "preview" && previewUrl && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-500 text-base">check_circle</span>
              Recorded Answer Preview ({formatTimer(recordSec)})
            </span>
            <button
              type="button"
              onClick={cancelRecording}
              className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 transition"
            >
              Discard
            </button>
          </div>

          <audio src={previewUrl} controls className="w-full h-10 rounded-lg outline-none" />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                cancelRecording();
                startRecording();
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Re-record
            </button>
            <button
              type="button"
              onClick={handleUploadAndSave}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <span className="material-symbols-outlined text-base">cloud_upload</span>
              <span>Attach Voice Answer</span>
            </button>
          </div>
        </div>
      )}

      {status === "uploading" && (
        <div className="flex items-center justify-center gap-2 py-3 text-xs font-bold text-blue-600 dark:text-blue-400">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span>Uploading and attaching voice answer…</span>
        </div>
      )}
    </div>
  );
}
