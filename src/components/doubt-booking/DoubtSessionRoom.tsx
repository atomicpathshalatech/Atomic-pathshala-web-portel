"use client";

import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  TrackToggle,
  useTracks,
  useLocalParticipant,
  useConnectionState,
} from "@livekit/components-react";
import { Track, ConnectionState } from "livekit-client";

/**
 * A private 1:1 doubt-session video room — deliberately NOT VideoStrip.tsx
 * (the classroom component). VideoStrip is built around an asymmetric
 * one-teacher-broadcasts-to-many-students shape (isApprovedSpeaker,
 * camera-position/shape settings, a PiP corner layout, a webcam-fallback
 * path for the teacher specifically) that doesn't fit a symmetric,
 * two-peer call — forcing this feature through it would mean overriding
 * most of that logic anyway. This reuses the same underlying LiveKit
 * library and token-per-room pattern, just with a layout that actually
 * matches a 1:1 call.
 */
export function DoubtSessionRoom({
  token,
  serverUrl,
  onLeave,
}: {
  token: string;
  serverUrl: string;
  onLeave: () => void;
}) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      audio
      video
      onDisconnected={onLeave}
      className="h-full w-full"
    >
      <DoubtSessionRoomInner onLeave={onLeave} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function DoubtSessionRoomInner({ onLeave }: { onLeave: () => void }) {
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const [micError, setMicError] = useState<string | null>(null);

  useEffect(() => {
    localParticipant.setMicrophoneEnabled(true).catch((err) => setMicError(describeMediaError(err)));
    localParticipant.setCameraEnabled(true).catch(() => {});
  }, [localParticipant]);

  const localTrack = tracks.find((t) => t.participant.isLocal);
  const remoteTrack = tracks.find((t) => !t.participant.isLocal);

  return (
    <div className="relative h-full w-full bg-[#0a0b12] rounded-2xl overflow-hidden">
      {connectionState !== ConnectionState.Connected && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-slate-400 text-sm">
          Connecting…
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center">
        {remoteTrack?.publication ? (
          <VideoTrack trackRef={remoteTrack} className="w-full h-full object-cover" />
        ) : (
          <div className="text-slate-500 text-sm">Waiting for the other participant…</div>
        )}
      </div>

      {localTrack?.publication && (
        <div className="absolute bottom-4 right-4 w-28 sm:w-36 aspect-video rounded-xl overflow-hidden border border-slate-700 shadow-lg">
          <VideoTrack trackRef={localTrack} className="w-full h-full object-cover" />
        </div>
      )}

      {micError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-rose-950/90 border border-rose-700 text-rose-200 text-[11px] font-semibold px-3 py-1.5 rounded-lg">
          {micError}
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <TrackToggle
          source={Track.Source.Microphone}
          showIcon={false}
          className="w-10 h-10 rounded-full bg-slate-800/90 hover:bg-slate-700 text-white flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-lg">mic</span>
        </TrackToggle>
        <TrackToggle
          source={Track.Source.Camera}
          showIcon={false}
          className="w-10 h-10 rounded-full bg-slate-800/90 hover:bg-slate-700 text-white flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-lg">videocam</span>
        </TrackToggle>
        <button
          type="button"
          onClick={onLeave}
          className="w-10 h-10 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center"
          title="Leave"
        >
          <span className="material-symbols-outlined text-lg">call_end</span>
        </button>
      </div>
    </div>
  );
}

function describeMediaError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError") return "Camera/microphone access was blocked. Check your browser permissions.";
  if (name === "NotFoundError") return "No camera or microphone was found on this device.";
  return "Could not access your camera/microphone.";
}
