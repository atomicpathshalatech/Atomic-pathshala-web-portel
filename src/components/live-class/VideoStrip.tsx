"use client";

import React, { useEffect, useRef, useState, type RefObject } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  TrackToggle,
  VideoTrack,
  useLocalParticipant,
  useMediaDeviceSelect,
  useTracks,
  useConnectionState,
  ConnectionQualityIndicator,
} from "@livekit/components-react";
import { Track, ConnectionState, VideoQuality, Participant } from "livekit-client";

export interface VideoStripProps {
  whiteboardSessionId: string;
  variant?: "header" | "panel";
  role?: "TEACHER" | "STUDENT";
  teacherName?: string | null;
  isApprovedSpeaker?: boolean;
  speakerToken?: string | null;
  // Teacher-initiated connect (independent of hand-raise's isApprovedSpeaker
  // above — a separate grant, not a different name for the same thing).
  teacherAudioConnected?: boolean;
  teacherVideoConnected?: boolean;
  teacherConnectionToken?: string | null;
  settingsPortalRef?: RefObject<HTMLDivElement>;
}

export function VideoStrip({
  whiteboardSessionId,
  variant = "panel",
  role = "TEACHER",
  teacherName,
  isApprovedSpeaker = false,
  speakerToken = null,
  teacherAudioConnected = false,
  teacherVideoConnected = false,
  teacherConnectionToken = null,
  settingsPortalRef,
}: VideoStripProps) {
  const [creds, setCreds] = useState<{ token: string; url: string } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [useFallbackCamera, setUseFallbackCamera] = useState(false);

  // Determine active token: a student who is either an approved hand-raise
  // speaker or teacher-connected needs the publish-capable token instead of
  // the default subscribe-only one.
  const isStudentGrantedPublish = role === "STUDENT" && (isApprovedSpeaker || teacherAudioConnected || teacherVideoConnected);
  const activeToken = isStudentGrantedPublish ? (speakerToken || teacherConnectionToken || creds?.token) : creds?.token;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/whiteboard/sessions/${whiteboardSessionId}/video-token`);
        const json = await res.json();
        if (!res.ok || !json.success || !json.data?.url || !json.data?.token) {
          if (!cancelled) {
            setTokenError(json.error || "Video token unavailable");
            setUseFallbackCamera(role === "TEACHER");
          }
          return;
        }
        if (!cancelled) {
          setCreds({ token: json.data.token, url: json.data.url });
          setTokenError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setTokenError(err instanceof Error ? err.message : "Connection failed");
          setUseFallbackCamera(role === "TEACHER");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [whiteboardSessionId, role]);

  if (useFallbackCamera && role === "TEACHER") {
    return <LocalWebcamPreview variant={variant} teacherName={teacherName} />;
  }

  if (tokenError && role === "STUDENT") {
    return (
      <div className="w-full h-full bg-[#0a0b12] rounded-xl overflow-hidden border border-[#252836] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-2 shadow-inner">
          <span className="material-symbols-outlined text-2xl">sensors_off</span>
        </div>
        <p className="text-xs font-bold text-white truncate max-w-full">{teacherName || "Instructor"}</p>
        <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
          Connecting to live media stream...
        </span>
      </div>
    );
  }

  if (!creds || !activeToken) {
    return (
      <div className="w-full h-full bg-[#0a0b12] rounded-xl overflow-hidden border border-[#252836] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-xs font-medium text-slate-400">Initializing Live Stream…</span>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={creds.url}
      token={activeToken}
      connect
      // Connect without auto-publishing tracks to avoid getUserMedia race conditions or unwanted student publishing
      audio={false}
      video={false}
      className="contents"
      onError={(err) => {
        console.warn("[LiveKitRoom] Connection error:", err);
        if (role === "TEACHER") setUseFallbackCamera(true);
      }}
    >
      <VideoStripInner
        variant={variant}
        role={role}
        teacherName={teacherName}
        isApprovedSpeaker={isApprovedSpeaker}
        teacherAudioConnected={teacherAudioConnected}
        teacherVideoConnected={teacherVideoConnected}
        settingsPortalRef={settingsPortalRef}
      />
    </LiveKitRoom>
  );
}

/**
 * Inner LiveKit Component
 */
function VideoStripInner({
  variant,
  role = "TEACHER",
  teacherName,
  isApprovedSpeaker = false,
  teacherAudioConnected = false,
  teacherVideoConnected = false,
  settingsPortalRef,
}: {
  variant: "header" | "panel";
  role?: "TEACHER" | "STUDENT";
  teacherName?: string | null;
  isApprovedSpeaker?: boolean;
  teacherAudioConnected?: boolean;
  teacherVideoConnected?: boolean;
  settingsPortalRef?: RefObject<HTMLDivElement>;
}) {
  const connectionState = useConnectionState();
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone], { onlySubscribed: false });
  const { isCameraEnabled, isMicrophoneEnabled, localParticipant } = useLocalParticipant();

  const mic = useMediaDeviceSelect({ kind: "audioinput" });
  const cam = useMediaDeviceSelect({ kind: "videoinput" });
  const speaker = useMediaDeviceSelect({ kind: "audiooutput" });

  const [micError, setMicError] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  // Player controls state (Student)
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState<"auto" | "high" | "medium" | "low">("auto");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [controlsHovered, setControlsHovered] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoElemRef = useRef<HTMLVideoElement | null>(null);

  // Teacher media initialization: Camera & Mic enabled on join (Teacher only)
  useEffect(() => {
    let cancelled = false;
    if (role === "TEACHER") {
      (async () => {
        try {
          await localParticipant.setMicrophoneEnabled(true);
          if (!cancelled) setMicError(null);
        } catch (err) {
          if (!cancelled) setMicError(describeMediaError(err));
        }

        try {
          await localParticipant.setCameraEnabled(true);
          if (!cancelled) setCamError(null);
        } catch (err) {
          if (!cancelled) setCamError(describeMediaError(err));
        }
      })();
    } else if (role === "STUDENT" && isApprovedSpeaker) {
      // Student is approved to speak -> request microphone & video camera
      (async () => {
        try {
          await localParticipant.setMicrophoneEnabled(true);
          await localParticipant.setCameraEnabled(true);
          if (!cancelled) setMicError(null);
        } catch (err) {
          if (!cancelled) setMicError(describeMediaError(err));
        }
      })();
    } else if (role === "STUDENT" && (teacherAudioConnected || teacherVideoConnected)) {
      // Teacher connected this student directly (independent grant from the
      // hand-raise flow above) -> audio always, camera only when the teacher
      // also connected video.
      (async () => {
        try {
          await localParticipant.setMicrophoneEnabled(true);
          if (!cancelled) setMicError(null);
        } catch (err) {
          if (!cancelled) setMicError(describeMediaError(err));
        }
        try {
          await localParticipant.setCameraEnabled(teacherVideoConnected);
          if (!cancelled) setCamError(null);
        } catch (err) {
          if (!cancelled) setCamError(describeMediaError(err));
        }
      })();
    } else if (role === "STUDENT") {
      // No active grant (neither hand-raise approval nor teacher-connect) ->
      // strictly mute local mic & camera.
      localParticipant.setMicrophoneEnabled(false).catch(() => {});
      localParticipant.setCameraEnabled(false).catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [localParticipant, role, isApprovedSpeaker, teacherAudioConnected, teacherVideoConnected]);

  // Handle speaker sink selection if supported
  const handleSpeakerSelect = async (deviceId: string) => {
    speaker.setActiveMediaDevice(deviceId);
    if (videoElemRef.current && typeof (videoElemRef.current as any).setSinkId === "function") {
      try {
        await (videoElemRef.current as any).setSinkId(deviceId);
      } catch (err) {
        console.warn("setSinkId failed:", err);
      }
    }
  };

  // Find the primary camera track:
  // For student -> find remote teacher track (not local)
  // For teacher -> find local track
  const cameraTrack =
    role === "STUDENT"
      ? tracks.find((t) => t.source === Track.Source.Camera && !t.participant.isLocal)
      : tracks.find((t) => t.source === Track.Source.Camera && t.participant.isLocal) ?? tracks.find((t) => t.source === Track.Source.Camera);

  // Find any active remote student video/audio tracks connected to the room
  const remoteStudentVideoTracks = tracks.filter((t) => t.source === Track.Source.Camera && !t.participant.isLocal);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Picture-in-Picture toggle
  const togglePiP = async () => {
    const video = containerRef.current?.querySelector("video") || videoElemRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch (err) {
      console.warn("PiP toggle error:", err);
    }
  };

  // Simulcast quality change
  const handleQualityChange = (q: "auto" | "high" | "medium" | "low") => {
    setSelectedQuality(q);
    if (cameraTrack?.publication && "setVideoQuality" in cameraTrack.publication) {
      const livekitQuality =
        q === "high"
          ? VideoQuality.HIGH
          : q === "medium"
          ? VideoQuality.MEDIUM
          : q === "low"
          ? VideoQuality.LOW
          : VideoQuality.HIGH;
      (cameraTrack.publication as any).setVideoQuality?.(livekitQuality);
    }
  };

  // Reconnecting banner
  const isReconnecting = connectionState === ConnectionState.Reconnecting;
  const isConnecting = connectionState === ConnectionState.Connecting;

  // Header compact variant
  if (variant === "header") {
    return (
      <div className="flex items-center gap-2 bg-[#171924] px-3 py-1.5 rounded-full border border-[#252836]">
        <span className={`w-2 h-2 rounded-full ${connectionState === ConnectionState.Connected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
        <span className="text-xs font-bold text-gray-200">
          {connectionState === ConnectionState.Connected ? "SFU Live" : connectionState}
        </span>
      </div>
    );
  }

  // ===========================================================================
  // TEACHER VIEW
  // ===========================================================================
  if (role === "TEACHER") {
    return (
      <div ref={containerRef} className="relative w-full h-full bg-[#0a0b12] rounded-xl overflow-hidden border border-[#252836] flex items-center justify-center group">
        {/* Audio Renderer for any approved student speakers */}
        <RoomAudioRenderer />

        {/* Video Canvas */}
        {cameraTrack && cameraTrack.publication && !cameraTrack.publication.isMuted && isCameraEnabled ? (
          <VideoTrack trackRef={cameraTrack} className="w-full h-full object-cover transform scale-x-[-1]" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0f18] p-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-2 shadow-inner">
              <span className="material-symbols-outlined text-3xl">account_circle</span>
            </div>
            <span className="text-xs font-bold text-white">Educator Camera Off</span>
            <span className="text-[10px] text-blue-300 mt-1 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isMicrophoneEnabled ? "bg-emerald-400" : "bg-amber-400"}`} />
              {isMicrophoneEnabled ? "Microphone is LIVE" : "Microphone Muted"}
            </span>
            {camError && (
              <button
                type="button"
                onClick={() => localParticipant.setCameraEnabled(true).catch(() => {})}
                className="mt-2 text-[11px] font-bold text-blue-300 hover:text-blue-200 underline underline-offset-2"
              >
                Retry camera access
              </button>
            )}
          </div>
        )}

        {/* Floating Live Student Video Call Tile (Picture-in-Picture on Teacher Screen) */}
        {remoteStudentVideoTracks.length > 0 && (
          <div className="absolute top-2 right-2 z-30 flex flex-col gap-1.5">
            {remoteStudentVideoTracks.map((stTrack) => (
              <div
                key={stTrack.participant.identity}
                className="w-36 sm:w-44 aspect-video rounded-xl overflow-hidden border-2 border-blue-500 shadow-2xl bg-slate-950 relative animate-in zoom-in-95 duration-200 ring-2 ring-blue-400/40"
              >
                <VideoTrack trackRef={stTrack} className="w-full h-full object-cover" />
                <div className="absolute top-1 left-1 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-bold text-blue-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                  <span className="truncate max-w-[80px]">{stTrack.participant.name || "Student"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reconnecting Overlay */}
        {isReconnecting && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center z-30 text-center p-2">
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-1" />
            <span className="text-xs font-bold text-amber-300">Reconnecting stream…</span>
          </div>
        )}

        {/* Top Badges: Connection Quality & Role */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 z-20">
          <div className="bg-black/75 px-2 py-0.5 rounded-md text-[10px] text-white backdrop-blur-sm border border-white/10 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Educator Live
          </div>
          <div className="bg-black/75 px-1.5 py-0.5 rounded-md text-[10px] text-slate-300 backdrop-blur-sm border border-white/10 flex items-center">
            <ConnectionQualityIndicator participant={localParticipant} />
          </div>
        </div>

        {/* Bottom Controls Bar */}
        <div className="absolute bottom-2 inset-x-2 flex items-center justify-between z-20">
          {/* Status info */}
          <div className="flex items-center gap-1">
            {micError && (
              <span className="bg-rose-900/90 text-rose-200 text-[9px] px-1.5 py-0.5 rounded font-bold border border-rose-500/40">
                Mic Blocked
              </span>
            )}
          </div>

          {/* Teacher Action Toggles */}
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md p-1 rounded-lg border border-white/10">
            <TrackToggle
              source={Track.Source.Microphone}
              showIcon={false}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition ${
                isMicrophoneEnabled ? "bg-slate-700/80 text-white hover:bg-slate-600" : "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              }`}
              title={isMicrophoneEnabled ? "Mute Microphone" : "Unmute Microphone"}
            >
              <span className="material-symbols-outlined text-base">{isMicrophoneEnabled ? "mic" : "mic_off"}</span>
            </TrackToggle>

            <TrackToggle
              source={Track.Source.Camera}
              showIcon={false}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition ${
                isCameraEnabled ? "bg-slate-700/80 text-white hover:bg-slate-600" : "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              }`}
              title={isCameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
            >
              <span className="material-symbols-outlined text-base">{isCameraEnabled ? "videocam" : "videocam_off"}</span>
            </TrackToggle>

            <TeacherDeviceSettingsPopover mic={mic} cam={cam} speaker={speaker} onSpeakerChange={handleSpeakerSelect} />
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // STUDENT VIEW — FULL PRODUCTION VIDEO PLAYER
  // ===========================================================================
  const hasTeacherVideo = Boolean(cameraTrack?.publication && !cameraTrack.publication.isMuted && !isPaused);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setControlsHovered(true)}
      onMouseLeave={() => setControlsHovered(false)}
      className="relative w-full h-full bg-[#0a0b12] rounded-xl overflow-hidden border border-[#252836] flex items-center justify-center group select-none"
    >
      {/* Authoritative LiveKit Audio Renderer (controlled by volume & isMuted state) */}
      <RoomAudioRenderer volume={isMuted ? 0 : volume} />

      {/* Main Video Stream */}
      {hasTeacherVideo && cameraTrack ? (
        <VideoTrack trackRef={cameraTrack} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0f18] p-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-2 shadow-inner">
            <span className="material-symbols-outlined text-3xl">account_circle</span>
          </div>
          <span className="text-xs font-bold text-white">{teacherName || "Instructor"}</span>
          <span className="text-[10px] text-blue-300 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Audio Stream Active · Camera Standby
          </span>
        </div>
      )}

      {/* Buffering / Connecting / Reconnecting Overlay */}
      {(isConnecting || isReconnecting) && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center z-30 text-center p-2">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-1" />
          <span className="text-xs font-bold text-blue-300">
            {isReconnecting ? "Reconnecting stream…" : "Connecting stream…"}
          </span>
        </div>
      )}

      {/* Top Header: Instructor Name & Network Quality Indicator */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-20 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-bold text-white border border-white/10 flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${hasTeacherVideo ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
          <span className="truncate max-w-[130px]">{teacherName || "Instructor"}</span>
        </div>

        {/* Network status */}
        <div className="bg-black/80 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-300 border border-white/10 flex items-center gap-1">
          <span className="material-symbols-outlined text-xs text-blue-400">signal_cellular_alt</span>
          <span>{connectionState === ConnectionState.Connected ? "HD Stream" : connectionState}</span>
        </div>
      </div>

      {/* Approved Speaker Badge & Local Mic Controls for Student */}
      {isApprovedSpeaker && (
        <div className="absolute top-10 left-2 z-20 flex items-center gap-1 bg-emerald-950/90 border border-emerald-500/60 rounded-lg px-2 py-1 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[10px] font-bold text-emerald-200">Speaker Active</span>
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon={false}
            className={`ml-1 w-5 h-5 rounded flex items-center justify-center text-white ${
              isMicrophoneEnabled ? "bg-emerald-600" : "bg-rose-600"
            }`}
            title={isMicrophoneEnabled ? "Mute My Mic" : "Unmute My Mic"}
          >
            <span className="material-symbols-outlined text-xs">{isMicrophoneEnabled ? "mic" : "mic_off"}</span>
          </TrackToggle>
        </div>
      )}

      {/* Interactive Controls Overlay on Hover */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-6 transition-opacity duration-200 z-20 flex items-center justify-between ${
          controlsHovered || isPaused || isMuted ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
        }`}
      >
        {/* Left: Play/Pause & Volume */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
            title={isPaused ? "Resume Video" : "Pause Video"}
          >
            <span className="material-symbols-outlined text-sm">{isPaused ? "play_arrow" : "pause"}</span>
          </button>

          {/* Mute Toggle */}
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
            title={isMuted ? "Unmute Audio" : "Mute Audio"}
          >
            <span className="material-symbols-outlined text-sm">{isMuted || volume === 0 ? "volume_off" : volume < 0.5 ? "volume_down" : "volume_up"}</span>
          </button>

          {/* Volume Slider */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              if (val > 0 && isMuted) setIsMuted(false);
            }}
            className="w-14 xs:w-18 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          />
        </div>

        {/* Right: Quality, PiP, Fullscreen */}
        <div className="flex items-center gap-1">
          {/* Quality Selector (Real Simulcast / Stream layers) */}
          <div className="relative group/quality">
            <button
              type="button"
              className="px-1.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-bold text-slate-200 flex items-center gap-0.5"
              title="Stream Quality"
            >
              <span>{selectedQuality.toUpperCase()}</span>
            </button>
            <div className="absolute bottom-full right-0 mb-1 hidden group-hover/quality:flex flex-col bg-[#161824] border border-[#2d2e3b] rounded-lg shadow-xl p-1 z-30 min-w-[70px]">
              {(["auto", "high", "medium", "low"] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleQualityChange(q)}
                  className={`text-[10px] font-semibold px-2 py-1 text-left rounded hover:bg-blue-600 hover:text-white transition ${
                    selectedQuality === q ? "text-blue-400 font-bold bg-blue-950/60" : "text-slate-300"
                  }`}
                >
                  {q === "auto" ? "Auto" : q.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Picture-in-Picture */}
          <button
            type="button"
            onClick={togglePiP}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition ${
              isPiPActive ? "bg-blue-600 text-white" : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title="Picture in Picture"
          >
            <span className="material-symbols-outlined text-sm">picture_in_picture_alt</span>
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Video"}
          >
            <span className="material-symbols-outlined text-sm">{isFullscreen ? "fullscreen_exit" : "fullscreen"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Teacher Device Settings Popover
 */
function TeacherDeviceSettingsPopover({
  mic,
  cam,
  speaker,
  onSpeakerChange,
}: {
  mic: ReturnType<typeof useMediaDeviceSelect>;
  cam: ReturnType<typeof useMediaDeviceSelect>;
  speaker: ReturnType<typeof useMediaDeviceSelect>;
  onSpeakerChange: (deviceId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-7 h-7 rounded-md bg-slate-700/80 hover:bg-slate-600 text-white flex items-center justify-center transition"
        title="Hardware & Media Device Settings"
      >
        <span className="material-symbols-outlined text-sm">settings</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 mb-2 w-64 p-3 rounded-xl border border-[#2d2e3b] bg-[#1a1b23] text-white shadow-2xl z-50 space-y-3">
            <div className="flex items-center justify-between border-b border-[#2d2e3b] pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-blue-400">tune</span>
                AV Hardware Settings
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Camera */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Camera Device
              </label>
              <select
                value={cam.activeDeviceId}
                onChange={(e) => cam.setActiveMediaDevice(e.target.value)}
                className="w-full bg-[#10111a] border border-[#2d2e3b] rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
              >
                {cam.devices.length === 0 && <option value="">No camera detected</option>}
                {cam.devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera (${d.deviceId.slice(0, 5)})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Microphone */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Microphone Device
              </label>
              <select
                value={mic.activeDeviceId}
                onChange={(e) => mic.setActiveMediaDevice(e.target.value)}
                className="w-full bg-[#10111a] border border-[#2d2e3b] rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
              >
                {mic.devices.length === 0 && <option value="">No microphone detected</option>}
                {mic.devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone (${d.deviceId.slice(0, 5)})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Speaker / Output */}
            {speaker.devices.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Audio Output / Speaker
                </label>
                <select
                  value={speaker.activeDeviceId}
                  onChange={(e) => onSpeakerChange(e.target.value)}
                  className="w-full bg-[#10111a] border border-[#2d2e3b] rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                >
                  {speaker.devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Speaker (${d.deviceId.slice(0, 5)})`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Fallback direct webcam preview for teacher if LiveKit cloud connection is unconfigured
 */
function LocalWebcamPreview({
  variant,
  teacherName,
}: {
  variant: "header" | "panel";
  teacherName?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    async function initCam() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: true,
        });
        currentStream = s;
        setStream(s);
        setCamError(null);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) {
        setCamError(describeMediaError(err));
      }
    }
    if (cameraActive) initCam();
    return () => {
      if (currentStream) currentStream.getTracks().forEach((t) => t.stop());
    };
  }, [cameraActive]);

  const toggleCamera = () => {
    if (stream) stream.getVideoTracks().forEach((t) => (t.enabled = !cameraActive));
    setCameraActive(!cameraActive);
  };

  const toggleMic = () => {
    if (stream) stream.getAudioTracks().forEach((t) => (t.enabled = !micActive));
    setMicActive(!micActive);
  };

  if (variant === "header") {
    return (
      <div className="flex items-center gap-2 bg-[#171924] px-3 py-1.5 rounded-full border border-[#252836]">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-bold text-gray-200">Local Camera Active</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#0a0b12] rounded-xl overflow-hidden border border-[#252836] flex items-center justify-center">
      {cameraActive && !camError ? (
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 text-gray-500 p-4 text-center">
          <span className="material-symbols-outlined text-4xl">videocam_off</span>
          <span className="text-xs font-semibold max-w-[220px]">{camError || "Camera Off"}</span>
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 px-2.5 py-1 rounded-lg text-xs font-bold text-white backdrop-blur-sm border border-white/10">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        {teacherName || "Educator"} (Local Preview)
      </div>

      <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleMic}
          className={`w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition ${
            micActive ? "bg-black/60 text-white" : "bg-rose-600 text-white"
          }`}
          title={micActive ? "Mute Microphone" : "Unmute Microphone"}
        >
          <span className="material-symbols-outlined text-sm">{micActive ? "mic" : "mic_off"}</span>
        </button>

        <button
          type="button"
          onClick={toggleCamera}
          className={`w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition ${
            cameraActive ? "bg-black/60 text-white" : "bg-rose-600 text-white"
          }`}
          title={cameraActive ? "Turn Off Camera" : "Turn On Camera"}
        >
          <span className="material-symbols-outlined text-sm">{cameraActive ? "videocam" : "videocam_off"}</span>
        </button>
      </div>
    </div>
  );
}

function describeMediaError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : undefined;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera/mic permission denied — allow access in your browser's site settings.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera or microphone found on this device.";
    case "NotReadableError":
      return "Camera/mic is already in use by another application.";
    default:
      return "Camera or microphone permission required.";
  }
}
