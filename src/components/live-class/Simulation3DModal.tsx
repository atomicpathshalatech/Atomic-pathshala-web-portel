"use client";

import { useEffect, useRef, useState } from "react";

export type Simulation3DType = "bohr" | "prism" | "water" | "magnet";

interface Simulation3DModalProps {
  onClose: () => void;
  onInsertToSlide: (dataUrl: string, title: string) => void;
}

const SIMULATIONS: {
  id: Simulation3DType;
  title: string;
  category: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "bohr",
    title: "Bohr's Atom Model",
    category: "Physics / Chemistry",
    description: "3D Nucleus with Proton/Neutron clusters and orbiting dynamic electron shells.",
    icon: "atom",
  },
  {
    id: "prism",
    title: "Prism Light Dispersion",
    category: "Optics / Physics",
    description: "Refraction of incident white light into 7 rainbow spectrum colors.",
    icon: "change_history",
  },
  {
    id: "water",
    title: "Water Molecule (H₂O)",
    category: "Chemistry",
    description: "3D Bond angles and ball-and-stick covalent bond representation.",
    icon: "bubble_chart",
  },
  {
    id: "magnet",
    title: "Bar Magnet & Field Lines",
    category: "Electromagnetism",
    description: "Magnetic flux lines originating from North to South pole.",
    icon: "sensors",
  },
];

export function Simulation3DModal({ onClose, onInsertToSlide }: Simulation3DModalProps) {
  const [activeSim, setActiveSim] = useState<Simulation3DType>("bohr");
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [rotationX, setRotationX] = useState(25);
  const [rotationY, setRotationY] = useState(45);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  // Handle Mouse Drag 360 Rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - lastMousePosRef.current.x;
    const deltaY = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    setRotationY((prev) => (prev + deltaX * 0.8) % 360);
    setRotationX((prev) => Math.max(-80, Math.min(80, prev + deltaY * 0.8)));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Render 3D Canvas
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
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Draw subtle coordinate grid background
      ctx.strokeStyle = "#1a1d29";
      ctx.lineWidth = 1;
      const gridSize = 25;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (isPlaying) {
        timeRef.current += 0.02 * speed;
      }
      const t = timeRef.current;

      ctx.save();
      ctx.translate(cx, cy);

      const radX = (rotationX * Math.PI) / 180;
      const radY = (rotationY * Math.PI) / 180;

      if (activeSim === "bohr") {
        // --- 3D BOHR ATOM ---
        // 1. Central Glowing Nucleus
        const glowGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
        glowGrad.addColorStop(0, "#ff4444");
        glowGrad.addColorStop(0.5, "#cc0000");
        glowGrad.addColorStop(1, "rgba(255, 0, 0, 0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("NUCLEUS", 0, 0);

        // 3 Orbital Rings at tilted angles
        const shells = [
          { rx: 110, ry: 45, tilt: 25 + radY, color: "#22c55e", speed: 1.2, count: 2 },
          { rx: 150, ry: 60, tilt: -35 + radY, color: "#a855f7", speed: 0.9, count: 2 },
          { rx: 190, ry: 75, tilt: 80 + radY, color: "#3b82f6", speed: 0.7, count: 2 },
        ];

        shells.forEach((shell, sIdx) => {
          ctx.save();
          ctx.rotate((shell.tilt * Math.PI) / 180);

          // Orbit path (dashed)
          ctx.beginPath();
          ctx.ellipse(0, 0, shell.rx, shell.ry, 0, 0, Math.PI * 2);
          ctx.strokeStyle = shell.color;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.globalAlpha = 0.6;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;

          // Electrons
          for (let i = 0; i < shell.count; i++) {
            const angle = t * shell.speed + (i * Math.PI * 2) / shell.count;
            const ex = Math.cos(angle) * shell.rx;
            const ey = Math.sin(angle) * shell.ry;

            // Glow
            ctx.beginPath();
            ctx.arc(ex, ey, 5, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = shell.color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          ctx.restore();
        });
      } else if (activeSim === "prism") {
        // --- PRISM DISPERSION ---
        ctx.save();
        ctx.rotate(radY * 0.3);

        // Glass Prism Triangle
        ctx.beginPath();
        ctx.moveTo(0, -90);
        ctx.lineTo(-90, 80);
        ctx.lineTo(90, 80);
        ctx.closePath();
        ctx.fillStyle = "rgba(100, 150, 255, 0.15)";
        ctx.strokeStyle = "rgba(150, 200, 255, 0.8)";
        ctx.lineWidth = 2.5;
        ctx.fill();
        ctx.stroke();

        // Incident white beam
        ctx.beginPath();
        ctx.moveTo(-220, 10);
        ctx.lineTo(-40, 5);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3.5;
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Dispersed Rainbow Rays
        const rainbow = [
          { color: "#ef4444", y: -40 },
          { color: "#f97316", y: -25 },
          { color: "#eab308", y: -10 },
          { color: "#22c55e", y: 5 },
          { color: "#06b6d4", y: 20 },
          { color: "#3b82f6", y: 35 },
          { color: "#8b5cf6", y: 50 },
        ];

        rainbow.forEach((r) => {
          ctx.beginPath();
          ctx.moveTo(35, 10);
          ctx.lineTo(220, r.y);
          ctx.strokeStyle = r.color;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = r.color;
          ctx.shadowBlur = 6;
          ctx.stroke();
          ctx.shadowBlur = 0;
        });

        ctx.restore();
      } else if (activeSim === "water") {
        // --- WATER MOLECULE (H2O) ---
        ctx.save();
        ctx.rotate(radY * 0.5);

        // Oxygen (Red Central)
        ctx.beginPath();
        ctx.arc(0, -20, 38, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("O", 0, -20);

        // Covalent Bonds
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(-15, 5);
        ctx.lineTo(-80, 80);
        ctx.moveTo(15, 5);
        ctx.lineTo(80, 80);
        ctx.stroke();

        // Hydrogen 1
        ctx.beginPath();
        ctx.arc(-80, 80, 24, 0, Math.PI * 2);
        ctx.fillStyle = "#38bdf8";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("H", -80, 80);

        // Hydrogen 2
        ctx.beginPath();
        ctx.arc(80, 80, 24, 0, Math.PI * 2);
        ctx.fillStyle = "#38bdf8";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText("H", 80, 80);

        // Angle Annotation
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(0, -20, 60, Math.PI * 0.3, Math.PI * 0.7);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 11px monospace";
        ctx.fillText("104.5°", 0, 45);

        ctx.restore();
      } else if (activeSim === "magnet") {
        // --- BAR MAGNET & MAGNETIC FIELD LINES ---
        ctx.save();
        ctx.rotate(radY * 0.3);

        // Flux Lines
        const fieldColors = ["#38bdf8", "#818cf8", "#c084fc"];
        for (let r = 50; r <= 150; r += 30) {
          ctx.beginPath();
          ctx.ellipse(0, 0, 160, r, 0, 0, Math.PI * 2);
          ctx.strokeStyle = fieldColors[(r / 30) % fieldColors.length];
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Bar Magnet Body
        // North (Red)
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(-100, -25, 100, 50);
        // South (Blue)
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(0, -25, 100, 50);

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(-100, -25, 200, 50);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("N", -50, 0);
        ctx.fillText("S", 50, 0);

        ctx.restore();
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [activeSim, isPlaying, speed, rotationX, rotationY]);

  const handleSnapshotAndInsert = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const simMeta = SIMULATIONS.find((s) => s.id === activeSim);
    onInsertToSlide(dataUrl, simMeta?.title || "3D Model");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#12131c] w-full max-w-4xl rounded-2xl shadow-2xl border border-[#2d2e3b] flex flex-col max-h-[90vh] text-white overflow-hidden">
        {/* Header (Screenshot 1) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#252836] bg-[#171924]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">view_in_ar</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-100">3D Visual Interactive Models</h2>
              <p className="text-[11px] text-gray-400">
                Interactive real-time 3D simulation for physics, chemistry, and science
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
          {/* Left Sidebar: List of 3D Models */}
          <div className="md:col-span-4 p-4 border-r border-[#252836] overflow-y-auto space-y-2 bg-[#0e0f17]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block px-1 mb-2">
              SELECT 3D SIMULATION
            </span>
            {SIMULATIONS.map((sim) => (
              <button
                key={sim.id}
                type="button"
                onClick={() => setActiveSim(sim.id)}
                className={`w-full p-3.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                  activeSim === sim.id
                    ? "bg-blue-600/15 border-blue-500 text-white shadow-md shadow-blue-500/10"
                    : "bg-[#141622] border-[#242636] text-gray-300 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-400 text-lg">{sim.icon}</span>
                  <h4 className="text-xs font-bold text-gray-100">{sim.title}</h4>
                </div>
                <span className="text-[10px] font-semibold text-blue-400">{sim.category}</span>
                <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">{sim.description}</p>
              </button>
            ))}
          </div>

          {/* Right Stage: Interactive 3D Canvas + Controls */}
          <div className="md:col-span-8 p-4 flex flex-col justify-between bg-[#12131c]">
            {/* 360 Drag Hint */}
            <div className="flex items-center justify-between mb-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1b1c2a] border border-[#2d2e3b] text-[11px] font-semibold text-gray-300">
                <span className="material-symbols-outlined text-sm text-blue-400">360</span>
                <span>Drag with mouse to rotate 3D view in 360°</span>
              </div>
            </div>

            {/* Canvas Stage */}
            <div
              className="flex-1 w-full bg-[#0a0b12] rounded-2xl border border-[#242636] relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <canvas ref={canvasRef} width={560} height={340} className="w-full h-full object-contain" />
            </div>

            {/* Bottom Controls Bar (Screenshot 1) */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-[#171924] p-3 rounded-xl border border-[#252836]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition shadow-md shadow-blue-600/30"
                >
                  <span className="material-symbols-outlined text-sm">{isPlaying ? "pause" : "play_arrow"}</span>
                  {isPlaying ? "Pause 3D" : "Play 3D"}
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-300 font-medium">Speed:</span>
                  <input
                    type="range"
                    min={0.2}
                    max={3}
                    step={0.1}
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="w-24 accent-blue-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSnapshotAndInsert}
                  className="px-4 py-2 rounded-xl bg-[#222434] hover:bg-[#2c2e42] border border-[#32364a] text-xs font-bold text-gray-200 transition"
                >
                  Snapshot (2D)
                </button>

                <button
                  type="button"
                  onClick={handleSnapshotAndInsert}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition shadow-md shadow-emerald-600/30 active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">link</span>
                  Insert Live 3D into Slide
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
