"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  TrackToggle,
  VideoTrack,
  useLocalParticipant,
  useMediaDeviceSelect,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";

export function VideoStrip({
  whiteboardSessionId,
  variant = "header",
  role = "TEACHER",
  teacherName,
  settingsPortalRef,
}: {
  whiteboardSessionId: string;
  variant?: "header" | "panel";
  role?: "TEACHER" | "STUDENT";
  teacherName?: string | null;
  settingsPortalRef?: RefObject<HTMLDivElement>;
}) {
  const [creds, setCreds] = useState<{ token: string; url: string } | null>(null);
  const [useFallbackCamera, setUseFallbackCamera] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/whiteboard/sessions/${whiteboardSessionId}/video-token`);
        const json = await res.json();
        if (!res.ok || !json.success || !json.data?.url || !json.data?.token) {
          if (!cancelled) setUseFallbackCamera(true);
          return;
        }
        if (!cancelled) setCreds({ token: json.data.token, url: json.data.url });
      } catch {
        if (!cancelled) setUseFallbackCamera(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [whiteboardSessionId]);

  if (useFallbackCamera || !creds) {
    return <LocalWebcamPreview variant={variant} role={role} teacherName={teacherName} />;
  }

  return (
    <LiveKitRoom
      serverUrl={creds.url}
      token={creds.token}
      connect
      audio
      video={role === "TEACHER"}
      className="contents"
      onError={() => setUseFallbackCamera(true)}
    >
      <RoomAudioRenderer />
      <VideoStripInner variant={variant} role={role} teacherName={teacherName} settingsPortalRef={settingsPortalRef} />
    </LiveKitRoom>
  );
}

/**
 * Reliable Direct HTML5 Webcam component that always works in modern browsers
 * without requiring third-party cloud signaling credentials.
 */
function LocalWebcamPreview({
  variant,
  role = "TEACHER",
  teacherName,
}: {
  variant: "header" | "panel";
  role?: "TEACHER" | "STUDENT";
  teacherName?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    if (role === "STUDENT") return;
    let currentStream: MediaStream | null = null;

    async function initCam() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: true,
        });
        currentStream = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch {
        setCamError("Camera or Mic permission required");
      }
    }

    if (cameraActive) {
      initCam();
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraActive, role]);

  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach((t) => (t.enabled = !cameraActive));
    }
    setCameraActive(!cameraActive);
  };

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach((t) => (t.enabled = !micActive));
    }
    setMicActive(!micActive);
  };

  if (role === "STUDENT") {
    return (
      <div className="relative w-full h-full bg-[#0a0b12] rounded-xl overflow-hidden border border-[#252836] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mb-2 shadow-md">
          <span className="material-symbols-outlined text-2xl">person</span>
        </div>
        <p className="text-xs font-bold text-white truncate max-w-full">
          {teacherName || "Instructor"}
        </p>
        <span className="text-[10px] text-indigo-300 font-medium mt-1 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Camera Feed Standby
        </span>
      </div>
    );
  }

  if (variant === "panel") {
    return (
      <div className="relative w-full h-full bg-[#0a0b12] rounded-xl overflow-hidden border border-[#252836] flex items-center justify-center">
        {cameraActive && !camError ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-gray-500 p-4 text-center">
            <span className="material-symbols-outlined text-4xl">videocam_off</span>
            <span className="text-xs font-semibold">{camError || "Camera Off"}</span>
          </div>
        )}

        {/* Name Badge */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 px-2.5 py-1 rounded-lg text-xs font-bold text-white backdrop-blur-sm border border-white/10">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Educator (Live)
        </div>

        {/* Controls */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleMic}
            className={`w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition ${
              micActive ? "bg-black/60 text-white hover:bg-black/80" : "bg-rose-600 text-white"
            }`}
            title={micActive ? "Mute Microphone" : "Unmute Microphone"}
          >
            <span className="material-symbols-outlined text-sm">{micActive ? "mic" : "mic_off"}</span>
          </button>

          <button
            type="button"
            onClick={toggleCamera}
            className={`w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition ${
              cameraActive ? "bg-black/60 text-white hover:bg-black/80" : "bg-rose-600 text-white"
            }`}
            title={cameraActive ? "Turn Off Camera" : "Turn On Camera"}
          >
            <span className="material-symbols-outlined text-sm">{cameraActive ? "videocam" : "videocam_off"}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-[#171924] px-3 py-1.5 rounded-full border border-[#252836]">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-xs font-bold text-gray-200">Educator Cam</span>
    </div>
  );
}

function VideoStripInner({
  variant,
  role = "TEACHER",
  teacherName,
  settingsPortalRef,
}: {
  variant: "header" | "panel";
  role?: "TEACHER" | "STUDENT";
  teacherName?: string | null;
  settingsPortalRef?: RefObject<HTMLDivElement>;
}) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const { isCameraEnabled, isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const mic = useMediaDeviceSelect({ kind: "audioinput" });
  const cam = useMediaDeviceSelect({ kind: "videoinput" });

  const [, setPortalNode] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    setPortalNode(settingsPortalRef?.current ?? null);
  });

  if (variant === "panel") {
    const primary =
      role === "STUDENT"
        ? (tracks.find((t) => !t.participant.isLocal) ?? (tracks[0]?.participant.isLocal ? null : tracks[0]))
        : (tracks.find((t) => t.participant.isLocal) ?? tracks[0]);

    return (
      <div className="relative w-full h-full bg-[#0a0b12] rounded-xl overflow-hidden border border-[#252836]">
        {primary ? (
          primary.publication && !primary.publication.isMuted ? (
            <VideoTrack trackRef={primary} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black gap-2 text-center p-4">
              <span className="material-symbols-outlined text-gray-600 text-4xl">videocam_off</span>
              <span className="text-xs text-gray-400">{teacherName || "Instructor"} camera is muted</span>
            </div>
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0f18] p-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mb-2 shadow-md">
              <span className="material-symbols-outlined text-2xl">person</span>
            </div>
            <span className="text-xs font-bold text-white">{teacherName || "Instructor"}</span>
            <span className="text-[10px] text-indigo-300 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Camera Feed Standby
            </span>
          </div>
        )}

        <div className="absolute bottom-2 left-2 flex items-center gap-2">
          <div className="bg-black/70 px-2 py-1 rounded text-xs text-white backdrop-blur-sm border border-white/10 font-bold flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${primary ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
            {role === "STUDENT"
              ? teacherName || "Instructor"
              : primary?.participant.isLocal
              ? "Educator"
              : primary?.participant.name || localParticipant.name || "Educator"}
          </div>
        </div>

        {role === "TEACHER" && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <TrackToggle
              source={Track.Source.Microphone}
              showIcon={false}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm ${
                isMicrophoneEnabled ? "bg-black/50 text-white" : "bg-red-600/80 text-white"
              }`}
              title={isMicrophoneEnabled ? "Mute mic" : "Unmute mic"}
            >
              <span className="material-symbols-outlined text-base">{isMicrophoneEnabled ? "mic" : "mic_off"}</span>
            </TrackToggle>
            <TrackToggle
              source={Track.Source.Camera}
              showIcon={false}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm ${
                isCameraEnabled ? "bg-black/50 text-white" : "bg-red-600/80 text-white"
              }`}
              title={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
            >
              <span className="material-symbols-outlined text-base">
                {isCameraEnabled ? "videocam" : "videocam_off"}
              </span>
            </TrackToggle>
            <DeviceSettingsPopover mic={mic} cam={cam} dark />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-300">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span>Live Video</span>
    </div>
  );
}

function DeviceSettingsPopover({
  mic,
  cam,
  dark,
}: {
  mic: ReturnType<typeof useMediaDeviceSelect>;
  cam: ReturnType<typeof useMediaDeviceSelect>;
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition ${
          dark ? "bg-black/50 text-white hover:bg-black/70" : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
        }`}
        title="Device Settings"
      >
        <span className="material-symbols-outlined text-sm">settings</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute bottom-full right-0 mb-2 w-64 p-3 rounded-xl border shadow-2xl z-50 space-y-3 ${
              dark ? "bg-[#1a1b23] border-[#2d2e3b] text-white" : "bg-surface-container-lowest border-outline-variant text-on-surface"
            }`}
          >
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Camera
              </label>
              <select
                value={cam.activeDeviceId}
                onChange={(e) => cam.setActiveMediaDevice(e.target.value)}
                className="w-full bg-[#10111a] border border-[#2d2e3b] rounded-lg px-2 py-1.5 text-xs text-white outline-none"
              >
                {cam.devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Microphone
              </label>
              <select
                value={mic.activeDeviceId}
                onChange={(e) => mic.setActiveMediaDevice(e.target.value)}
                className="w-full bg-[#10111a] border border-[#2d2e3b] rounded-lg px-2 py-1.5 text-xs text-white outline-none"
              >
                {mic.devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
