import pptxgen from "pptxgenjs";
import { PageDataForExport } from "./pdf-generator";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "@/lib/canvas/canvas-engine";
import { SLIDE_WATERMARK, getLogoBase64 } from "@/lib/whiteboard/branding";

/**
 * Generates an authoritative 16:9 PPTX presentation with native PowerPoint
 * shapes, slide backgrounds, and the Atomic Pathshala watermark.
 */
/** Same fetch-and-embed approach as pdf-generator.ts's helper of the same
 * shape — kept as a separate copy (not a shared import) since pptxgenjs
 * and jsPDF want the image handed to them in slightly different shapes,
 * and this file already duplicates the PageDataForExport-shaped rendering
 * logic pdf-generator.ts has for the same reason. */
async function fetchBackgroundImage(url: string): Promise<{ dataUrl: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return { dataUrl: `data:${contentType};base64,${base64}` };
  } catch (err) {
    console.warn("[PPTX Generator] Could not fetch background image:", err);
    return null;
  }
}

export async function generateWhiteboardPptx(
  pages: PageDataForExport[],
  sessionTitle: string = "Class Notes"
): Promise<Buffer> {
  const pres = new pptxgen();

  // 16:9 layout in PPTX is 10 x 5.625 inches (or custom 13.333 x 7.5 inches)
  // Default LAYOUT_16x9 is 10 inches by 5.625 inches
  pres.layout = "LAYOUT_16x9";
  const slideWidthInches = 10;
  const slideHeightInches = 5.625;

  const scaleX = slideWidthInches / VIRTUAL_WIDTH;
  const scaleY = slideHeightInches / VIRTUAL_HEIGHT;

  const logoBase64 = getLogoBase64();

  pages.sort((a, b) => a.pageNumber - b.pageNumber);

  for (const p of pages) {
    const slide = pres.addSlide();

    // 1. Background
    if (/^https?:\/\//.test(p.background)) {
      const img = await fetchBackgroundImage(p.background);
      if (img) {
        // Full-bleed image covering the whole slide, same as the PDF
        // exporter's addImage(0, 0, w, h) — this was previously ALWAYS
        // "FFFFFF" for any non-dark background, meaning a PDF-based class
        // (background = an uploaded image URL) exported as blank white
        // slides with only ink drawn over nothing.
        slide.background = { data: img.dataUrl };
      } else {
        slide.background = { color: "FFFFFF" };
      }
    } else if (p.background === "dark" || p.background === "atomic_dark") {
      slide.background = { color: "12141E" };
    } else {
      slide.background = { color: "FFFFFF" };
    }

    // 2. Render ink: freehand strokes, shapes, and text
    for (const obj of p.objects || []) {
      if (obj.type === "stroke") {
        // pptxgenjs has no native freehand path, so a stroke is rendered as
        // a chain of straight "line" shapes between consecutive points —
        // the same vector technique the PDF exporter already uses via
        // repeated doc.line() calls. Previously there was no branch for
        // "stroke" at all, so every pen/highlighter mark a teacher drew —
        // the primary way a whiteboard gets used — was silently absent
        // from the PPTX export.
        renderNativeStroke(slide, obj, scaleX, scaleY);
      } else if (obj.type === "shape") {
        renderNativeShape(slide, obj, scaleX, scaleY);
      } else if (obj.type === "text") {
        renderNativeText(slide, obj, scaleX, scaleY);
      }
    }

    // 3. Watermark Logo
    if (logoBase64) {
      const wmWidthInches = (SLIDE_WATERMARK.width * scaleX) * 0.9;
      const wmHeightInches = (SLIDE_WATERMARK.height * scaleY) * 0.9;
      const wmMarginInches = SLIDE_WATERMARK.margin * scaleX;

      const posX = slideWidthInches - wmWidthInches - wmMarginInches;
      const posY = slideHeightInches - wmHeightInches - wmMarginInches;

      try {
        slide.addImage({
          data: logoBase64,
          x: posX,
          y: posY,
          w: wmWidthInches,
          h: wmHeightInches,
        });
      } catch (err) {
        console.warn("[PPTX Generator] Watermark error:", err);
      }
    }

    // 4. Slide Footer Text
    slide.addText(`Atomic Pathshala • ${sessionTitle} • Slide ${p.pageNumber} of ${pages.length}`, {
      x: 0.3,
      y: slideHeightInches - 0.35,
      w: 8.0,
      h: 0.25,
      fontSize: 9,
      color: "888888",
    });
  }

  const output = await pres.write({ outputType: "nodebuffer" });
  return output as Buffer;
}

function normalizeHex(hex: string): string {
  let clean = (hex || "#1A1A1A").replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  return clean.toUpperCase();
}

// A stroke's own `size` is a stroke WIDTH (px), same unit pen/highlighter
// width uses on the live canvas — converted to points via the same x-scale
// shapes already use for line width.
function renderNativeStroke(slide: any, stroke: any, scaleX: number, scaleY: number) {
  const points = stroke.points;
  if (!points || points.length < 2) return;

  const hexColor = normalizeHex(stroke.color);
  const lineWidth = Math.max(0.25, (stroke.size || 3) * scaleX * 20);

  // Defensive cap: a long freehand stroke can have hundreds of recorded
  // points, and pptxgenjs emits one XML shape per segment — for a whole
  // class's worth of ink that adds up. Stride through extra-dense strokes
  // rather than emit a segment per point; imperceptible at this scale,
  // and keeps file size/generation time bounded instead of growing
  // unboundedly with how long a teacher writes.
  const MAX_SEGMENTS = 250;
  const stride = points.length > MAX_SEGMENTS ? Math.ceil(points.length / MAX_SEGMENTS) : 1;

  for (let i = 0; i < points.length - 1; i += stride) {
    const p1 = points[i];
    const p2 = points[Math.min(i + stride, points.length - 1)];
    const x1 = p1.x * scaleX;
    const y1 = p1.y * scaleY;
    const x2 = p2.x * scaleX;
    const y2 = p2.y * scaleY;
    if (x1 === x2 && y1 === y2) continue;
    try {
      slide.addShape("line", {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        w: x2 - x1,
        h: y2 - y1,
        line: { color: hexColor, width: lineWidth },
      });
    } catch (err) {
      console.warn("[PPTX Generator] Stroke segment warning:", err);
    }
  }
}

/** Mirrors CanvasEngine.drawText() in canvas-engine.ts (left-anchored,
 * top-of-line-box layout) so a text object matches its on-board look. */
function renderNativeText(slide: any, textObj: any, scaleX: number, scaleY: number) {
  const { text, color, size, position } = textObj;
  if (!text || !position) return;

  const hexColor = normalizeHex(color);
  // pptxgenjs font size is in points; VIRTUAL space is treated as px here,
  // same ratio the watermark/footer sizing already uses via scaleX.
  const fontSizePt = Math.max(4, (size || 32) * scaleX * 72);

  try {
    slide.addText(String(text), {
      x: position.x * scaleX,
      y: position.y * scaleY,
      w: Math.max(0.3, (textObj.width || 200) * scaleX),
      h: Math.max(0.2, (textObj.height || 40) * scaleY),
      fontSize: fontSizePt,
      color: hexColor,
      align: "left",
      valign: "top",
      margin: 0,
    });
  } catch (err) {
    console.warn("[PPTX Generator] Text add warning:", err);
  }
}

function renderNativeShape(slide: any, obj: any, scaleX: number, scaleY: number) {
  const { shape, color, size, start, end } = obj;
  if (!start || !end) return;

  const hexColor = normalizeHex(color);
  const lineWidth = Math.max(1, (size || 3) * 0.6);

  const x1 = start.x * scaleX;
  const y1 = start.y * scaleY;
  const x2 = end.x * scaleX;
  const y2 = end.y * scaleY;

  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const w = Math.max(0.05, Math.abs(x2 - x1));
  const h = Math.max(0.05, Math.abs(y2 - y1));

  try {
    if (shape === "rectangle") {
      slide.addShape("rect", {
        x: minX,
        y: minY,
        w,
        h,
        line: { color: hexColor, width: lineWidth },
        fill: { type: "none" },
      });
    } else if (shape === "circle") {
      slide.addShape("ellipse", {
        x: minX,
        y: minY,
        w,
        h,
        line: { color: hexColor, width: lineWidth },
        fill: { type: "none" },
      });
    } else if (shape === "line") {
      slide.addShape("line", {
        x: x1,
        y: y1,
        w: x2 - x1,
        h: y2 - y1,
        line: { color: hexColor, width: lineWidth },
      });
    } else if (shape === "triangle") {
      slide.addShape("triangle", {
        x: minX,
        y: minY,
        w,
        h,
        line: { color: hexColor, width: lineWidth },
        fill: { type: "none" },
      });
    } else if (shape === "arrow") {
      // pptxgenjs has a native "line" shape with arrowhead end-cap support,
      // unlike rectangle/circle/triangle there's no dedicated arrow
      // autoshape needed here. Previously this branch didn't exist at all,
      // so an arrow-tool object was silently dropped from the export.
      slide.addShape("line", {
        x: minX,
        y: minY,
        w: x2 - x1,
        h: y2 - y1,
        line: { color: hexColor, width: lineWidth, endArrowType: "triangle" },
      });
    }
  } catch (err) {
    console.warn("[PPTX Generator] Shape add warning:", err);
  }
}
