"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { Track, ConnectionState } from "livekit-client";

export interface DiagnosticsSnapshot {
  timestamp: string;
  connectionState: string;
  rttMs: number | null;
  jitterMs: number | null;
  audioBitrateKbps: number | null;
  audioPacketLossPct: number | null;
  micLevelPct: number;
  cameraResolution: string;
  cameraFps: number | null;
  screenShareActive: boolean;
  screenShareResolution: string;
  screenShareFps: number | null;
  encoderType: string;
  droppedFrames: number | null;
  cpuConcurrency: number;
  deviceMemoryGb: number | string;
  reconnectCount: number;
}

export interface WebRTCPreviousStats {
  audioBytesSent?: number;
  audioTimestamp?: number;
  packetsSent?: number;
  packetsLost?: number;
}

/**
 * Pure parsing function for WebRTC RTCStatsReport.
 * Handles:
 * - Proper inbound / outbound RTP distinctions
 * - Delta-based bitrate and packet loss calculations
 * - Associated remote-inbound-rtp extraction (RTCP receiver report stats for outbound audio)
 * - Independent camera vs screen-share classification
 * - Counter resets, missing values, and zero-sample protections
 */
export function parseWebRTCStats(
  stats: Map<string, any> | RTCStatsReport | null,
  prevStats: WebRTCPreviousStats,
  trackIds?: { cameraTrackId?: string; screenTrackId?: string; micTrackId?: string }
): {
  rttMs: number | null;
  jitterMs: number | null;
  audioBitrateKbps: number | null;
  audioPacketLossPct: number | null;
  cameraResolution: string;
  cameraFps: number | null;
  screenShareResolution: string;
  screenShareFps: number | null;
  encoderType: string;
  droppedFrames: number | null;
  nextPrevStats: WebRTCPreviousStats;
} {
  let rttMs: number | null = null;
  let jitterMs: number | null = null;
  let audioBitrateKbps: number | null = null;
  let audioPacketLossPct: number | null = null;
  let cameraResolution = "Off";
  let cameraFps: number | null = null;
  let screenShareResolution = "Off";
  let screenShareFps: number | null = null;
  let encoderType = "WebRTC (Auto)";
  let droppedFrames: number | null = null;

  const nextPrevStats: WebRTCPreviousStats = { ...prevStats };

  if (!stats) {
    return {
      rttMs,
      jitterMs,
      audioBitrateKbps,
      audioPacketLossPct,
      cameraResolution,
      cameraFps,
      screenShareResolution,
      screenShareFps,
      encoderType,
      droppedFrames,
      nextPrevStats,
    };
  }

  // Build lookup index of media sources to resolve track IDs
  const mediaSources = new Map<string, any>();
  stats.forEach((report: any) => {
    if (report.type === "media-source") {
      mediaSources.set(report.id, report);
    }
  });

  stats.forEach((report: any) => {
    // 1. RTT from active candidate-pair
    if (
      report.type === "candidate-pair" &&
      (report.selected || report.nominated || report.state === "succeeded")
    ) {
      if (typeof report.currentRoundTripTime === "number" && !isNaN(report.currentRoundTripTime)) {
        rttMs = Math.round(report.currentRoundTripTime * 1000);
      } else if (typeof report.roundTripTime === "number" && !isNaN(report.roundTripTime)) {
        rttMs = Math.round(report.roundTripTime * 1000);
      }
    }

    // 2. Outbound Audio (Teacher's Published Microphone Stream)
    if (report.type === "outbound-rtp" && report.kind === "audio") {
      const currentBytes = typeof report.bytesSent === "number" ? report.bytesSent : 0;
      const currentTs = typeof report.timestamp === "number" ? report.timestamp : Date.now();

      // Delta bitrate calculation
      if (prevStats.audioBytesSent !== undefined && prevStats.audioTimestamp !== undefined) {
        const dt = (currentTs - prevStats.audioTimestamp) / 1000;
        if (dt > 0 && currentBytes >= prevStats.audioBytesSent) {
          const deltaBytes = currentBytes - prevStats.audioBytesSent;
          audioBitrateKbps = Math.round((deltaBytes * 8) / (dt * 1000));
        } else if (currentBytes < prevStats.audioBytesSent) {
          // Counter reset/renegotiation detected
          audioBitrateKbps = 0;
        }
      }
      nextPrevStats.audioBytesSent = currentBytes;
      nextPrevStats.audioTimestamp = currentTs;

      // Remote Inbound RTP (RTCP Receiver Report for Outbound Audio from SFU/Peer)
      if (report.remoteId && typeof stats.get === "function") {
        const remoteInbound = stats.get(report.remoteId);
        if (remoteInbound) {
          if (typeof remoteInbound.roundTripTime === "number" && !isNaN(remoteInbound.roundTripTime)) {
            rttMs = Math.round(remoteInbound.roundTripTime * 1000);
          }
          if (typeof remoteInbound.jitter === "number" && !isNaN(remoteInbound.jitter)) {
            jitterMs = Math.round(remoteInbound.jitter * 1000);
          }

          // Interval-based packet loss calculation from RTCP counters
          const currentLost = typeof remoteInbound.packetsLost === "number" ? remoteInbound.packetsLost : null;
          const currentSent = typeof report.packetsSent === "number" ? report.packetsSent : null;

          if (currentLost !== null && currentSent !== null) {
            const prevLost = prevStats.packetsLost ?? 0;
            const prevSent = prevStats.packetsSent ?? 0;

            const deltaLost = Math.max(0, currentLost - prevLost);
            const deltaSent = Math.max(0, currentSent - prevSent);
            const totalDelta = deltaSent + deltaLost;

            if (totalDelta > 0) {
              audioPacketLossPct = Math.max(0, Math.min(100, Math.round((deltaLost / totalDelta) * 100)));
            } else if (prevStats.packetsSent !== undefined) {
              audioPacketLossPct = 0;
            }

            nextPrevStats.packetsLost = currentLost;
            nextPrevStats.packetsSent = currentSent;
          }
        }
      }
    }

    // 3. Inbound Audio Fallback (Student audio received by teacher, or when remote-inbound is unavailable)
    if (report.type === "inbound-rtp" && report.kind === "audio") {
      if (jitterMs === null && typeof report.jitter === "number" && !isNaN(report.jitter)) {
        jitterMs = Math.round(report.jitter * 1000);
      }
      if (
        audioPacketLossPct === null &&
        typeof report.packetsLost === "number" &&
        typeof report.packetsReceived === "number"
      ) {
        const total = report.packetsLost + report.packetsReceived;
        if (total > 0) {
          audioPacketLossPct = Math.max(0, Math.min(100, Math.round((report.packetsLost / total) * 100)));
        }
      }
    }

    // 4. Outbound Video (Camera vs Screen-Share stream differentiation)
    if (report.type === "outbound-rtp" && report.kind === "video") {
      const source = report.mediaSourceId ? mediaSources.get(report.mediaSourceId) : null;
      const trackId = report.trackIdentifier || source?.trackIdentifier;

      const isScreen =
        Boolean(trackIds?.screenTrackId && trackId && trackId === trackIds.screenTrackId) ||
        (report.mid && report.mid.toLowerCase().includes("screen"));

      const isCamera =
        Boolean(trackIds?.cameraTrackId && trackId && trackId === trackIds.cameraTrackId) ||
        !isScreen;

      if (isScreen) {
        if (report.frameWidth && report.frameHeight) {
          screenShareResolution = `${report.frameWidth}x${report.frameHeight}`;
        }
        if (typeof report.framesPerSecond === "number" && !isNaN(report.framesPerSecond)) {
          screenShareFps = Math.round(report.framesPerSecond);
        }
      } else if (isCamera) {
        if (report.frameWidth && report.frameHeight) {
          cameraResolution = `${report.frameWidth}x${report.frameHeight}`;
        }
        if (typeof report.framesPerSecond === "number" && !isNaN(report.framesPerSecond)) {
          cameraFps = Math.round(report.framesPerSecond);
        }
        if (report.encoderImplementation) {
          encoderType = report.encoderImplementation;
        }
        if (typeof report.framesDropped === "number" && !isNaN(report.framesDropped)) {
          droppedFrames = report.framesDropped;
        }
      }
    }
  });

  return {
    rttMs,
    jitterMs,
    audioBitrateKbps,
    audioPacketLossPct,
    cameraResolution,
    cameraFps,
    screenShareResolution,
    screenShareFps,
    encoderType,
    droppedFrames,
    nextPrevStats,
  };
}

export function TeacherMediaDiagnosticsHUD({
  isOpen,
  onClose,
  role = "TEACHER",
}: {
  isOpen: boolean;
  onClose: () => void;
  role?: "TEACHER" | "STUDENT";
}) {
  // Ensure the HUD is strictly teacher-only
  if (role !== "TEACHER") return null;

  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const [metrics, setMetrics] = useState<DiagnosticsSnapshot>({
    timestamp: new Date().toISOString(),
    connectionState: "disconnected",
    rttMs: null,
    jitterMs: null,
    audioBitrateKbps: null,
    audioPacketLossPct: null,
    micLevelPct: 0,
    cameraResolution: "Off",
    cameraFps: null,
    screenShareActive: false,
    screenShareResolution: "Off",
    screenShareFps: null,
    encoderType: "WebRTC (Auto)",
    droppedFrames: null,
    cpuConcurrency: typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4,
    deviceMemoryGb:
      typeof navigator !== "undefined" && (navigator as any).deviceMemory
        ? (navigator as any).deviceMemory
        : "N/A",
    reconnectCount: 0,
  });

  const [copied, setCopied] = useState(false);
  const reconnectCountRef = useRef(0);
  const prevAudioStatsRef = useRef<WebRTCPreviousStats>({});
  const inFlightRef = useRef(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Monitor Room Reconnections
  useEffect(() => {
    if (!room) return;
    const handleReconnecting = () => {
      reconnectCountRef.current += 1;
    };
    room.on("reconnecting", handleReconnecting);
    return () => {
      room.off("reconnecting", handleReconnecting);
    };
  }, [room]);

  // Audio VU Level Analyser with thorough node and context cleanup
  useEffect(() => {
    if (!localParticipant) return;
    const micPub = localParticipant.getTrackPublication(Track.Source.Microphone);
    const mediaTrack = micPub?.track?.mediaStreamTrack;

    const cleanupAudio = () => {
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.disconnect();
        } catch {}
        audioSourceRef.current = null;
      }
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch {}
        analyserRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          audioContextRef.current.close().catch(() => {});
        } catch {}
        audioContextRef.current = null;
      }
    };

    if (!mediaTrack || mediaTrack.readyState === "ended") {
      cleanupAudio();
      setMetrics((prev) => ({ ...prev, micLevelPct: 0 }));
      return;
    }

    let animId: number;
    try {
      cleanupAudio();
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const stream = new MediaStream([mediaTrack]);
      const source = ctx.createMediaStreamSource(stream);
      audioSourceRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const pct = Math.min(100, Math.round((avg / 128) * 100));
        setMetrics((prev) => ({ ...prev, micLevelPct: pct }));
        animId = requestAnimationFrame(updateLevel);
      };
      animId = requestAnimationFrame(updateLevel);
    } catch {
      // AudioContext unavailable
    }

    return () => {
      cancelAnimationFrame(animId);
      cleanupAudio();
    };
  }, [localParticipant]);

  // WebRTC Stats Polling Interval with In-Flight Protection
  useEffect(() => {
    if (!isOpen || !room) return;

    const interval = setInterval(async () => {
      if (inFlightRef.current) return; // Prevent overlapping getStats calls
      inFlightRef.current = true;

      try {
        const pc: RTCPeerConnection | undefined =
          (room.engine as any)?.pcManager?.publisher?.pc || (room.engine as any)?.publisher?.pc;

        const cameraTrackId = localParticipant?.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack?.id;
        const screenTrackId = localParticipant?.getTrackPublication(Track.Source.ScreenShare)?.track?.mediaStreamTrack?.id;
        const micTrackId = localParticipant?.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack?.id;

        if (pc && typeof pc.getStats === "function" && pc.connectionState !== "closed") {
          const stats = await pc.getStats();
          const parsed = parseWebRTCStats(stats, prevAudioStatsRef.current, {
            cameraTrackId,
            screenTrackId,
            micTrackId,
          });

          prevAudioStatsRef.current = parsed.nextPrevStats;

          const screenPub = localParticipant?.getTrackPublication(Track.Source.ScreenShare);
          const screenActive = Boolean(screenPub && !screenPub.isMuted);

          setMetrics((prev) => ({
            ...prev,
            timestamp: new Date().toISOString(),
            connectionState: room.state || pc.connectionState || "connected",
            rttMs: parsed.rttMs,
            jitterMs: parsed.jitterMs,
            audioBitrateKbps: parsed.audioBitrateKbps,
            audioPacketLossPct: parsed.audioPacketLossPct,
            cameraResolution: parsed.cameraResolution,
            cameraFps: parsed.cameraFps,
            screenShareActive: screenActive,
            screenShareResolution: screenActive ? parsed.screenShareResolution : "Inactive",
            screenShareFps: screenActive ? parsed.screenShareFps : null,
            encoderType: parsed.encoderType,
            droppedFrames: parsed.droppedFrames,
            reconnectCount: reconnectCountRef.current,
          }));
        } else {
          // Peer connection unavailable or closed
          setMetrics((prev) => ({
            ...prev,
            timestamp: new Date().toISOString(),
            connectionState: room.state || "disconnected",
            rttMs: null,
            jitterMs: null,
            audioBitrateKbps: null,
            audioPacketLossPct: null,
            cameraResolution: "Off",
            cameraFps: null,
            screenShareActive: false,
            screenShareResolution: "Inactive",
            screenShareFps: null,
            droppedFrames: null,
            reconnectCount: reconnectCountRef.current,
          }));
        }
      } catch (err) {
        console.warn("[diagnostics_poll_error]", err);
      } finally {
        inFlightRef.current = false;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, room, localParticipant]);

  if (!isOpen) return null;

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(metrics, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const isConnected = metrics.connectionState === "connected" && metrics.rttMs !== null;
  const isHealthy = isConnected && (metrics.rttMs ?? 999) < 150 && (metrics.audioPacketLossPct ?? 999) < 5;

  return (
    <div className="fixed bottom-16 right-4 z-[9999] w-84 bg-[#0d101d]/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-3.5 text-white flex flex-col gap-2.5 select-none animate-in fade-in zoom-in-95 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-400 text-base">monitoring</span>
          <h3 className="text-xs font-bold text-gray-100 uppercase tracking-wider">Teacher Media Diagnostics</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition flex items-center gap-1 cursor-pointer"
            title="Copy snapshot JSON to clipboard"
          >
            <span className="material-symbols-outlined text-xs">{copied ? "check" : "content_copy"}</span>
            <span>{copied ? "Copied" : "JSON"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 rounded-md text-slate-400 hover:text-white transition flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      </div>

      {/* Connection State Banner */}
      <div
        className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
          isHealthy
            ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
            : isConnected
            ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
            : "bg-slate-800/60 border-slate-700 text-slate-400"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isHealthy
                ? "bg-emerald-400 animate-pulse"
                : isConnected
                ? "bg-amber-400 animate-ping"
                : "bg-slate-500"
            }`}
          />
          <span className="capitalize">{isConnected ? metrics.connectionState : "Connecting / Unavailable"}</span>
        </div>
        <span className="text-[10px] font-mono font-bold">
          {metrics.reconnectCount > 0 ? `Reconnected (${metrics.reconnectCount})` : isConnected ? "Stable" : "--"}
        </span>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* RTT & Jitter */}
        <div className="bg-[#141829] border border-slate-800 rounded-xl p-2 flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-400 font-medium">Latency (RTT)</span>
          <div className="flex items-baseline justify-between">
            {metrics.rttMs !== null ? (
              <span
                className={`text-sm font-mono font-black ${
                  metrics.rttMs > 200
                    ? "text-rose-400"
                    : metrics.rttMs > 100
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {metrics.rttMs} ms
              </span>
            ) : (
              <span className="text-sm font-mono font-bold text-slate-500">N/A</span>
            )}
            <span className="text-[10px] text-slate-400 font-mono">
              {metrics.jitterMs !== null ? `±${metrics.jitterMs}ms` : "--"}
            </span>
          </div>
        </div>

        {/* Audio Bitrate & Packet Loss */}
        <div className="bg-[#141829] border border-slate-800 rounded-xl p-2 flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-400 font-medium">Audio Bitrate</span>
          <div className="flex items-baseline justify-between">
            {metrics.audioBitrateKbps !== null ? (
              <span className="text-sm font-mono font-black text-blue-400">
                {metrics.audioBitrateKbps} kbps
              </span>
            ) : (
              <span className="text-sm font-mono font-bold text-slate-500">N/A</span>
            )}
            <span
              className={`text-[10px] font-mono font-bold ${
                (metrics.audioPacketLossPct ?? 0) > 2 ? "text-rose-400" : "text-slate-400"
              }`}
            >
              {metrics.audioPacketLossPct !== null ? `${metrics.audioPacketLossPct}% loss` : "--"}
            </span>
          </div>
        </div>

        {/* Camera Feed */}
        <div className="bg-[#141829] border border-slate-800 rounded-xl p-2 flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-400 font-medium">Camera Quality</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-mono font-bold text-slate-200">{metrics.cameraResolution}</span>
            <span className="text-[10px] font-mono text-slate-400">
              {metrics.cameraFps !== null ? `${metrics.cameraFps} fps` : "--"}
            </span>
          </div>
        </div>

        {/* Screen Share */}
        <div className="bg-[#141829] border border-slate-800 rounded-xl p-2 flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-400 font-medium">Screen Share</span>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-xs font-mono font-bold ${
                metrics.screenShareActive ? "text-emerald-400" : "text-slate-400"
              }`}
            >
              {metrics.screenShareActive ? metrics.screenShareResolution : "Inactive"}
            </span>
            {metrics.screenShareActive && metrics.screenShareFps !== null && (
              <span className="text-[10px] font-mono text-slate-400">{metrics.screenShareFps} fps</span>
            )}
          </div>
        </div>
      </div>

      {/* Live Mic VU Meter */}
      <div className="bg-[#141829] border border-slate-800 rounded-xl p-2 flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">mic</span>
            Microphone Level
          </span>
          <span className="font-mono text-blue-300 font-bold">{metrics.micLevelPct}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-rose-500 transition-all duration-75"
            style={{ width: `${metrics.micLevelPct}%` }}
          />
        </div>
      </div>

      {/* System Hardware Details */}
      <div className="text-[9px] text-slate-400 border-t border-slate-800/80 pt-1.5 flex items-center justify-between">
        <span>Encoder: {metrics.encoderType}</span>
        <span>
          CPU: {metrics.cpuConcurrency} cores | Mem: {metrics.deviceMemoryGb}GB
        </span>
      </div>
    </div>
  );
}
