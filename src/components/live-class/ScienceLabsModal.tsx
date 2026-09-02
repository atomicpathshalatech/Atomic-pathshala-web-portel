"use client";

import { useEffect, useRef, useState } from "react";

export type ScienceLabType =
  | "projectile"
  | "pendulum"
  | "circuits"
  | "bohr_emission"
  | "waves"
  | "inclined_plane";

interface ScienceLabsModalProps {
  onClose: () => void;
  onStampToWhiteboard: (dataUrl: string, title: string) => void;
}

const LABS: {
  id: ScienceLabType;
  title: string;
  category: string;
  icon: string;
}[] = [
  { id: "projectile", title: "Projectile Motion Lab", category: "Physics", icon: "sports_baseball" },
  { id: "pendulum", title: "Simple Harmonic Pendulum", category: "Physics", icon: "timelapse" },
  { id: "circuits", title: "Ohm's Law & Circuit Lab", category: "Physics", icon: "bolt" },
  { id: "bohr_emission", title: "Bohr Atom & Photon Emission", category: "Chemistry", icon: "auto_awesome" },
  { id: "waves", title: "Wave Interference & Superposition", category: "Physics", icon: "waves" },
  { id: "inclined_plane", title: "Friction on Inclined Plane", category: "Physics", icon: "trending_down" },
];

export function ScienceLabsModal({ onClose, onStampToWhiteboard }: ScienceLabsModalProps) {
  const [activeLab, setActiveLab] = useState<ScienceLabType>("projectile");
  const [isPlaying, setIsPlaying] = useState(true);

  // Projectile params
  const [angle, setAngle] = useState(45);
  const [velocity, setVelocity] = useState(35);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  // Calculations for Projectile
  const g = 9.8;
  const rad = (angle * Math.PI) / 180;
  const maxHeight = (Math.pow(velocity * Math.sin(rad), 2) / (2 * g)).toFixed(1);
  const totalRange = ((Math.pow(velocity, 2) * Math.sin(2 * rad)) / g).toFixed(1);
  const flightTime = ((2 * velocity * Math.sin(rad)) / g).toFixed(2);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Dark coordinate grid
      ctx.strokeStyle = "#171a26";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Ground Line
      const groundY = height - 40;
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, groundY);
      ctx.lineTo(width - 20, groundY);
      ctx.stroke();

      if (isPlaying) {
        timeRef.current += 0.03;
      }
      const t = timeRef.current;

      if (activeLab === "projectile") {
        // Draw Parabolic Trajectory Curve
        const originX = 50;
        const originY = groundY;
        const scaleX = (width - 120) / Math.max(1, Number(totalRange));
        const scaleY = (height - 100) / Math.max(1, Number(maxHeight));

        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(originX, originY);

        const totalT = Number(flightTime);
        const steps = 60;
        for (let i = 0; i <= steps; i++) {
          const simT = (i / steps) * totalT;
          const px = originX + velocity * Math.cos(rad) * simT * scaleX;
          const py = originY - (velocity * Math.sin(rad) * simT - 0.5 * g * simT * simT) * scaleY;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated Projectile Ball
        const currentSimT = (t % (totalT + 0.5));
        if (currentSimT <= totalT) {
          const bx = originX + velocity * Math.cos(rad) * currentSimT * scaleX;
          const by = originY - (velocity * Math.sin(rad) * currentSimT - 0.5 * g * currentSimT * currentSimT) * scaleY;

          ctx.beginPath();
          ctx.arc(bx, by, 7, 0, Math.PI * 2);
          ctx.fillStyle = "#22c55e";
          ctx.shadowColor = "#22c55e";
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      } else if (activeLab === "pendulum") {
        // Pendulum bob simulation
        const pivotX = width / 2;
        const pivotY = 50;
        const len = 160;
        const theta = 0.6 * Math.sin(t * 2);
        const bobX = pivotX + Math.sin(theta) * len;
        const bobY = pivotY + Math.cos(theta) * len;

        // String
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        ctx.lineTo(bobX, bobY);
        ctx.stroke();

        // Bob
        ctx.beginPath();
        ctx.arc(bobX, bobY, 18, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.shadowColor = "#3b82f6";
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (activeLab === "waves") {
        // Wave Superposition
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.strokeStyle = "#a855f7";
        for (let x = 0; x < width; x += 4) {
          const y = height / 2 + Math.sin(x * 0.03 + t * 3) * 35 + Math.sin(x * 0.05 - t * 2) * 20;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [activeLab, isPlaying, angle, velocity, totalRange, maxHeight, flightTime]);

  const handleStamp = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const labMeta = LABS.find((l) => l.id === activeLab);
    onStampToWhiteboard(dataUrl, labMeta?.title || "Science Simulation");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#12131c] w-full max-w-4xl rounded-2xl shadow-2xl border border-[#2d2e3b] flex flex-col max-h-[90vh] text-white overflow-hidden">
        {/* Header (Screenshot 3) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#252836] bg-[#171924]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">science</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-100">Interactive Science &amp; Physics Labs</h2>
              <p className="text-[11px] text-gray-400">
                Real-time interactive physics formulas, mechanics, and laboratory experiments
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252836] transition"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body Split */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Sidebar: Lab Selector */}
          <div className="md:col-span-4 p-4 border-r border-[#252836] overflow-y-auto space-y-2 bg-[#0e0f17]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block px-1 mb-2">
              SELECT INTERACTIVE LAB
            </span>
            {LABS.map((lab) => (
              <button
                key={lab.id}
                type="button"
                onClick={() => setActiveLab(lab.id)}
                className={`w-full p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                  activeLab === lab.id
                    ? "bg-blue-600/15 border-blue-500 text-white shadow-md shadow-blue-500/10"
                    : "bg-[#141622] border-[#242636] text-gray-300 hover:border-gray-600"
                }`}
              >
                <span className="material-symbols-outlined text-emerald-400 text-lg">{lab.icon}</span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-gray-100 truncate">{lab.title}</h4>
                  <span className="text-[10px] text-gray-400">{lab.category}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Right Stage: Simulation Canvas + Formula + Telemetry */}
          <div className="md:col-span-8 p-4 flex flex-col justify-between bg-[#12131c]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold text-gray-100">Projectile Motion Lab</h3>
                <p className="text-[11px] font-mono text-blue-400 font-semibold">
                  R = (u² sin 2θ) / g , H = (u² sin²θ) / 2g
                </p>
              </div>

              <button
                type="button"
                onClick={handleStamp}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition shadow-md shadow-emerald-600/30 active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">content_paste</span>
                Stamp to Whiteboard
              </button>
            </div>

            {/* Canvas Area with Live Telemetry Overlay */}
            <div className="flex-1 w-full bg-[#0a0b12] rounded-2xl border border-[#242636] relative overflow-hidden flex items-center justify-center">
              <canvas ref={canvasRef} width={560} height={310} className="w-full h-full object-contain" />

              {/* Telemetry Overlay Box (Screenshot 3) */}
              <div className="absolute top-4 right-4 bg-[#12131e]/90 border border-blue-500/40 rounded-xl p-3 shadow-xl backdrop-blur-sm space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 block border-b border-blue-500/20 pb-1 mb-1">
                  LIVE TELEMETRY
                </span>
                <div className="text-[11px] font-mono space-y-0.5 text-gray-200">
                  <p>Max Height (H): <span className="font-bold text-white">{maxHeight} m</span></p>
                  <p>Total Range (R): <span className="font-bold text-white">{totalRange} m</span></p>
                  <p>Flight Time (T): <span className="font-bold text-white">{flightTime} s</span></p>
                </div>
              </div>
            </div>

            {/* Bottom Controls Bar (Screenshot 3) */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 bg-[#171924] p-3 rounded-xl border border-[#252836]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition"
                >
                  <span className="material-symbols-outlined text-sm">{isPlaying ? "pause" : "play_arrow"}</span>
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    timeRef.current = 0;
                  }}
                  className="p-1.5 rounded-lg bg-[#222434] hover:bg-[#2c2e42] text-gray-300"
                  title="Reset"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300 font-medium">Angle:</span>
                  <input
                    type="range"
                    min={10}
                    max={85}
                    value={angle}
                    onChange={(e) => setAngle(Number(e.target.value))}
                    className="w-20 accent-blue-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-white w-7">{angle}°</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300 font-medium">Velocity:</span>
                  <input
                    type="range"
                    min={10}
                    max={60}
                    value={velocity}
                    onChange={(e) => setVelocity(Number(e.target.value))}
                    className="w-20 accent-blue-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-white w-10">{velocity} m/s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
