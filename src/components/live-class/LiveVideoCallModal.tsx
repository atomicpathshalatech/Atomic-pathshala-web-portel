"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  VideoTrack,
  useLocalParticipant,
  useTracks,
  TrackToggle,
} from "@livekit/components-react";
import { Track } from "livekit-client";

export interface TeacherConnectedStudent {
  studentId: string;
  studentName: string;
  studentUserId: string;
  audioConnected: boolean;
  videoConnected: boolean;
}

interface LiveVideoCallModalProps {
  role: "TEACHER" | "STUDENT";
  // Teacher props
  connectedStudents?: TeacherConnectedStudent[];
  onDisconnectStudent?: (studentId: string) => Promise<void> | void;
  // Student props
  isApprovedSpeaker?: boolean;
  requestType?: "AUDIO" | "VIDEO";
  teacherAudioConnected?: boolean;
  teacherVideoConnected?: boolean;
  onEndCall?: () => Promise<void> | void;
  // A DIFFERENT student who is currently an approved video speaker — the
  // rest of the class previously had no way to see a classmate's video at
  // all, only the teacher did. Read-only: no mic/camera/end-call controls,
  // since this viewer isn't the one on the call.
  classSpeaker?: { studentUserId: string; studentName: string } | null;
}

export function LiveVideoCallModal({
  role,
  connectedStudents = [],
  onDisconnectStudent,
  isApprovedSpeaker = false,
  requestType = "AUDIO",
  teacherAudioConnected = false,
  teacherVideoConnected = false,
  onEndCall,
  classSpeaker = null,
}: LiveVideoCallModalProps) {
  const { isCameraEnabled, isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone], { onlySubscribed: false });
  const [isEnding, setIsEnding] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [dismissedIdentities, setDismissedIdentities] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!pos && typeof window !== "undefined") {
      setPos({
        x: Math.max(20, Math.floor(window.innerWidth / 2 - 160)),
        y: Math.max(40, Math.floor(window.innerHeight - 250)),
      });
    }
  }, [pos]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos?.x ?? 20,
      origY: pos?.y ?? 20,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: Math.max(10, Math.min(window.innerWidth - 320, dragRef.current.origX + dx)),
      y: Math.max(10, Math.min(window.innerHeight - 180, dragRef.current.origY + dy)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleCutCall = (studentId?: string, identity?: string) => {
    const idToDismiss = studentId || identity;
    if (idToDismiss) {
      setDismissedIdentities((prev) => ({ ...prev, [idToDismiss]: true }));
      if (studentId && onDisconnectStudent) {
        onDisconnectStudent(studentId);
      } else if (identity && onDisconnectStudent) {
        onDisconnectStudent(identity);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // TEACHER VIEW: Shows active student in a clean, draggable floating tile
  // ---------------------------------------------------------------------------
  if (role === "TEACHER") {
    const remoteVideoTracks = tracks.filter(
      (t) =>
        t.source === Track.Source.Camera &&
        !t.participant.isLocal &&
        !dismissedIdentities[t.participant.identity]
    );
    const remoteAudioTracks = tracks.filter(
      (t) =>
        t.source === Track.Source.Microphone &&
        !t.participant.isLocal &&
        !dismissedIdentities[t.participant.identity]
    );

    const activeStudents = connectedStudents.filter(
      (s) => !dismissedIdentities[s.studentId] && !dismissedIdentities[s.studentUserId]
    );

    const hasActiveStudent =
      activeStudents.length > 0 || remoteVideoTracks.length > 0 || remoteAudioTracks.length > 0;
    if (!hasActiveStudent) return null;

    return (
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={pos ? { left: pos.x, top: pos.y } : undefined}
        className="fixed z-50 w-72 sm:w-80 select-none cursor-grab active:cursor-grabbing rounded-2xl overflow-hidden border-2 border-blue-500/80 shadow-[0_12px_45px_rgba(0,0,0,0.85)] bg-slate-950 backdrop-blur-md"
      >
        {remoteVideoTracks.length > 0 ? (
          <div className="space-y-1.5">
            {remoteVideoTracks.map((trk) => {
              const studentInfo = connectedStudents.find(
                (s) => s.studentUserId === trk.participant.identity
              );
              const displayName = trk.participant.name || studentInfo?.studentName || "Student";
              const studentId = studentInfo?.studentId;

              return (
                <div
                  key={trk.participant.identity}
                  className="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center"
                >
                  <VideoTrack trackRef={trk} className="w-full h-full object-cover" />

                  {/* Clean Student Name Tag Top-Left */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/75 backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/10 text-white shadow">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold truncate max-w-[140px]">{displayName}</span>
                  </div>

                  {/* Single Red Call End Button Floating Bottom-Center */}
                  <div className="absolute bottom-2 inset-x-0 flex justify-center z-10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCutCall(studentId, trk.participant.identity);
                      }}
                      className="w-10 h-10 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-2xl transition hover:scale-110 active:scale-95 cursor-pointer border border-white/20"
                      title="Disconnect Student Call"
                    >
                      <span className="material-symbols-outlined text-xl">call_end</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Clean Audio-Only Voice Call Tile */
          <div className="p-4 flex flex-col items-center justify-center gap-2.5 bg-slate-950 text-white">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 border-2 border-blue-500/50 flex items-center justify-center text-blue-400 animate-pulse">
              <span className="material-symbols-outlined text-2xl">mic</span>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-white truncate max-w-[180px]">
                {connectedStudents[0]?.studentName || "Connected Student"}
              </p>
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Voice Call Connected
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCutCall(connectedStudents[0]?.studentId, undefined);
              }}
              className="w-10 h-10 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl transition hover:scale-110 active:scale-95 cursor-pointer border border-white/20"
              title="End Voice Call"
            >
              <span className="material-symbols-outlined text-xl">call_end</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STUDENT VIEW: Persistent control dock with self-preview & mute/camera/leave
  // ---------------------------------------------------------------------------
  const isVideoMode = requestType === "VIDEO" || teacherVideoConnected;
  const isAudioActive = isApprovedSpeaker || teacherAudioConnected || teacherVideoConnected;
  const localCameraTrack = tracks.find((t) => t.participant.isLocal && t.source === Track.Source.Camera);

  // Not this viewer's own call — but a classmate is currently an approved
  // video speaker. Everyone in the room already subscribes to every
  // published track (see ROOM_OPTIONS in VideoStrip.tsx / the room's
  // subscribe grant), so their track is already reachable here by
  // identity; only the UI to show it for a non-speaking student was
  // missing.
  if (!isAudioActive && classSpeaker) {
    const classmateTrack = tracks.find(
      (t) => t.source === Track.Source.Camera && t.participant.identity === classSpeaker.studentUserId
    );
    if (!classmateTrack) return null;
    return (
      <div className="fixed bottom-20 right-4 z-40 w-40 sm:w-48 rounded-xl overflow-hidden bg-slate-950 border-2 border-blue-500/80 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
        <div className="relative aspect-video">
          <VideoTrack trackRef={classmateTrack} className="w-full h-full object-cover" />
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/80 backdrop-blur-xs px-1.5 py-0.5 rounded-md border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-white truncate max-w-[100px]">
              {classSpeaker.studentName}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAudioActive) return null;

  const handleLeaveCall = async () => {
    setIsEnding(true);
    try {
      // Disarm local hardware tracks immediately
      await localParticipant.setMicrophoneEnabled(false);
      await localParticipant.setCameraEnabled(false);
      onEndCall?.();
    } catch {
      onEndCall?.();
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#0c0e17]/95 border-2 border-emerald-500/80 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.85)] p-3 text-white backdrop-blur-md flex flex-col sm:flex-row items-center gap-3 animate-in fade-in slide-in-from-bottom duration-200">
      {/* Video Self-Preview if Video Mode */}
      {isVideoMode && (
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 shrink-0">
          {isCameraEnabled && localCameraTrack ? (
            <div className="w-full h-full transform scale-x-[-1]">
              <VideoTrack
                trackRef={localCameraTrack}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-slate-900">
              <span className="material-symbols-outlined text-slate-500 text-2xl">videocam_off</span>
              <span className="text-[9px] text-slate-400 font-bold mt-1">Camera Off</span>
            </div>
          )}
          <div className="absolute top-1 left-1 bg-black/80 px-1 py-0.5 rounded text-[8px] font-bold text-slate-300">
            You (Self)
          </div>
        </div>
      )}

      {/* Info & Call Controls */}
      <div className="flex flex-col gap-2 min-w-[200px]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <div className="space-y-0.5">
            <p className="text-xs font-black text-white">
              {isVideoMode ? "Live Video Call with Teacher" : "Live Audio Voice Call"}
            </p>
            <p className="text-[10px] text-emerald-400 font-semibold">
              You are live in class
            </p>
          </div>
        </div>

        {/* Action Buttons: Mic Toggle, Camera Toggle, End Call */}
        <div className="flex items-center gap-2 pt-1">
          {/* Microphone Toggle */}
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon={false}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
              isMicrophoneEnabled
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30"
                : "bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30"
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {isMicrophoneEnabled ? "mic" : "mic_off"}
            </span>
            <span>{isMicrophoneEnabled ? "Mute" : "Unmute"}</span>
          </TrackToggle>

          {/* Camera Toggle (if video enabled) */}
          {isVideoMode && (
            <TrackToggle
              source={Track.Source.Camera}
              showIcon={false}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                isCameraEnabled
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30"
                  : "bg-slate-700 hover:bg-slate-600 text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {isCameraEnabled ? "videocam" : "videocam_off"}
              </span>
              <span>{isCameraEnabled ? "Cam Off" : "Cam On"}</span>
            </TrackToggle>
          )}

          {/* End Call / Lower Hand */}
          <button
            type="button"
            disabled={isEnding}
            onClick={handleLeaveCall}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-700 hover:bg-rose-600 active:scale-95 text-white flex items-center gap-1 shadow-md transition disabled:opacity-50 cursor-pointer"
            title="End Call & Disconnect"
          >
            <span className="material-symbols-outlined text-sm">call_end</span>
            <span>{isEnding ? "Ending…" : "End"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
