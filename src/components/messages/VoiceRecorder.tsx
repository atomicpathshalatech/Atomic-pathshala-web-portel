"use client";

import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

export function VoiceRecorder({
  onSendVoice,
  onCancel,
}: {
  onSendVoice: (audioBlob: Blob, durationSeconds: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Audio recording is not supported in this browser");
        onCancel();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setRecording(true);

      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      toast.error("Microphone access denied or unavailable");
      onCancel();
    }
  };

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current.stop();
      } catch {
        // Non-blocking
      }
    }
  };

  const handleStopAndSend = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    setUploading(true);

    const stream = mediaRecorderRef.current.stream;
    mediaRecorderRef.current.onstop = async () => {
      stream?.getTracks().forEach((track) => track.stop());
      const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
      try {
        await onSendVoice(audioBlob, seconds);
      } catch {
        toast.error("Failed to send voice message");
      } finally {
        setUploading(false);
      }
    };

    mediaRecorderRef.current.stop();
  };

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="flex items-center justify-between w-full px-3 py-2 bg-emerald-50 dark:bg-[#111b21] rounded-2xl border border-emerald-200 dark:border-emerald-800/40 animate-in fade-in duration-150">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={uploading}
          className="w-9 h-9 rounded-full hover:bg-red-100 dark:hover:bg-red-950/40 text-rose-600 flex items-center justify-center transition"
          title="Cancel recording"
        >
          <span className="material-symbols-outlined text-xl">delete</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
          <span className="text-sm font-semibold font-mono text-slate-800 dark:text-slate-200">
            {formatTimer(seconds)}
          </span>
        </div>
      </div>

      <div className="flex-1 mx-4 flex items-center justify-center">
        <span className="text-xs text-slate-500 dark:text-slate-400 italic">Recording voice note...</span>
      </div>

      <button
        type="button"
        onClick={handleStopAndSend}
        disabled={uploading}
        className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white flex items-center justify-center shadow-md transition active:scale-95"
        title="Send voice note"
      >
        <span className={`material-symbols-outlined text-xl ${uploading ? "animate-spin" : ""}`}>
          {uploading ? "progress_activity" : "send"}
        </span>
      </button>
    </div>
  );
}
