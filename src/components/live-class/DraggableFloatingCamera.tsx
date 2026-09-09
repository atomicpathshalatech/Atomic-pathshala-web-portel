"use client";

import React, { useState, useEffect, useRef } from "react";

interface DraggableFloatingCameraProps {
  children: React.ReactNode;
  title?: string;
  isLive?: boolean;
  onExpand?: () => void;
  storageKey?: string;
  sizePx?: number;
}

export function DraggableFloatingCamera({
  children,
  title = "Educator",
  isLive = true,
  onExpand,
  storageKey = "atomic_floating_cam_pos",
  sizePx = 140,
}: DraggableFloatingCameraProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize position from localStorage or default to top-right with margin
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed.x === "number" &&
          typeof parsed.y === "number" &&
          parsed.x >= 0 &&
          parsed.x <= window.innerWidth - sizePx &&
          parsed.y >= 0 &&
          parsed.y <= window.innerHeight - sizePx
        ) {
          setPosition(parsed);
          return;
        }
      }
    } catch {
      // fallback
    }

    // Default top-right position
    const defaultX = Math.max(16, window.innerWidth - sizePx - 24);
    const defaultY = 70; // below top navigation bar
    setPosition({ x: defaultX, y: defaultY });
  }, [storageKey, sizePx]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only handle primary button
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return; // Don't drag when clicking buttons

    isDraggingRef.current = true;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      dragStartOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const maxX = Math.max(10, window.innerWidth - sizePx - 16);
    const maxY = Math.max(10, window.innerHeight - sizePx - 16);

    let newX = e.clientX - dragStartOffsetRef.current.x;
    let newY = e.clientY - dragStartOffsetRef.current.y;

    // Viewport clamping
    newX = Math.max(12, Math.min(newX, maxX));
    newY = Math.max(60, Math.min(newY, maxY));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (position) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(position));
      } catch {
        // ignore
      }
    }
  };

  if (!position) return null;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        touchAction: "none",
      }}
      className="fixed top-0 left-0 z-50 select-none cursor-grab active:cursor-grabbing group animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Outer Halo Glow */}
      <div className="relative w-full h-full rounded-full p-[3px] bg-gradient-to-tr from-blue-500 via-blue-500 to-pink-500 shadow-[0_8px_30px_rgb(0,0,0,0.6)] ring-2 ring-white/20">
        {/* Inner Video Container */}
        <div className="w-full h-full rounded-full overflow-hidden bg-slate-950 relative flex items-center justify-center">
          {children}

          {/* Draggable hint overlay on hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center pointer-events-none">
            <span className="material-symbols-outlined text-white text-xl drop-shadow">drag_pan</span>
            <span className="text-[9px] font-bold text-white uppercase tracking-wider mt-0.5">Drag to move</span>
          </div>

          {/* Live indicator dot */}
          <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center pointer-events-none">
            <span className="inline-flex items-center gap-1 bg-slate-950/80 backdrop-blur-xs border border-white/20 px-2 py-0.5 rounded-full text-[9px] font-bold text-white shadow-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-rose-500 animate-ping" : "bg-emerald-400"}`} />
              <span className="truncate max-w-[65px]">{title}</span>
            </span>
          </div>
        </div>

        {/* Floating action buttons around top */}
        {onExpand && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
            className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-slate-800 hover:bg-blue-600 text-white flex items-center justify-center border-2 border-slate-900 shadow-md transition transform hover:scale-110 active:scale-95"
            title="Expand chat & panel"
          >
            <span className="material-symbols-outlined text-[14px]">open_in_full</span>
          </button>
        )}
      </div>
    </div>
  );
}
