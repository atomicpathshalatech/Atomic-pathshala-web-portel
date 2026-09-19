"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PublisherState = "idle" | "requesting-media" | "connecting" | "live" | "disconnected" | "error";

export type CameraPublisherHandle = {
  start: () => Promise<void>;
  stop: () => void;
};

/**
 * A minimal WHIP (WebRTC-HTTP Ingestion Protocol) publisher — no LiveKit, no
 * external library. getUserMedia -> RTCPeerConnection -> POST the SDP offer
 * to the relay's WHIP URL -> setRemoteDescription on the answer. Used only
 * for ClassroomStreamMethod.BROWSER_RELAY; EXTERNAL_ENCODER sessions never
 * render this component at all (the teacher's own OBS/phone app publishes
 * directly to YouTube instead).
 */
export function CameraPublisher({
  whipUrl,
  onStateChange,
}: {
  whipUrl: string;
  onStateChange?: (state: PublisherState, detail?: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<PublisherState>("idle");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const setStateAndNotify = useCallback(
    (next: PublisherState, detail?: string) => {
      setState(next);
      onStateChange?.(next, detail);
    },
    [onStateChange]
  );

  const stop = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStateAndNotify("idle");
  }, [setStateAndNotify]);

  const start = useCallback(async () => {
    try {
      setStateAndNotify("requesting-media");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      setStateAndNotify("connecting");
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setStateAndNotify("live");
        } else if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
          setStateAndNotify("disconnected");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(whipUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!res.ok) throw new Error(`Relay rejected the publish request (${res.status}).`);

      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (err) {
      console.error("[classroom_whip_publish_error]", err);
      setStateAndNotify("error", err instanceof Error ? err.message : "Could not start the camera.");
      stop();
    }
  }, [whipUrl, setStateAndNotify, stop]);

  useEffect(() => stop, [stop]);

  const toggleMute = () => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted((v) => !v);
  };
  const toggleCamera = () => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = cameraOff));
    setCameraOff((v) => !v);
  };

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        {state === "live" && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600 text-white text-[11px] font-black shadow-md">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        )}
        {state !== "live" && state !== "idle" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm">
            {state === "requesting-media" && "Requesting camera/mic access..."}
            {state === "connecting" && "Connecting to relay..."}
            {state === "disconnected" && "Connection lost — reconnecting..."}
            {state === "error" && "Could not start the camera."}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {state === "idle" || state === "error" ? (
          <button
            type="button"
            onClick={start}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition"
          >
            Start Camera
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleMute}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
              title={muted ? "Unmute" : "Mute"}
            >
              <span className="material-symbols-outlined text-base">{muted ? "mic_off" : "mic"}</span>
            </button>
            <button
              type="button"
              onClick={toggleCamera}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
              title={cameraOff ? "Turn camera on" : "Turn camera off"}
            >
              <span className="material-symbols-outlined text-base">{cameraOff ? "videocam_off" : "videocam"}</span>
            </button>
            <button
              type="button"
              onClick={stop}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition"
            >
              Stop Camera
            </button>
          </>
        )}
      </div>
    </div>
  );
}
