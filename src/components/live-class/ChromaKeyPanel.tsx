"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChromaKeyer,
  DEFAULT_CHROMA,
  analyzeChromaFrame,
  drawKeyedTeacher,
  sanitizeChroma,
  type ChromaAnalysis,
  type ChromaDebugView,
  type ChromaPreset,
  type ChromaSettings,
} from "@/lib/live-class/chroma-key";

/**
 * Green screen for the teacher. Simple by default — on/off, mode, Auto Chroma,
 * Check Camera, a lighting preset and a BEFORE | AFTER preview of exactly what
 * students see (same GPU keyer as the class video). Every technical control
 * lives under Advanced Settings. Changes apply to the class immediately.
 */

const PRESETS: { value: ChromaPreset; label: string }[] = [
  { value: "AUTO", label: "Auto" },
  { value: "BRIGHT", label: "Bright room" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Low light" },
  { value: "VERY_LOW", label: "Very low light" },
];

const LIGHT_LABEL: Record<string, string> = { BRIGHT: "Bright", NORMAL: "Normal", LOW: "Low light", VERY_LOW: "Very low light" };

type PreviewBg = "white" | "dark" | "checker";

export function ChromaKeyPanel({
  value,
  onChange,
  onClose,
}: {
  value: ChromaSettings;
  onChange: (next: ChromaSettings) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keyerRef = useRef<ChromaKeyer | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [bg, setBg] = useState<PreviewBg>("white");
  const bgRef = useRef(bg);
  bgRef.current = bg;
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [report, setReport] = useState<ChromaAnalysis | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [status, setStatus] = useState<{ light: string; ms: number } | null>(null);
  const [debugView, setDebugView] = useState<ChromaDebugView>("none");
  const debugRef = useRef(debugView);
  debugRef.current = debugView;
  const [debugAllowed, setDebugAllowed] = useState(false);

  useEffect(() => {
    try {
      setDebugAllowed(localStorage.getItem("atomic_chroma_debug") === "1");
    } catch {
      // ignore
    }
  }, []);

  // Live preview: this device's camera → keyer; BEFORE (left) | AFTER (right).
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let frames = 0;
    const keyer = new ChromaKeyer();
    keyerRef.current = keyer;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play().catch(() => undefined);
        }
      })
      .catch((err) => setCameraError(err instanceof Error ? err.message : "Camera unavailable"));

    const drawBg = (ctx: CanvasRenderingContext2D, x: number, w: number, h: number) => {
      const mode = bgRef.current;
      if (mode === "checker") {
        const sq = Math.max(8, Math.round(h / 18));
        for (let yy = 0; yy < h; yy += sq) {
          for (let xx = 0; xx < w; xx += sq) {
            ctx.fillStyle = (xx / sq + yy / sq) % 2 === 0 ? "#cbd5e1" : "#f8fafc";
            ctx.fillRect(x + xx, yy, sq, sq);
          }
        }
        return;
      }
      ctx.fillStyle = mode === "dark" ? "#0f172a" : "#ffffff";
      ctx.fillRect(x, 0, w, h);
      ctx.fillStyle = mode === "dark" ? "#1e293b" : "#e2e8f0";
      for (let y = 24; y < h; y += 24) ctx.fillRect(x, y, w, 1);
    };

    const draw = () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v && c && v.readyState >= 2 && v.videoWidth > 0) {
        const ctx = c.getContext("2d");
        if (ctx) {
          const vw = v.videoWidth;
          const vh = v.videoHeight;
          // Preview at ≤ 640 px per side keeps the panel light.
          const sc = Math.min(1, 640 / vw);
          const pw = Math.round(vw * sc);
          const ph = Math.round(vh * sc);
          if (c.width !== pw * 2 || c.height !== ph) {
            c.width = pw * 2;
            c.height = ph;
          }
          const s = valueRef.current;
          // BEFORE (mirrored, like a mirror)
          ctx.save();
          ctx.translate(pw, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(v, 0, 0, pw, ph);
          ctx.restore();
          // AFTER
          drawBg(ctx, pw, pw, ph);
          if (s.enabled && keyer.supported) {
            keyer.setSettings(s);
            keyer.setDebugView(debugRef.current);
            const keyed = keyer.process(v, vw, vh);
            if (keyed) {
              ctx.save();
              ctx.translate(pw * 2, 0);
              ctx.scale(-1, 1);
              drawKeyedTeacher(ctx, keyed, { x: 0, y: 0, w: vw, h: vh }, { x: 0, y: 0, w: pw, h: ph }, s.naturalShadow);
              ctx.restore();
            }
            if (++frames % 20 === 0) setStatus(keyer.status());
          } else {
            ctx.save();
            ctx.translate(pw * 2, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(v, 0, 0, pw, ph);
            ctx.restore();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      keyerRef.current = null;
    };
  }, []);

  const set = (patch: Partial<ChromaSettings>) => onChange(sanitizeChroma({ ...value, ...patch }));

  /** A small copy of the current camera frame for analysis. */
  const grabFrame = () => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return null;
    const w = 320;
    const h = Math.round((v.videoHeight / v.videoWidth) * w);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return analyzeChromaFrame(ctx.getImageData(0, 0, w, h).data, w, h);
  };

  const flash = (tone: "ok" | "warn", text: string) => {
    setNote({ tone, text });
    setTimeout(() => setNote(null), 6000);
  };

  const autoChroma = () => {
    const a = grabFrame();
    if (!a) return flash("warn", "Camera isn't ready yet — try again in a second.");
    setReport(a);
    if (!a.screenFound) return flash("warn", a.message ?? "Green screen not detected clearly.");
    onChange(sanitizeChroma({ ...value, ...a.suggested, preset: "AUTO" }));
    flash("ok", a.message ?? `Done — screen colour ${a.keyColor}, settings tuned for this camera and room.`);
  };

  const checkCamera = () => {
    const a = grabFrame();
    if (!a) return flash("warn", "Camera isn't ready yet — try again in a second.");
    setReport(a);
  };

  const slider = (label: string, key: keyof ChromaSettings, min: number, max: number, step: number, hint: string) => (
    <label className="block" title={hint}>
      <div className="flex items-center justify-between text-[11px] text-slate-300">
        <span>{label}</span>
        <span className="font-mono text-slate-500">{Number(value[key]).toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number(value[key])}
        onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<ChromaSettings>)}
        className="w-full accent-emerald-500"
      />
    </label>
  );

  const group = (title: string, children: React.ReactNode) => (
    <div className="space-y-2 pt-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{title}</p>
      {children}
    </div>
  );

  const chip = (label: string, tone: "good" | "mid" | "bad") => (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
        tone === "good" ? "bg-emerald-500/15 text-emerald-300" : tone === "mid" ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300"
      }`}
    >
      {label}
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-3 bg-black/30" onClick={onClose}>
      <div
        className="w-[440px] max-w-full max-h-[94vh] overflow-y-auto rounded-xl border border-slate-700 bg-[#141620] p-3 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Green screen</h3>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <span className={value.enabled ? "text-emerald-300" : "text-slate-400"}>{value.enabled ? "ON" : "OFF"}</span>
              <button
                type="button"
                role="switch"
                aria-checked={value.enabled}
                onClick={() => set({ enabled: !value.enabled })}
                className={`relative w-9 h-5 rounded-full transition ${value.enabled ? "bg-emerald-500" : "bg-slate-600"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${value.enabled ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </label>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" title="Close">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* BEFORE | AFTER */}
        <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-black">
          <video ref={videoRef} muted playsInline className="hidden" />
          <canvas ref={canvasRef} className="w-full h-auto block" />
          <span className="absolute top-1 left-1.5 text-[9px] font-bold tracking-wider bg-black/60 px-1.5 py-0.5 rounded">BEFORE</span>
          <span className="absolute top-1 left-[51%] text-[9px] font-bold tracking-wider bg-black/60 px-1.5 py-0.5 rounded">AFTER</span>
          {cameraError && (
            <p className="absolute inset-0 flex items-center justify-center text-[11px] text-rose-300 p-3 text-center bg-black/70">
              Preview unavailable: {cameraError}
            </p>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            {(["white", "dark", "checker"] as PreviewBg[]).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBg(b)}
                className={`px-1.5 py-0.5 rounded capitalize ${bg === b ? "bg-slate-700 text-white" : "hover:text-slate-300"}`}
              >
                {b === "checker" ? "Transparency" : b}
              </button>
            ))}
          </div>
          {status && value.enabled && (
            <span>
              {value.preset === "AUTO" ? `Room: ${LIGHT_LABEL[status.light] ?? status.light} · ` : ""}
              {status.ms.toFixed(1)} ms/frame
            </span>
          )}
        </div>

        {/* Mode + one-click tools */}
        <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-1.5 items-center">
          <select
            value={value.mode}
            onChange={(e) => set({ mode: e.target.value as ChromaSettings["mode"] })}
            className="h-8 rounded-md border border-slate-600 bg-[#0f1118] px-2 text-xs"
            title="Processing mode"
          >
            <option value="PRO">Professional Auto (best quality)</option>
            <option value="FAST">Fast (slow computers)</option>
          </select>
          <button type="button" onClick={autoChroma} className="h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold">
            Auto Chroma
          </button>
          <button type="button" onClick={checkCamera} className="h-8 px-3 rounded-md border border-slate-600 hover:bg-slate-700 text-xs">
            Check Camera
          </button>
        </div>
        {note && <p className={`mt-1.5 text-[11px] ${note.tone === "ok" ? "text-emerald-300" : "text-amber-300"}`}>{note.text}</p>}

        {report && (
          <div className="mt-2 rounded-lg border border-slate-700 bg-[#0f1118] p-2 text-[11px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Camera quality</span>
              {chip(report.verdict.camera, report.verdict.camera === "Good" ? "good" : report.verdict.camera === "Fair" ? "mid" : "bad")}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Lighting</span>
              {chip(report.verdict.lighting, report.verdict.lighting === "Good" ? "good" : report.verdict.lighting === "Low" ? "mid" : "bad")}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Green screen</span>
              {chip(report.verdict.screen, report.verdict.screen === "Good" ? "good" : report.verdict.screen === "Uneven" ? "mid" : "bad")}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 shrink-0">Recommended</span>
              <span className="text-right text-slate-200">{report.verdict.recommended}</span>
            </div>
            {report.message && <p className="text-amber-300">{report.message}</p>}
          </div>
        )}

        {/* Lighting presets */}
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Room lighting</p>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => set({ preset: p.value })}
                className={`px-2.5 h-7 rounded-md text-[11px] border ${
                  value.preset === p.value ? "border-emerald-500 bg-emerald-500/15 text-emerald-200" : "border-slate-600 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={value.naturalShadow} onChange={(e) => set({ naturalShadow: e.target.checked })} className="accent-emerald-500" />
          Natural shadow on the board
        </label>

        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="mt-3 w-full flex items-center justify-between text-xs text-slate-300 border-t border-slate-700 pt-2"
        >
          <span>Advanced settings</span>
          <span className="material-symbols-outlined text-base">{advanced ? "expand_less" : "expand_more"}</span>
        </button>

        {advanced && (
          <div className="mt-1 space-y-1">
            {group(
              "Chroma",
              <>
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>Key colour</span>
                  <input
                    type="color"
                    value={value.keyColor}
                    onChange={(e) => set({ keyColor: e.target.value })}
                    className="w-7 h-6 rounded border border-slate-600 bg-transparent cursor-pointer"
                    title="Screen colour"
                  />
                </div>
                {slider("Threshold", "threshold", 0, 1, 0.01, "Higher removes more of the screen; lower keeps more of you.")}
                {slider("Softness", "softness", 0, 1, 0.01, "Width of the soft edge (hair, beard, shoulders).")}
                {slider("Spill suppression", "spill", 0, 1, 0.01, "Removes the green glow from your edges only.")}
                {slider("Shadow tolerance", "shadowTolerance", 0, 1, 0.01, "Also removes darker / shadowed parts of the screen.")}
              </>
            )}
            {group(
              "Edge",
              <>
                {slider("Feather", "feather", 0, 1, 0.01, "Edge-aware softening of the outline.")}
                {slider("Edge cleanup", "cleanup", 0, 1, 0.01, "Removes specks of screen and fills pin-holes.")}
                {slider("Hair detail", "hairDetail", 0, 1, 0.01, "Keeps fine, semi-transparent hair strands.")}
                {slider("Denoise", "denoise", 0, 2, 1, "For grainy cameras (affects only the key decision).")}
                {slider("Stability", "stability", 0, 0.9, 0.01, "Steadier edges between frames (anti-flicker).")}
              </>
            )}
            {group(
              "Face",
              <>
                {slider("Natural face enhance", "faceEnhance", 0, 1, 0.01, "Subtle shadow lift — no whitening, no smoothing.")}
                {slider("Skin protection", "skinProtect", 0, 1, 0.01, "Keeps face, neck and hands from being removed.")}
              </>
            )}
            {group(
              "Lighting (for keying only)",
              <>
                {slider("Exposure", "exposure", 0.5, 2.5, 0.01, "Brightens the copy used to find the screen — not your picture.")}
                {slider("Shadows", "shadows", 0.5, 2.5, 0.01, "Lifts dark areas of that copy.")}
                {slider("Contrast", "contrast", 0.5, 2, 0.01, "Separates you from a dull screen.")}
              </>
            )}
            {group(
              "Colour",
              <>
                {slider("Temperature", "temperature", -1, 1, 0.01, "Warmer / cooler.")}
                {slider("Tint", "tint", -1, 1, 0.01, "Magenta / green.")}
                {slider("Saturation", "saturation", 0, 2, 0.01, "Colour intensity.")}
              </>
            )}
            {debugAllowed && (
              <div className="pt-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Debug view (developer)</p>
                <select
                  value={debugView}
                  onChange={(e) => setDebugView(e.target.value as ChromaDebugView)}
                  className="h-7 w-full rounded-md border border-slate-600 bg-[#0f1118] px-2 text-[11px]"
                >
                  <option value="none">Final output</option>
                  <option value="raw">Original frame</option>
                  <option value="alpha">Alpha matte</option>
                  <option value="edge">Edge / spill map</option>
                  <option value="skin">Skin protection map</option>
                  <option value="work">Working luma (normalized)</option>
                </select>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_CHROMA, enabled: value.enabled, keyColor: value.keyColor })}
            className="text-[11px] text-slate-400 hover:text-white"
          >
            Reset to defaults
          </button>
          <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
