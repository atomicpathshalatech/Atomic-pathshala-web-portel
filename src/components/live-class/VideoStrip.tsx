"use client";

import { useEffect, useState, type RefObject } from "react";
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

/**
 * Compact camera+mic strip embedded in the live-class rooms — NOT a
 * full-screen video call UI. Both teacher and student get the same
 * component: full two-way video, small tiles alongside the whiteboard
 * rather than replacing it, since the board is still the main teaching
 * surface. Built on @livekit/components-react's primitives (not its
 * prefab <VideoConference>) precisely so the layout can stay this compact.
 *
 * Fails soft: if LiveKit isn't configured, or the token/connection fails,
 * this shows a small inline notice instead of breaking the rest of the live
 * class — hand raise, quiz, and the board (mirrored or not) all work
 * whether or not video comes up.
 *
 * `variant` picks the surrounding chrome: "header" is the original compact
 * horizontal strip (used nowhere currently, kept for any future header
 * placement); "panel" fills a fixed-height dark box — used by
 * TeacherLiveClassRoom's right-panel video tile.
 *
 * `settingsPortalRef`, when provided, renders the real device-picker
 * <select>s into that DOM node via a portal — the node can live anywhere
 * in the tree (e.g. inside a Settings modal that is NOT a descendant of
 * <LiveKitRoom>) because a portal keeps its React context ancestry, which
 * is what useMediaDeviceSelect actually needs; only the DOM location moves.
 */
export function VideoStrip({
  whiteboardSessionId,
  variant = "header",
  settingsPortalRef,
}: {
  whiteboardSessionId: string;
  variant?: "header" | "panel";
  settingsPortalRef?: RefObject<HTMLDivElement>;
}) {
  const [creds, setCreds] = useState<{ token: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/whiteboard/sessions/${whiteboardSessionId}/video-token`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          if (!cancelled) setError(json.error ?? "Video call unavailable.");
          return;
        }
        if (!cancelled) setCreds({ token: json.data.token, url: json.data.url });
      } catch {
        if (!cancelled) setError("Could not reach the video server.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [whiteboardSessionId]);

  if (error) {
    return variant === "panel" ? (
      <div className="h-full flex items-center justify-center gap-1.5 text-sm text-gray-500 px-2 text-center">
        <span className="material-symbols-outlined text-base">videocam_off</span>
        {error}
      </div>
    ) : (
      <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant px-2">
        <span className="material-symbols-outlined text-base">videocam_off</span>
        {error}
      </div>
    );
  }

  if (!creds) {
    return variant === "panel" ? (
      <div className="h-full flex items-center justify-center text-sm text-gray-500">Connecting video…</div>
    ) : (
      <div className="text-label-sm text-on-surface-variant px-2">Connecting video…</div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={creds.url}
      token={creds.token}
      connect
      audio
      video
      className="contents"
      onError={() => setError("Could not connect to the video call.")}
    >
      <RoomAudioRenderer />
      <VideoStripInner variant={variant} settingsPortalRef={settingsPortalRef} />
    </LiveKitRoom>
  );
}

function VideoStripInner({
  variant,
  settingsPortalRef,
}: {
  variant: "header" | "panel";
  settingsPortalRef?: RefObject<HTMLDivElement>;
}) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const { isCameraEnabled, isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const mic = useMediaDeviceSelect({ kind: "audioinput" });
  const cam = useMediaDeviceSelect({ kind: "videoinput" });

  const [portalNode, setPortalNode] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    // Re-checked on every render via a cheap ref read — the Settings modal
    // mounts/unmounts its own container div, so this can't just be read
    // once on mount.
    setPortalNode(settingsPortalRef?.current ?? null);
  });

  if (variant === "panel") {
    const primary = tracks.find((t) => t.participant.isLocal) ?? tracks[0];
    return (
      <div className="relative w-full h-full">
        {primary ? (
          primary.publication && !primary.publication.isMuted ? (
            <VideoTrack trackRef={primary} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <span className="material-symbols-outlined text-gray-600 text-4xl">videocam_off</span>
            </div>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <span className="text-sm text-gray-500">Waiting for video…</span>
          </div>
        )}

        <div className="absolute bottom-2 left-2 flex items-center gap-2">
          <div className="bg-black/60 px-2 py-1 rounded text-xs text-white backdrop-blur-sm border border-white/10">
            {primary?.participant.isLocal ? "You" : primary?.participant.name || localParticipant.name || "You"}
          </div>
        </div>

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

        {tracks.length > 1 && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {tracks
              .filter((t) => t !== primary)
              .slice(0, 3)
              .map((t) => (
                <div
                  key={t.participant.identity}
                  className="relative w-16 h-11 rounded overflow-hidden bg-gray-900 border border-white/10"
                >
                  {t.publication && !t.publication.isMuted ? (
                    <VideoTrack trackRef={t} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-gray-500 text-sm">videocam_off</span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {portalNode &&
          createPortal(<AudioVideoSettingsFields mic={mic} cam={cam} />, portalNode)}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 overflow-x-auto max-w-[280px]">
        {tracks.map((t) => (
          <div
            key={t.participant.identity}
            className="relative w-16 h-11 rounded-lg overflow-hidden bg-surface-container-high shrink-0"
          >
            {t.publication && !t.publication.isMuted ? (
              <VideoTrack trackRef={t} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant text-lg">videocam_off</span>
              </div>
            )}
            <span className="absolute bottom-0 left-0 right-0 text-[8px] leading-tight text-white bg-black/50 px-1 truncate">
              {t.participant.isLocal ? "You" : t.participant.name || "Participant"}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <TrackToggle
          source={Track.Source.Microphone}
          showIcon={false}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
            isMicrophoneEnabled ? "bg-primary/10 text-primary" : "bg-error/10 text-error"
          }`}
          title={isMicrophoneEnabled ? "Mute mic" : "Unmute mic"}
        >
          <span className="material-symbols-outlined text-base">
            {isMicrophoneEnabled ? "mic" : "mic_off"}
          </span>
        </TrackToggle>
        <TrackToggle
          source={Track.Source.Camera}
          showIcon={false}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
            isCameraEnabled ? "bg-primary/10 text-primary" : "bg-error/10 text-error"
          }`}
          title={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
        >
          <span className="material-symbols-outlined text-base">
            {isCameraEnabled ? "videocam" : "videocam_off"}
          </span>
        </TrackToggle>
        <DeviceSettingsPopover mic={mic} cam={cam} />
        {portalNode &&
          createPortal(<AudioVideoSettingsFields mic={mic} cam={cam} />, portalNode)}
      </div>
    </div>
  );
}

type DeviceSelect = ReturnType<typeof useMediaDeviceSelect>;

/**
 * The actual mic/camera <select> fields, extracted so both the quick
 * on-tile popover and the Settings-modal portal render identical, equally
 * real controls — switching a device from either place swaps the active
 * input on the connected room, not just a local preference.
 */
function AudioVideoSettingsFields({ mic, cam, dark }: { mic: DeviceSelect; cam: DeviceSelect; dark?: boolean }) {
  const labelCls = dark
    ? "text-[10px] font-medium text-gray-500 uppercase tracking-wide"
    : "text-[10px] font-label-sm text-on-surface-variant uppercase tracking-wide";
  const selectCls = dark
    ? "w-full mt-1 rounded-lg border border-[#2d2e3b] bg-[#10131b] text-white py-2 px-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    : "w-full mt-1 rounded-lg border border-outline-variant bg-surface-container-lowest py-1.5 px-2 text-body-sm outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <>
      <div>
        <label className={labelCls}>Microphone</label>
        <select value={mic.activeDeviceId} onChange={(e) => mic.setActiveMediaDevice(e.target.value)} className={selectCls}>
          {mic.devices.length === 0 && <option value="">No microphone found</option>}
          {mic.devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || "Microphone"}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Camera</label>
        <select value={cam.activeDeviceId} onChange={(e) => cam.setActiveMediaDevice(e.target.value)} className={selectCls}>
          {cam.devices.length === 0 && <option value="">No camera found</option>}
          {cam.devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || "Camera"}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

/**
 * Real mic/camera device picker — useMediaDeviceSelect needs the LiveKit
 * room context, which only exists inside <LiveKitRoom> (see VideoStrip
 * above), so this lives here rather than in a standalone settings modal
 * rendered outside that provider.
 */
function DeviceSettingsPopover({ mic, cam, dark }: { mic: DeviceSelect; cam: DeviceSelect; dark?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          dark
            ? "w-7 h-7 rounded-full flex items-center justify-center bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 transition-colors"
            : "w-7 h-7 rounded-full flex items-center justify-center bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high transition-colors"
        }
        title="Audio & video settings"
      >
        <span className="material-symbols-outlined text-base">tune</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={
              dark
                ? "absolute right-0 bottom-9 z-20 w-56 bg-[#1a1b23] border border-[#2d2e3b] rounded-xl p-3 space-y-3 shadow-2xl"
                : "absolute right-0 top-9 z-20 w-56 glass-card rounded-xl p-3 space-y-3 shadow-lg"
            }
          >
            <AudioVideoSettingsFields mic={mic} cam={cam} dark={dark} />
          </div>
        </>
      )}
    </div>
  );
}
