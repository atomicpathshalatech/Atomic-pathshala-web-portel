"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  UploadCloud,
  Sun,
  Moon,
  Video,
  Mic,
  MicOff,
  VideoOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Layers,
  Monitor,
  Eye,
} from "lucide-react";

export interface PreFlightConfig {
  presentationUrl: string;
  presentationName: string;
  presentationType: "PDF" | "PPTX";
  classroomTheme: "LIGHT" | "DARK";
  cameraShape: "SQUARE" | "CIRCULAR";
  cameraPosition: "UPPER_RIGHT";
  videoDeviceId?: string;
  audioDeviceId?: string;
}

interface PreFlightSetupWizardProps {
  scheduleId: string;
  classTitle: string;
  initialConfig?: Partial<PreFlightConfig>;
  onComplete: (config: PreFlightConfig) => void;
  onCancel?: () => void;
}

export function PreFlightSetupWizard({
  scheduleId,
  classTitle,
  initialConfig,
  onComplete,
  onCancel,
}: PreFlightSetupWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Material state
  const [presentationUrl, setPresentationUrl] = useState(
    initialConfig?.presentationUrl || ""
  );
  const [presentationName, setPresentationName] = useState(
    initialConfig?.presentationName || ""
  );
  const [presentationType, setPresentationType] = useState<"PDF" | "PPTX">(
    initialConfig?.presentationType || "PDF"
  );
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Step 2: Theme state
  const [classroomTheme, setClassroomTheme] = useState<"LIGHT" | "DARK">(
    initialConfig?.classroomTheme || "LIGHT"
  );

  // Step 3: Camera Shape
  const [cameraShape, setCameraShape] = useState<"SQUARE" | "CIRCULAR">(
    initialConfig?.cameraShape || "SQUARE"
  );

  // Step 4: Device Setup
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState(
    initialConfig?.videoDeviceId || ""
  );
  const [selectedAudioId, setSelectedAudioId] = useState(
    initialConfig?.audioDeviceId || ""
  );
  const [camEnabled, setCamEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [micLevel, setMicLevel] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch media devices
  useEffect(() => {
    async function initDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vDevs = devices.filter((d) => d.kind === "videoinput");
        const aDevs = devices.filter((d) => d.kind === "audioinput");
        setVideoDevices(vDevs);
        setAudioDevices(aDevs);
        if (vDevs.length > 0 && !selectedVideoId && vDevs[0]?.deviceId) {
          setSelectedVideoId(vDevs[0].deviceId);
        }
        if (aDevs.length > 0 && !selectedAudioId && aDevs[0]?.deviceId) {
          setSelectedAudioId(aDevs[0].deviceId);
        }
      } catch (err) {
        console.warn("Device enumeration error:", err);
      }
    }
    initDevices();
  }, []);

  // Start media stream for device test
  useEffect(() => {
    let active = true;

    async function startStream() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: camEnabled
            ? selectedVideoId
              ? { deviceId: { exact: selectedVideoId } }
              : true
            : false,
          audio: micEnabled
            ? selectedAudioId
              ? { deviceId: { exact: selectedAudioId } }
              : true
            : false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current && camEnabled) {
          videoRef.current.srcObject = stream;
        }

        if (micEnabled && stream.getAudioTracks().length > 0) {
          try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioCtx();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const checkVolume = () => {
              if (!active || !analyserRef.current) return;
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i] ?? 0;
              }
              const average = sum / dataArray.length;
              setMicLevel(Math.min(100, Math.round((average / 128) * 100)));
              animFrameRef.current = requestAnimationFrame(checkVolume);
            };
            checkVolume();
          } catch (aErr) {
            console.warn("Audio meter setup error:", aErr);
          }
        }
      } catch (e: any) {
        console.warn("UserMedia error:", e);
      }
    }

    startStream();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [selectedVideoId, selectedAudioId, camEnabled, micEnabled, step]);

  // Handle local file upload
  const handleFileUpload = async (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    const isPpt =
      file.name.endsWith(".ppt") ||
      file.name.endsWith(".pptx") ||
      file.type.includes("presentation");

    if (!isPdf && !isPpt) {
      setError("Please upload a valid PDF or PPT/PPTX presentation document.");
      return;
    }

    setError(null);
    setUploadingFile(true);
    setUploadProgress(10);

    try {
      const { uploadFileToR2 } = await import("@/lib/storage/upload-client");
      const result = await uploadFileToR2(file, {
        prefix: "modules",
        fileType: isPpt ? "DOCUMENT" : "PDF",
        subPath: `live-classes/${scheduleId}`,
        visibility: "PROTECTED",
        onProgress: (p) => setUploadProgress(p),
      });

      setPresentationUrl(result.url || URL.createObjectURL(file));
      setPresentationName(result.filename);
      setPresentationType(isPpt ? "PPTX" : "PDF");
      setUploadProgress(100);
    } catch (err: any) {
      console.warn("Direct R2 upload fallback to local blob:", err);
      try {
        const localBlobUrl = URL.createObjectURL(file);
        setPresentationUrl(localBlobUrl);
        setPresentationName(file.name);
        setPresentationType(isPpt ? "PPTX" : "PDF");
        setUploadProgress(100);
      } catch (blobErr) {
        setError("Failed to load presentation file. Please try another file.");
      }
    } finally {
      setUploadingFile(false);
    }
  };

  // Submit and enter classroom
  const handleProceed = async () => {
    if (!presentationUrl) {
      setError("Please select or upload a presentation material before entering the classroom.");
      setStep(1);
      return;
    }

    setSaving(true);
    setError(null);

    const configPayload: PreFlightConfig = {
      presentationUrl,
      presentationName: presentationName || "Live Presentation",
      presentationType,
      classroomTheme,
      cameraShape,
      cameraPosition: "UPPER_RIGHT",
      videoDeviceId: selectedVideoId,
      audioDeviceId: selectedAudioId,
    };

    try {
      const res = await fetch(`/api/team/live-class/${scheduleId}/preflight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save pre-flight settings.");
      }

      onComplete(configPayload);
    } catch (err: any) {
      console.error("Pre-flight save error:", err);
      setError(err.message || "Failed to save pre-flight settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Live Classroom Pre-Flight Setup
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {classTitle}
              </p>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4].map((s) => (
              <button
                key={s}
                onClick={() => {
                  if (s === 1 || presentationUrl) setStep(s as any);
                }}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all ${
                  step === s
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-105 ring-2 ring-indigo-400/50"
                    : step > s
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-slate-800 text-slate-400 border border-slate-700/50"
                }`}
              >
                {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-200">
          {error && (
            <div className="flex items-center space-x-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: MATERIAL SELECTION */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  Step 1: Select or Upload Teaching Material
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Upload a PDF or PowerPoint slide deck to serve as the presentation canvas for this live class.
                </p>
              </div>

              {!presentationUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-indigo-500/70 bg-slate-950/40 hover:bg-slate-800/30 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 transition-all">
                    {uploadingFile ? (
                      <RefreshCw className="w-8 h-8 animate-spin" />
                    ) : (
                      <UploadCloud className="w-8 h-8" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {uploadingFile ? "Uploading presentation..." : "Click or Drag & Drop to Upload"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Supports PDF, PPT, and PPTX presentation slides up to 50MB.
                  </p>
                  {uploadingFile && (
                    <div className="w-64 mt-4 bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white truncate max-w-md">
                          {presentationName || "Uploaded Presentation"}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {presentationType}
                          </span>
                          <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Live Presentation
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setPresentationUrl("");
                        setPresentationName("");
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                    >
                      Replace File
                    </button>
                  </div>

                  {/* Document Preview Box */}
                  <div className="aspect-[16/9] w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-800 relative flex items-center justify-center">
                    {presentationUrl.endsWith(".pdf") || presentationType === "PDF" ? (
                      <iframe
                        src={`${presentationUrl}#toolbar=0&navpanes=0`}
                        className="w-full h-full border-0 pointer-events-none"
                        title="PDF Preview"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-center p-6">
                        <Monitor className="w-12 h-12 text-slate-600 mb-2" />
                        <p className="text-sm text-slate-300 font-medium">{presentationName}</p>
                        <p className="text-xs text-slate-500 mt-1">Slide deck prepared for real-time broadcast</p>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur rounded-md text-[10px] text-slate-300 flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Live Material Preview
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: CLASSROOM DISPLAY MODE */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  Step 2: Classroom Display Mode
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Choose the visual presentation style for both you and your students during the lecture.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Light Mode Card */}
                <div
                  onClick={() => setClassroomTheme("LIGHT")}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    classroomTheme === "LIGHT"
                      ? "bg-slate-800/80 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg"
                      : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
                          <Sun className="w-5 h-5" />
                        </div>
                        <h4 className="text-sm font-bold text-white">Light Mode</h4>
                      </div>
                      {classroomTheme === "LIGHT" && (
                        <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      Classic clean whiteboard canvas. Optimal for daytime learning and high-contrast handwritten notes.
                    </p>
                  </div>
                  <div className="mt-4 h-24 bg-white rounded-lg border border-slate-300 p-2 flex items-center justify-center text-slate-800 text-xs font-semibold">
                    Whiteboard Light Theme Preview
                  </div>
                </div>

                {/* Dark Mode Card */}
                <div
                  onClick={() => setClassroomTheme("DARK")}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    classroomTheme === "DARK"
                      ? "bg-slate-800/80 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg"
                      : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                          <Moon className="w-5 h-5" />
                        </div>
                        <h4 className="text-sm font-bold text-white">Dark Mode</h4>
                      </div>
                      {classroomTheme === "DARK" && (
                        <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      Sleek dark canvas. Reduces eye strain during evening sessions and highlights glowing strokes.
                    </p>
                  </div>
                  <div className="mt-4 h-24 bg-slate-950 rounded-lg border border-slate-800 p-2 flex items-center justify-center text-slate-200 text-xs font-semibold">
                    Classroom Dark Studio Preview
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CAMERA SHAPE & PLACEMENT */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-indigo-400" />
                  Step 3: Camera Shape & Placement
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Camera will be positioned in the <strong>Upper-Right</strong> corner with the <strong>Live Chat directly below it</strong>, preserving full aspect ratio for slides.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Square Card */}
                <div
                  onClick={() => setCameraShape("SQUARE")}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    cameraShape === "SQUARE"
                      ? "bg-slate-800/80 border-indigo-500 ring-2 ring-indigo-500/30"
                      : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-white">Square Camera</h4>
                    {cameraShape === "SQUARE" && (
                      <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Crisp 1:1 rounded square border with maximum framing area.
                  </p>
                  <div className="flex items-center justify-center py-4 bg-slate-950 rounded-xl">
                    <div className="w-24 h-24 rounded-xl border-2 border-indigo-500 bg-slate-800 flex items-center justify-center text-xs text-indigo-300 font-semibold shadow-md shadow-indigo-500/20">
                      Square Feed
                    </div>
                  </div>
                </div>

                {/* Circular Card */}
                <div
                  onClick={() => setCameraShape("CIRCULAR")}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    cameraShape === "CIRCULAR"
                      ? "bg-slate-800/80 border-indigo-500 ring-2 ring-indigo-500/30"
                      : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-white">Circular Camera</h4>
                    {cameraShape === "CIRCULAR" && (
                      <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Smooth modern avatar circle with luminous boundary.
                  </p>
                  <div className="flex items-center justify-center py-4 bg-slate-950 rounded-xl">
                    <div className="w-24 h-24 rounded-full border-2 border-indigo-500 bg-slate-800 flex items-center justify-center text-xs text-indigo-300 font-semibold shadow-md shadow-indigo-500/20">
                      Circle Feed
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: DEVICE SETUP & AUDIO/VIDEO TEST */}
          {step === 4 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Mic className="w-5 h-5 text-indigo-400" />
                  Step 4: Device & Audio/Video Check
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Test your camera feed and microphone levels before entering the classroom.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Left: Live Video Preview */}
                <div className="space-y-3">
                  <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
                    {camEnabled ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${
                          cameraShape === "CIRCULAR" ? "rounded-full aspect-square max-w-[180px]" : ""
                        }`}
                      />
                    ) : (
                      <div className="flex flex-col items-center text-slate-600">
                        <VideoOff className="w-10 h-10 mb-2" />
                        <span className="text-xs font-semibold">Camera is Turned Off</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 flex items-center gap-2">
                      <button
                        onClick={() => setCamEnabled(!camEnabled)}
                        className={`p-2 rounded-lg text-xs font-medium backdrop-blur-md flex items-center gap-1.5 transition ${
                          camEnabled
                            ? "bg-slate-800/80 text-white hover:bg-slate-700"
                            : "bg-red-500/80 text-white"
                        }`}
                      >
                        {camEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                        {camEnabled ? "Cam On" : "Cam Off"}
                      </button>
                      <button
                        onClick={() => setMicEnabled(!micEnabled)}
                        className={`p-2 rounded-lg text-xs font-medium backdrop-blur-md flex items-center gap-1.5 transition ${
                          micEnabled
                            ? "bg-slate-800/80 text-white hover:bg-slate-700"
                            : "bg-red-500/80 text-white"
                        }`}
                      >
                        {micEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                        {micEnabled ? "Mic On" : "Mic Off"}
                      </button>
                    </div>
                  </div>

                  {/* Mic Volume Meter */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5 text-indigo-400" /> Mic Input Level
                      </span>
                      <span className="text-slate-300 font-mono text-[11px]">{micLevel}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-75 ${
                          micLevel > 75
                            ? "bg-amber-400"
                            : micLevel > 20
                            ? "bg-emerald-400"
                            : "bg-slate-600"
                        }`}
                        style={{ width: `${micLevel}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Device Selectors */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Camera Device
                    </label>
                    <select
                      value={selectedVideoId}
                      onChange={(e) => setSelectedVideoId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {videoDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))}
                      {videoDevices.length === 0 && <option value="">Default Video Camera</option>}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Microphone Device
                    </label>
                    <select
                      value={selectedAudioId}
                      onChange={(e) => setSelectedAudioId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {audioDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Microphone ${i + 1}`}
                        </option>
                      ))}
                      {audioDevices.length === 0 && <option value="">Default Microphone</option>}
                    </select>
                  </div>

                  <div className="p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-xl space-y-1">
                    <p className="text-xs font-semibold text-indigo-300">Classroom Waiting Mode</p>
                    <p className="text-[11px] text-slate-400">
                      When you proceed, you will enter the classroom in <strong>Waiting State</strong>. You can review your slides and chat with arriving students before clicking <strong>Start Live Class</strong> when scheduled.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((step - 1) as any)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            ) : onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
            ) : null}
          </div>

          <div className="flex items-center space-x-3">
            {step < 4 ? (
              <button
                type="button"
                disabled={step === 1 && !presentationUrl}
                onClick={() => {
                  if (step === 1 && !presentationUrl) {
                    setError("Please upload or select presentation material to continue.");
                    return;
                  }
                  setError(null);
                  setStep((step + 1) as any);
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                  step === 1 && !presentationUrl
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                }`}
              >
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving || !presentationUrl}
                onClick={handleProceed}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Saving Setup...
                  </>
                ) : (
                  <>
                    Enter Classroom (Waiting Mode) <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
