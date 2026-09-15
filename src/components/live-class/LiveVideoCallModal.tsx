"use client";

import React, { useState } from "react";
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
}: LiveVideoCallModalProps) {
  const { isCameraEnabled, isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone], { onlySubscribed: false });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // ---------------------------------------------------------------------------
  // TEACHER VIEW: Shows active student(s) in a persistent floating panel
  // ---------------------------------------------------------------------------
  if (role === "TEACHER") {
    const remoteVideoTracks = tracks.filter((t) => t.source === Track.Source.Camera && !t.participant.isLocal);
    const remoteAudioTracks = tracks.filter((t) => t.source === Track.Source.Microphone && !t.participant.isLocal);

    // If no students connected via props and no remote tracks, don't display
    const hasActiveStudent = connectedStudents.length > 0 || remoteVideoTracks.length > 0 || remoteAudioTracks.length > 0;
    if (!hasActiveStudent) return null;

    return (
      <div
        className={`fixed z-40 transition-all duration-300 ${
          isMinimized
            ? "bottom-20 right-4 w-72 bg-slate-900/95 border border-blue-500/60 rounded-2xl p-3 shadow-2xl backdrop-blur-md"
            : "bottom-20 right-4 sm:right-6 w-80 sm:w-96 bg-[#0f111a]/95 border-2 border-blue-500/80 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-md overflow-hidden"
        }`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-blue-950/80 to-slate-900/80 border-b border-blue-500/30 text-white">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-black tracking-wide text-blue-100 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-blue-400">duo</span>
              Live Student Interaction
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="w-6 h-6 rounded-md hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition"
              title={isMinimized ? "Expand video call" : "Minimize video call"}
            >
              <span className="material-symbols-outlined text-sm">
                {isMinimized ? "open_in_full" : "close_fullscreen"}
              </span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!isMinimized && (
          <div className="p-3 space-y-3">
            {/* If video tracks exist, render video stream */}
            {remoteVideoTracks.length > 0 ? (
              <div className="space-y-2">
                {remoteVideoTracks.map((trk) => {
                  const studentInfo = connectedStudents.find(
                    (s) => s.studentUserId === trk.participant.identity
                  );
                  const displayName = trk.participant.name || studentInfo?.studentName || "Student";
                  const studentId = studentInfo?.studentId;

                  return (
                    <div
                      key={trk.participant.identity}
                      className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-700 shadow-inner group"
                    >
                      <VideoTrack trackRef={trk} className="w-full h-full object-cover" />

                      {/* Top Overlay: Name & Live Badge */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/80 backdrop-blur-xs px-2 py-0.5 rounded-md border border-white/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-[11px] font-bold text-white truncate max-w-[130px]">
                          {displayName}
                        </span>
                      </div>

                      {/* Bottom Overlay: Action Controls */}
                      <div className="absolute bottom-2 inset-x-2 flex items-center justify-between z-10">
                        <span className="text-[10px] text-blue-300 font-semibold bg-black/70 px-2 py-0.5 rounded backdrop-blur-xs">
                          Camera Connected
                        </span>
                        {studentId && onDisconnectStudent && (
                          <button
                            type="button"
                            onClick={() => onDisconnectStudent(studentId)}
                            className="flex items-center gap-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1 rounded-lg shadow-md transition active:scale-95"
                          >
                            <span className="material-symbols-outlined text-xs">call_end</span>
                            End Call
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Audio Only Interaction Tile */
              <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 text-center flex flex-col items-center justify-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-blue-500/20 border-2 border-blue-500/40 text-blue-400 flex items-center justify-center animate-pulse">
                  <span className="material-symbols-outlined text-2xl">mic</span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white">
                    {connectedStudents[0]?.studentName || "Connected Student"}
                  </p>
                  <p className="text-[10px] text-emerald-400 font-semibold flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Audio Voice Call Active
                  </p>
                </div>
                {connectedStudents[0]?.studentId && onDisconnectStudent && (
                  <button
                    type="button"
                    onClick={() => {
                      const sId = connectedStudents[0]?.studentId;
                      if (sId) onDisconnectStudent(sId);
                    }}
                    className="mt-2 flex items-center gap-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg shadow-md transition active:scale-95"
                  >
                    <span className="material-symbols-outlined text-xs">call_end</span>
                    End Voice Call
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Minimized Pill View */}
        {isMinimized && (
          <div className="flex items-center justify-between text-xs font-bold text-white pt-1">
            <span className="truncate max-w-[150px] text-slate-300">
              {connectedStudents[0]?.studentName || "1 Student Connected"}
            </span>
            {connectedStudents[0]?.studentId && onDisconnectStudent && (
              <button
                type="button"
                onClick={() => {
                  const sId = connectedStudents[0]?.studentId;
                  if (sId) onDisconnectStudent(sId);
                }}
                className="text-rose-400 hover:text-rose-300 flex items-center gap-0.5 text-[11px]"
              >
                <span className="material-symbols-outlined text-xs">call_end</span>
                End
              </button>
            )}
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
