"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { Track, ConnectionState } from "livekit-client";

export interface DiagnosticsSnapshot {
  timestamp: string;
  connectionState: string;
  rttMs: number;
  jitterMs: number;
  audioBitrateKbps: number;
  audioPacketLossPct: number;
  micLevelPct: number;
  cameraResolution: string;
  cameraFps: number;
  screenShareActive: boolean;
  screenShareResolution: string;
  screenShareFps: number;
  encoderType: string;
  droppedFrames: number;
  cpuConcurrency: number;
  deviceMemoryGb: number | string;
  reconnectCount: number;
}

export function TeacherMediaDiagnosticsHUD({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const [metrics, setMetrics] = useState<DiagnosticsSnapshot>({
    timestamp: new Date().toISOString(),
    connectionState: "disconnected",
    rttMs: 0,
    jitterMs: 0,
    audioBitrateKbps: 0,
    audioPacketLossPct: 0,
    micLevelPct: 0,
    cameraResolution: "0x0",
    cameraFps: 0,
    screenShareActive: false,
    screenShareResolution: "0x0",
    screenShareFps: 0,
    encoderType: "WebRTC VP8/H264",
    droppedFrames: 0,
    cpuConcurrency: typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4,
    deviceMemoryGb: typeof navigator !== "undefined" && (navigator as any).deviceMemory ? (navigator as any).deviceMemory : "N/A",
    reconnectCount: 0,
  });

  const [copied, setCopied] = useState(false);
  const reconnectCountRef = useRef(0);
  const prevAudioBytesRef = useRef<{ bytes: number; timestamp: number }>({ bytes: 0, timestamp: Date.now() });
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

  // Audio VU Level Analyser
  useEffect(() => {
    if (!localParticipant) return;
    const micPub = localParticipant.getTrackPublication(Track.Source.Microphone);
    const mediaTrack = micPub?.track?.mediaStreamTrack;

    if (!mediaTrack) {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      return;
    }

    try {
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
      let animId: number;

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

      return () => {
        cancelAnimationFrame(animId);
        if (ctx.state !== "closed") ctx.close().catch(() => {});
      };
    } catch {
      // AudioContext unavailable
    }
  }, [localParticipant]);

  // WebRTC Stats Polling Interval
  useEffect(() => {
    if (!isOpen || !room) return;

    const interval = setInterval(async () => {
      try {
        const pc = (room.engine as any)?.pcManager?.publisher?.pc || (room.engine as any)?.publisher?.pc;
        let rtt = 0;
        let jitter = 0;
        let audioBitrate = 0;
        let packetLossPct = 0;
        let camRes = "Off";
        let camFps = 0;
        let screenRes = "Off";
        let screenFps = 0;
        let encoder = "WebRTC (Auto)";
        let dropped = 0;

        if (pc && typeof pc.getStats === "function") {
          const stats = await pc.getStats();
          const now = Date.now();

          stats.forEach((report: any) => {
            // RTT from selected candidate pair
            if (report.type === "candidate-pair" && (report.selected || report.nominated || report.state === "succeeded")) {
              if (typeof report.currentRoundTripTime === "number") {
                rtt = Math.round(report.currentRoundTripTime * 1000);
              } else if (typeof report.roundTripTime === "number") {
                rtt = Math.round(report.roundTripTime * 1000);
              }
            }

            // Audio outbound stream
            if (report.type === "outbound-rtp" && report.kind === "audio") {
              const currentBytes = report.bytesSent || 0;
              const dt = (now - prevAudioBytesRef.current.timestamp) / 1000;
              if (dt > 0 && prevAudioBytesRef.current.bytes > 0) {
                const diffBytes = Math.max(0, currentBytes - prevAudioBytesRef.current.bytes);
                audioBitrate = Math.round((diffBytes * 8) / (dt * 1000));
              }
              prevAudioBytesRef.current = { bytes: currentBytes, timestamp: now };

              if (typeof report.jitter === "number") {
                jitter = Math.round(report.jitter * 1000);
              }
              if (typeof report.packetsLost === "number" && report.packetsSent) {
                const totalPackets = report.packetsLost + report.packetsSent;
                packetLossPct = Math.round((report.packetsLost / totalPackets) * 100);
              }
            }

            // Video outbound stream
            if (report.type === "outbound-rtp" && report.kind === "video") {
              if (report.frameWidth && report.frameHeight) {
                camRes = `${report.frameWidth}x${report.frameHeight}`;
              }
              if (report.framesPerSecond) {
                camFps = Math.round(report.framesPerSecond);
              }
              if (report.encoderImplementation) {
                encoder = report.encoderImplementation;
              }
              if (typeof report.framesDropped === "number") {
                dropped = report.framesDropped;
              }
            }
          });
        }

        // Screen share status
        const screenPub = localParticipant?.getTrackPublication(Track.Source.ScreenShare);
        const screenActive = Boolean(screenPub && !screenPub.isMuted);
        if (screenActive && screenPub?.track?.mediaStreamTrack) {
          const settings = screenPub.track.mediaStreamTrack.getSettings();
          screenRes = `${settings.width || 1920}x${settings.height || 1080}`;
          screenFps = settings.frameRate ? Math.round(settings.frameRate) : 30;
        }

        setMetrics((prev) => ({
          ...prev,
          timestamp: new Date().toISOString(),
          connectionState: room.state || "connected",
          rttMs: rtt,
          jitterMs: jitter,
          audioBitrateKbps: audioBitrate,
          audioPacketLossPct: packetLossPct,
          cameraResolution: camRes,
          cameraFps: camFps,
          screenShareActive: screenActive,
          screenShareResolution: screenRes,
          screenShareFps: screenFps,
          encoderType: encoder,
          droppedFrames: dropped,
          reconnectCount: reconnectCountRef.current,
        }));
      } catch (err) {
        console.warn("[diagnostics_poll_error]", err);
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

  const isHealthy = metrics.rttMs < 150 && metrics.audioPacketLossPct < 5;

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
            className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition flex items-center gap-1"
            title="Copy snapshot JSON to clipboard"
          >
            <span className="material-symbols-outlined text-xs">{copied ? "check" : "content_copy"}</span>
            <span>{copied ? "Copied" : "JSON"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 rounded-md text-slate-400 hover:text-white transition flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      </div>

      {/* Connection State Banner */}
      <div className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
        isHealthy ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300" : "bg-amber-950/40 border-amber-500/40 text-amber-300"
      }`}>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isHealthy ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-ping"}`} />
          <span className="capitalize">{metrics.connectionState}</span>
        </div>
        <span className="text-[10px] font-mono font-bold">
          {metrics.reconnectCount > 0 ? `Reconnected (${metrics.reconnectCount})` : "Stable"}
        </span>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* RTT & Jitter */}
        <div className="bg-[#141829] border border-slate-800 rounded-xl p-2 flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-400 font-medium">Latency (RTT)</span>
          <div className="flex items-baseline justify-between">
            <span className={`text-sm font-mono font-black ${metrics.rttMs > 200 ? "text-rose-400" : metrics.rttMs > 100 ? "text-amber-400" : "text-emerald-400"}`}>
              {metrics.rttMs} ms
            </span>
            <span className="text-[10px] text-slate-400 font-mono">±{metrics.jitterMs}ms</span>
          </div>
        </div>

        {/* Audio Bitrate & Packet Loss */}
        <div className="bg-[#141829] border border-slate-800 rounded-xl p-2 flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-400 font-medium">Audio Bitrate</span>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-mono font-black text-blue-400">
              {metrics.audioBitrateKbps} kbps
            </span>
            <span className={`text-[10px] font-mono font-bold ${metrics.audioPacketLossPct > 2 ? "text-rose-400" : "text-slate-400"}`}>
              {metrics.audioPacketLossPct}% loss
            </span>
          </div>
        </div>

        {/* Camera Feed */}
        <div className="bg-[#141829] border border-slate-800 rounded-xl p-2 flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-400 font-medium">Camera Quality</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-mono font-bold text-slate-200">
              {metrics.cameraResolution}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {metrics.cameraFps} fps
            </span>
          </div>
        </div>

        {/* Screen Share */}
        <div className="bg-[#141829] border border-slate-800 rounded-xl p-2 flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-400 font-medium">Screen Share</span>
          <div className="flex items-baseline justify-between">
            <span className={`text-xs font-mono font-bold ${metrics.screenShareActive ? "text-emerald-400" : "text-slate-400"}`}>
              {metrics.screenShareActive ? metrics.screenShareResolution : "Inactive"}
            </span>
            {metrics.screenShareActive && (
              <span className="text-[10px] font-mono text-slate-400">
                {metrics.screenShareFps} fps
              </span>
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
        <span>CPU Cores: {metrics.cpuConcurrency}</span>
      </div>
    </div>
  );
}
