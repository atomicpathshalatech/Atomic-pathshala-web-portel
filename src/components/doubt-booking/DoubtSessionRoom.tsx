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
  useRoomContext,
} from "@livekit/components-react";
import { Track, ConnectionState, RoomEvent } from "livekit-client";
import { DoubtWhiteboard } from "./DoubtWhiteboard";

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
  isTeacher = false,
  onLeave,
}: {
  token: string;
  serverUrl: string;
  isTeacher?: boolean;
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
      <DoubtSessionRoomInner isTeacher={isTeacher} onLeave={onLeave} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function DoubtSessionRoomInner({
  isTeacher = false,
  onLeave,
}: {
  isTeacher?: boolean;
  onLeave: () => void;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const [micError, setMicError] = useState<string | null>(null);
  const [whiteboardActive, setWhiteboardActive] = useState(false);

  useEffect(() => {
    localParticipant.setMicrophoneEnabled(true).catch((err) => setMicError(describeMediaError(err)));
    localParticipant.setCameraEnabled(true).catch(() => {});
  }, [localParticipant]);

  // Synchronize whiteboard toggle state via LiveKit data channel
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "WB_TOGGLE") {
          setWhiteboardActive(!!msg.active);
        }
      } catch (err) {
        console.error("[DoubtSessionRoom] DataReceived error:", err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  const toggleWhiteboard = () => {
    const nextState = !whiteboardActive;
    setWhiteboardActive(nextState);
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ type: "WB_TOGGLE", active: nextState }));
      room.localParticipant.publishData(payload, { reliable: true });
    } catch (err) {
      console.error("[DoubtSessionRoom] broadcast WB_TOGGLE failed:", err);
    }
  };

  const localTrack = tracks.find((t) => t.participant.isLocal);
  const remoteTrack = tracks.find((t) => !t.participant.isLocal);

  return (
    <div className="relative h-full w-full bg-[#0a0b12] rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      {connectionState !== ConnectionState.Connected && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs text-slate-400 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
            <span>Connecting to Doubt Session…</span>
          </div>
        </div>
      )}

      {/* Main Viewport: Either Whiteboard OR Full-screen Video */}
      {whiteboardActive ? (
        <div className="h-full w-full flex">
          {/* Whiteboard Workspace */}
          <div className="flex-1 h-full">
            <DoubtWhiteboard
              room={room}
              isTeacher={isTeacher}
              onClose={() => toggleWhiteboard()}
            />
          </div>

          {/* Floating Video Strip (Top Right) during Whiteboard */}
          <div className="absolute top-12 right-3 z-30 flex flex-col gap-2 pointer-events-none">
            {/* Remote Participant Camera */}
            {remoteTrack?.publication && (
              <div className="w-32 sm:w-44 aspect-video rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-xl pointer-events-auto">
                <VideoTrack trackRef={remoteTrack} className="w-full h-full object-cover" />
              </div>
            )}
            {/* Local Camera */}
            {localTrack?.publication && (
              <div className="w-24 sm:w-32 aspect-video rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-xl self-end pointer-events-auto">
                <VideoTrack trackRef={localTrack} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Full-screen Video Call View */
        <div className="relative h-full w-full">
          <div className="absolute inset-0 flex items-center justify-center">
            {remoteTrack?.publication ? (
              <VideoTrack trackRef={remoteTrack} className="w-full h-full object-cover" />
            ) : (
              <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-4xl text-slate-600 animate-pulse">
                  person
                </span>
                <span>Waiting for the other participant to join…</span>
              </div>
            )}
          </div>

          {localTrack?.publication && (
            <div className="absolute bottom-16 right-4 w-28 sm:w-40 aspect-video rounded-xl overflow-hidden border border-slate-700 shadow-2xl z-20">
              <VideoTrack trackRef={localTrack} className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      )}

      {micError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-rose-950/90 border border-rose-700 text-rose-200 text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-lg">
          {micError}
        </div>
      )}

      {/* Floating Call Controls (Bottom Center) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 px-3 rounded-full border border-slate-700/70 shadow-2xl">
        <TrackToggle
          source={Track.Source.Microphone}
          showIcon={false}
          className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition shadow-xs"
        >
          <span className="material-symbols-outlined text-lg">mic</span>
        </TrackToggle>

        <TrackToggle
          source={Track.Source.Camera}
          showIcon={false}
          className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition shadow-xs"
        >
          <span className="material-symbols-outlined text-lg">videocam</span>
        </TrackToggle>

        {/* Dedicated Activate Whiteboard Button for Teacher */}
        {isTeacher && (
          <button
            type="button"
            onClick={toggleWhiteboard}
            className={`px-3.5 h-9 rounded-full flex items-center gap-1.5 text-xs font-bold transition shadow-xs ${
              whiteboardActive
                ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
            title={whiteboardActive ? "Hide Whiteboard" : "Activate Whiteboard"}
          >
            <span className="material-symbols-outlined text-[17px]">
              {whiteboardActive ? "visibility_off" : "draw"}
            </span>
            <span>{whiteboardActive ? "Hide Whiteboard" : "Activate Whiteboard"}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onLeave}
          className="w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition shadow-xs"
          title="End / Leave Session"
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
