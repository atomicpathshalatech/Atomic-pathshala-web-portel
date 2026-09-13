/**
 * Physics-circuit and biology-diagram renderers. The Physics/Bio shape tabs
 * were hit by the same id-aliasing bug as Chemistry (see shapes/registry.ts)
 * even though the user-facing bug report and expansion request focused on
 * Chemistry/General — fixing "every shape must have a unique id" only for
 * Chemistry would leave Physics/Bio still broken. These are compact,
 * recognizable symbols rather than a full circuit/biology library, matching
 * the existing (unexpanded) scope of those two tabs.
 */
import type { ShapeRenderer } from "./general-shapes";
import { box } from "./general-shapes";

function withStroke(ctx: CanvasRenderingContext2D, color: string, size: number, fn: () => void) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  fn();
  ctx.restore();
}

export const drawResistor: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  const zigzagW = b.w * 0.6;
  const zigzagX = b.x1 + (b.w - zigzagW) / 2;
  const peaks = 6;
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(b.x1, b.cy);
    ctx.lineTo(zigzagX, b.cy);
    for (let i = 0; i < peaks; i++) {
      const x = zigzagX + (zigzagW * (i + 1)) / peaks;
      const y = i % 2 === 0 ? b.cy - b.h * 0.28 : b.cy + b.h * 0.28;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(zigzagX + zigzagW, b.cy);
    ctx.lineTo(b.x2, b.cy);
    ctx.stroke();
  });
};

export const drawCapacitor: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  const gap = Math.max(8, b.w * 0.08);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(b.x1, b.cy);
    ctx.lineTo(b.cx - gap, b.cy);
    ctx.moveTo(b.cx - gap, b.y1);
    ctx.lineTo(b.cx - gap, b.y2);
    ctx.moveTo(b.cx + gap, b.y1);
    ctx.lineTo(b.cx + gap, b.y2);
    ctx.moveTo(b.cx + gap, b.cy);
    ctx.lineTo(b.x2, b.cy);
    ctx.stroke();
  });
};

export const drawInductor: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  const coils = 4;
  const coilW = b.w / (coils + 1);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(b.x1, b.cy);
    ctx.lineTo(b.x1 + coilW * 0.5, b.cy);
    for (let i = 0; i < coils; i++) {
      const x0 = b.x1 + coilW * (0.5 + i);
      const x1 = x0 + coilW;
      ctx.arc((x0 + x1) / 2, b.cy, coilW / 2, Math.PI, 0, false);
    }
    ctx.lineTo(b.x2, b.cy);
    ctx.stroke();
  });
};

export const drawBattery: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  const barGap = b.w * 0.12;
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(b.x1, b.cy);
    ctx.lineTo(b.cx - barGap, b.cy);
    ctx.moveTo(b.cx - barGap, b.cy - b.h * 0.4);
    ctx.lineTo(b.cx - barGap, b.cy + b.h * 0.4);
    ctx.moveTo(b.cx + barGap, b.cy - b.h * 0.18);
    ctx.lineTo(b.cx + barGap, b.cy + b.h * 0.18);
    ctx.moveTo(b.cx + barGap, b.cy);
    ctx.lineTo(b.x2, b.cy);
    ctx.stroke();
  });
};

export const drawPulley: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  const r = Math.min(b.w, b.h) / 2;
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.arc(b.cx, b.cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.cx, b.y1 - r * 0.4);
    ctx.lineTo(b.cx, b.cy - r);
    ctx.moveTo(b.cx - r * 0.9, b.cy + r * 0.5);
    ctx.lineTo(b.cx - r * 0.9, b.y2 + r * 0.6);
    ctx.moveTo(b.cx + r * 0.9, b.cy + r * 0.5);
    ctx.lineTo(b.cx + r * 0.9, b.y2 + r * 0.6);
    ctx.stroke();
  });
};

export const drawPrism: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(b.cx, b.y1);
    ctx.lineTo(b.x1, b.y2);
    ctx.lineTo(b.x2, b.y2);
    ctx.closePath();
    ctx.stroke();
    // Incident + refracted light ray through the prism.
    ctx.beginPath();
    ctx.moveTo(b.x1 - b.w * 0.15, b.cy);
    ctx.lineTo(b.cx - b.w * 0.08, b.y2 - b.h * 0.3);
    ctx.lineTo(b.x2 + b.w * 0.15, b.cy + b.h * 0.05);
    ctx.stroke();
  });
};

export const drawMagnet: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  withStroke(ctx, color, size, () => {
    ctx.strokeRect(b.x1, b.y1, b.w / 2, b.h);
    ctx.strokeRect(b.cx, b.y1, b.w / 2, b.h);
  });
  ctx.save();
  ctx.fillStyle = "#e53e3e";
  ctx.fillRect(b.x1 + 2, b.y1 + 2, b.w / 2 - 4, b.h - 4);
  ctx.fillStyle = "#3182ce";
  ctx.fillRect(b.cx + 2, b.y1 + 2, b.w / 2 - 4, b.h - 4);
  ctx.strokeRect(b.x1, b.y1, b.w, b.h);
  ctx.fillStyle = "#fff";
  ctx.font = `900 ${Math.max(12, b.h * 0.4)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", b.x1 + b.w * 0.25, b.cy);
  ctx.fillText("S", b.x1 + b.w * 0.75, b.cy);
  ctx.restore();
};

export const drawDnaHelix: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  const turns = 3;
  const steps = 40;
  withStroke(ctx, color, size, () => {
    for (const phase of [0, Math.PI]) {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = b.x1 + t * b.w;
        const y = b.cy + Math.sin(t * Math.PI * 2 * turns + phase) * (b.h / 2.4);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 1; i < turns * 2; i++) {
      const t = i / (turns * 2);
      const x = b.x1 + t * b.w;
      const y1 = b.cy + Math.sin(t * Math.PI * 2 * turns) * (b.h / 2.4);
      const y2 = b.cy + Math.sin(t * Math.PI * 2 * turns + Math.PI) * (b.h / 2.4);
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();
    }
  });
};

export const drawAnimalCell: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.ellipse(b.cx, b.cy, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(b.cx - b.w * 0.08, b.cy, b.w * 0.18, b.h * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
};

export const drawNeuron: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  const cellR = Math.min(b.w, b.h) * 0.18;
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.arc(b.x1 + cellR * 1.4, b.cy, cellR, 0, Math.PI * 2);
    ctx.stroke();
    for (const a of [-0.9, -0.4, 0.4, 0.9]) {
      ctx.beginPath();
      ctx.moveTo(b.x1 + cellR * 1.4 + Math.cos(Math.PI + a) * cellR, b.cy + Math.sin(Math.PI + a) * cellR);
      ctx.lineTo(b.x1 + cellR * 1.4 + Math.cos(Math.PI + a) * cellR * 2.2, b.cy + Math.sin(Math.PI + a) * cellR * 2.2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(b.x1 + cellR * 2.4, b.cy);
    ctx.lineTo(b.x2 - cellR, b.cy);
    ctx.stroke();
    for (const a of [-0.6, 0, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(b.x2 - cellR, b.cy);
      ctx.lineTo(b.x2 - cellR + Math.cos(a) * cellR, b.cy + Math.sin(a) * cellR);
      ctx.stroke();
    }
  });
};

export const drawHeart: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(b.cx, b.y1 + b.h * 0.25);
    ctx.bezierCurveTo(b.cx, b.y1, b.x1, b.y1, b.x1, b.y1 + b.h * 0.3);
    ctx.bezierCurveTo(b.x1, b.y1 + b.h * 0.55, b.cx, b.y1 + b.h * 0.75, b.cx, b.y2);
    ctx.bezierCurveTo(b.cx, b.y1 + b.h * 0.75, b.x2, b.y1 + b.h * 0.55, b.x2, b.y1 + b.h * 0.3);
    ctx.bezierCurveTo(b.x2, b.y1, b.cx, b.y1, b.cx, b.y1 + b.h * 0.25);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  });
};

export const drawLeaf: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(b.cx, b.y1);
    ctx.quadraticCurveTo(b.x2, b.cy, b.cx, b.y2);
    ctx.quadraticCurveTo(b.x1, b.cy, b.cx, b.y1);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.cx, b.y1 + b.h * 0.08);
    ctx.lineTo(b.cx, b.y2 - b.h * 0.08);
    ctx.stroke();
  });
};

export const OTHER_SHAPE_RENDERERS: Record<string, ShapeRenderer> = {
  resistor: drawResistor,
  capacitor: drawCapacitor,
  inductor: drawInductor,
  battery: drawBattery,
  pulley: drawPulley,
  prism: drawPrism,
  magnet: drawMagnet,
  dna: drawDnaHelix,
  "animal-cell": drawAnimalCell,
  neuron: drawNeuron,
  heart: drawHeart,
  leaf: drawLeaf,
};
