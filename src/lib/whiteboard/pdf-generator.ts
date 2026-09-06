import { jsPDF } from "jspdf";
import { StrokeObject, VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "@/lib/canvas/canvas-engine";
import { SLIDE_WATERMARK, getLogoBase64 } from "@/lib/whiteboard/branding";

export interface PageDataForExport {
  pageNumber: number;
  background: string;
  objects: StrokeObject[];
}

/**
 * Generates an authoritative 16:9 PDF vector document with all whiteboard pages,
 * strokes, shapes, and the official Atomic Pathshala watermark.
 */
export async function generateWhiteboardPdf(
  pages: PageDataForExport[],
  sessionTitle: string = "Class Notes"
): Promise<Buffer> {
  // 16:9 standard slide in points: 960pt x 540pt (landscape)
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [960, 540],
  });

  const logoBase64 = getLogoBase64();
  const pdfWidth = 960;
  const pdfHeight = 540;

  // Scale factor from Virtual coordinates (1920x1080) to PDF points (960x540) = 0.5
  const scale = pdfWidth / VIRTUAL_WIDTH;

  pages.sort((a, b) => a.pageNumber - b.pageNumber);

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) {
      doc.addPage([pdfWidth, pdfHeight], "landscape");
    }

    const p = pages[i]!;

    // 1. Draw Background
    drawSlideBackground(doc, p.background, pdfWidth, pdfHeight);

    // 2. Render all strokes & shapes
    for (const obj of p.objects || []) {
      if (obj.type === "stroke") {
        renderStroke(doc, obj, scale);
      } else if (obj.type === "shape") {
        renderShape(doc, obj, scale);
      }
    }

    // 3. Render Brand Watermark
    if (logoBase64) {
      const wmWidth = (SLIDE_WATERMARK.width * scale) * 0.75;
      const wmHeight = (SLIDE_WATERMARK.height * scale) * 0.75;
      const wmMargin = SLIDE_WATERMARK.margin * scale;

      const posX = pdfWidth - wmWidth - wmMargin;
      const posY = pdfHeight - wmHeight - wmMargin;

      try {
        doc.addImage(logoBase64, "PNG", posX, posY, wmWidth, wmHeight);
      } catch (err) {
        console.warn("[PDF Generator] Watermark addImage warning:", err);
      }
    }

    // 4. Slide Footer Info
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Atomic Pathshala • ${sessionTitle} • Slide ${p.pageNumber} of ${pages.length}`, 20, pdfHeight - 12);
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  const val = parseInt(clean, 16);
  if (isNaN(val)) return { r: 30, g: 30, b: 30 };
  return {
    r: (val >> 16) & 255,
    g: (val >> 8) & 255,
    b: val & 255,
  };
}

function drawSlideBackground(doc: jsPDF, bg: string, w: number, h: number) {
  if (bg === "dark" || bg === "atomic_dark") {
    doc.setFillColor(18, 20, 30);
    doc.rect(0, 0, w, h, "F");
  } else if (bg === "ruled" || bg === "atomic_ruled") {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, "F");
    doc.setDrawColor(230, 235, 245);
    doc.setLineWidth(0.5);
    for (let y = 30; y < h; y += 18) {
      doc.line(0, y, w, y);
    }
  } else if (bg === "grid") {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, "F");
    doc.setDrawColor(240, 240, 245);
    doc.setLineWidth(0.5);
    for (let x = 0; x < w; x += 15) {
      doc.line(x, 0, x, h);
    }
    for (let y = 0; y < h; y += 15) {
      doc.line(0, y, w, y);
    }
  } else {
    // Default clean white
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, "F");
  }
}

function renderStroke(doc: jsPDF, stroke: any, scale: number) {
  const points = stroke.points;
  if (!points || points.length < 2) return;

  const { r, g, b } = hexToRgb(stroke.color || "#1A1A1A");
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(Math.max(0.5, (stroke.size || 3) * scale));
  doc.setLineCap("round");
  doc.setLineJoin("round");

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    doc.line(p1.x * scale, p1.y * scale, p2.x * scale, p2.y * scale);
  }
}

function renderShape(doc: jsPDF, shapeObj: any, scale: number) {
  const { shape, color, size, start, end } = shapeObj;
  if (!start || !end) return;

  const { r, g, b } = hexToRgb(color || "#1A1A1A");
  doc.setDrawColor(r, g, b);
  doc.setFillColor(r, g, b);
  doc.setLineWidth(Math.max(0.5, (size || 3) * scale));

  const x1 = start.x * scale;
  const y1 = start.y * scale;
  const x2 = end.x * scale;
  const y2 = end.y * scale;

  if (shape === "line") {
    doc.line(x1, y1, x2, y2);
  } else if (shape === "rectangle") {
    const rx = Math.min(x1, x2);
    const ry = Math.min(y1, y2);
    const rw = Math.abs(x2 - x1);
    const rh = Math.abs(y2 - y1);
    doc.rect(rx, ry, rw, rh, "S");
  } else if (shape === "circle") {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    doc.ellipse(cx, cy, rx, ry, "S");
  } else if (shape === "triangle") {
    const topX = (x1 + x2) / 2;
    const topY = y1;
    doc.triangle(topX, topY, x1, y2, x2, y2, "S");
  } else if (shape === "arrow") {
    doc.line(x1, y1, x2, y2);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = (8 + (size || 3) * 2) * scale;
    const pA = {
      x: x2 - headLen * Math.cos(angle - Math.PI / 7),
      y: y2 - headLen * Math.sin(angle - Math.PI / 7),
    };
    const pB = {
      x: x2 - headLen * Math.cos(angle + Math.PI / 7),
      y: y2 - headLen * Math.sin(angle + Math.PI / 7),
    };
    doc.triangle(x2, y2, pA.x, pA.y, pB.x, pB.y, "FD");
  }
}
