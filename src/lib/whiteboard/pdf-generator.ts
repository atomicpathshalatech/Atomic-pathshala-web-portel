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
    await drawSlideBackground(doc, p.background, pdfWidth, pdfHeight);

    // 2. Render all strokes, shapes, and text
    for (const obj of p.objects || []) {
      if (obj.type === "stroke") {
        renderStroke(doc, obj, scale);
      } else if (obj.type === "shape") {
        renderShape(doc, obj, scale);
      } else if (obj.type === "text") {
        renderText(doc, obj, scale);
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

/** Fetches an uploaded background image (page background URL, including
 * PDF pages loaded via "Load Presentation") and returns it as a data URI
 * jsPDF's addImage can embed directly. Returns null on any failure — the
 * caller falls back to a plain white background rather than aborting the
 * whole multi-page export over one bad image. */
async function fetchBackgroundImage(
  url: string
): Promise<{ dataUrl: string; format: "PNG" | "JPEG" | "WEBP" } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    let format: "PNG" | "JPEG" | "WEBP" = "PNG";
    if (contentType.includes("jpeg") || /\.jpe?g(\?|$)/i.test(url)) format = "JPEG";
    else if (contentType.includes("webp") || /\.webp(\?|$)/i.test(url)) format = "WEBP";
    return { dataUrl: `data:${contentType || "image/png"};base64,${base64}`, format };
  } catch (err) {
    console.warn("[PDF Generator] Could not fetch background image:", err);
    return null;
  }
}

async function drawSlideBackground(doc: jsPDF, bg: string, w: number, h: number): Promise<void> {
  if (/^https?:\/\//.test(bg)) {
    const img = await fetchBackgroundImage(bg);
    if (img) {
      try {
        doc.addImage(img.dataUrl, img.format, 0, 0, w, h);
        return;
      } catch (err) {
        console.warn("[PDF Generator] Background addImage failed, falling back to white:", err);
      }
    }
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, "F");
    return;
  }

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

/** Mirrors CanvasEngine.drawText()/measureText() in canvas-engine.ts — same
 * left-anchored top-baseline per-line layout — so a text object looks the
 * same in the exported PDF as it did on the live board. */
function renderText(doc: jsPDF, textObj: any, scale: number) {
  const { text, color, size, position } = textObj;
  if (!text || !position) return;

  const { r, g, b } = hexToRgb(color || "#1A1A1A");
  doc.setTextColor(r, g, b);
  doc.setFont("helvetica", "normal");
  const fontSizePt = Math.max(4, (size || 32) * scale);
  doc.setFontSize(fontSizePt);

  const lineHeight = fontSizePt * 1.25;
  const lines = String(text).split("\n");
  lines.forEach((line: string, i: number) => {
    // jsPDF's default text baseline is "alphabetic", not "top" — offset by
    // one line-height's worth of ascent so line 1 lands where the canvas
    // engine's textBaseline: "top" would have put it, not above the page.
    doc.text(line, position.x * scale, position.y * scale + lineHeight * (i + 1) * 0.8);
  });
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
