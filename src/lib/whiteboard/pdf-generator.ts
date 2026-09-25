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

    // 1. Draw Background (Includes PPT Background Image, Official Header Template & Branding)
    await drawSlideBackground(doc, p.background, pdfWidth, pdfHeight, sessionTitle, logoBase64);

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

import { getR2ObjectBuffer } from "@/lib/storage/r2-client";
import { keyFromPublicUrl } from "@/lib/storage";
import fs from "fs";
import path from "path";

/**
 * Robust background image fetcher:
 * 1. Checks if the background is a direct Data URI.
 * 2. If it is an R2 key or an R2 URL (whiteboard-backgrounds, classes, etc.),
 *    loads the buffer directly from R2 SDK via getR2ObjectBuffer (never fails from CORS or private bucket permissions).
 * 3. If it is a local public file (/brand/..., etc.), reads from local filesystem.
 * 4. Fallback to HTTP fetch.
 */
async function fetchBackgroundImage(
  urlOrKey: string
): Promise<{ dataUrl: string; format: "PNG" | "JPEG" | "WEBP" } | null> {
  if (!urlOrKey) return null;

  // 1. Data URI
  if (urlOrKey.startsWith("data:image/")) {
    const format: "PNG" | "JPEG" | "WEBP" =
      urlOrKey.includes("jpeg") || urlOrKey.includes("jpg")
        ? "JPEG"
        : urlOrKey.includes("webp")
        ? "WEBP"
        : "PNG";
    return { dataUrl: urlOrKey, format };
  }

  // 2. Extract potential R2 storage key
  let r2Key: string | null = null;
  const knownPrefixes = [
    "whiteboard-backgrounds/",
    "classes/",
    "modules/",
    "documents/",
    "slides/",
    "profile-images/",
    "question-images/",
    "pdf/",
  ];

  for (const prefix of knownPrefixes) {
    if (urlOrKey.includes(prefix)) {
      const idx = urlOrKey.indexOf(prefix);
      const sub = urlOrKey.substring(idx);
      r2Key = sub.split("?")[0]?.split("#")[0] ?? null;
      break;
    }
  }

  if (!r2Key) {
    r2Key = keyFromPublicUrl(urlOrKey);
  }

  // If identified as R2 asset, load directly via R2 SDK
  if (r2Key) {
    try {
      const r2Obj = await getR2ObjectBuffer(r2Key);
      if (r2Obj && r2Obj.buffer.length > 0) {
        const base64 = r2Obj.buffer.toString("base64");
        const ct = r2Obj.contentType || "image/png";
        let format: "PNG" | "JPEG" | "WEBP" = "PNG";
        if (ct.includes("jpeg") || ct.includes("jpg") || /\.jpe?g(\?|$)/i.test(r2Key)) format = "JPEG";
        else if (ct.includes("webp") || /\.webp(\?|$)/i.test(r2Key)) format = "WEBP";
        return { dataUrl: `data:${ct};base64,${base64}`, format };
      }
    } catch (err) {
      console.warn("[PDF Generator] Direct R2 getObject failed, will try fallback:", err);
    }
  }

  // 3. Local filesystem in public directory
  if (urlOrKey.startsWith("/") && !urlOrKey.startsWith("/api/")) {
    const localPath = path.join(process.cwd(), "public", urlOrKey.replace(/^\/+/, ""));
    if (fs.existsSync(localPath)) {
      try {
        const buf = fs.readFileSync(localPath);
        const base64 = buf.toString("base64");
        let format: "PNG" | "JPEG" | "WEBP" = "PNG";
        if (/\.jpe?g$/i.test(localPath)) format = "JPEG";
        else if (/\.webp$/i.test(localPath)) format = "WEBP";
        return { dataUrl: `data:image/${format.toLowerCase()};base64,${base64}`, format };
      } catch (err) {
        console.warn("[PDF Generator] Local file read error:", err);
      }
    }
  }

  // 4. HTTP Fetch fallback
  try {
    const fullUrl = urlOrKey.startsWith("/")
      ? `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${urlOrKey}`
      : urlOrKey;

    const res = await fetch(fullUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    let format: "PNG" | "JPEG" | "WEBP" = "PNG";
    if (contentType.includes("jpeg") || /\.jpe?g(\?|$)/i.test(urlOrKey)) format = "JPEG";
    else if (contentType.includes("webp") || /\.webp(\?|$)/i.test(urlOrKey)) format = "WEBP";
    return { dataUrl: `data:${contentType || "image/png"};base64,${base64}`, format };
  } catch (err) {
    console.warn("[PDF Generator] Could not fetch background image:", err);
    return null;
  }
}

async function drawSlideBackground(
  doc: jsPDF,
  bg: string,
  w: number,
  h: number,
  sessionTitle: string = "Class Notes",
  logoBase64?: string | null
): Promise<void> {
  const isImageBg =
    bg &&
    (bg.startsWith("data:image/") ||
      bg.startsWith("http://") ||
      bg.startsWith("https://") ||
      bg.startsWith("/") ||
      bg.includes("whiteboard-backgrounds/") ||
      bg.includes("classes/"));

  if (isImageBg) {
    const img = await fetchBackgroundImage(bg);
    if (img) {
      try {
        doc.addImage(img.dataUrl, img.format, 0, 0, w, h);
        return;
      } catch (err) {
        console.warn("[PDF Generator] Background addImage failed, drawing clean theme:", err);
      }
    }
  }

  // Official Theme: Atomic White (Brand Template with Orange Accent & Header Logo)
  if (bg === "atomic_white" || !bg || bg === "light" || bg === "blank") {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, "F");

    // Top Header Banner
    doc.setFillColor(255, 247, 237); // #FFF7ED
    doc.rect(0, 0, w, 26, "F");

    // Orange Accent Line
    doc.setFillColor(234, 88, 12); // #EA580C
    doc.rect(0, 26, w, 2, "F");

    // Header Logo & Branding
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", 16, 4, 38, 18);
      } catch {
        // Soft fallback
      }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(234, 88, 12);
    doc.text("ATOMIC PATHSHALA", logoBase64 ? 58 : 18, 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`•  ${sessionTitle}`, logoBase64 ? 170 : 130, 17);
    return;
  }

  // Official Theme: Atomic Dark
  if (bg === "atomic_dark" || bg === "dark") {
    doc.setFillColor(13, 15, 23); // #0D0F17
    doc.rect(0, 0, w, h, "F");

    // Top Header Banner
    doc.setFillColor(23, 25, 36); // #171924
    doc.rect(0, 0, w, 26, "F");

    // Orange Accent Line
    doc.setFillColor(234, 88, 12); // #EA580C
    doc.rect(0, 26, w, 2, "F");

    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", 16, 4, 38, 18);
      } catch {
        // Soft fallback
      }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(234, 88, 12);
    doc.text("ATOMIC PATHSHALA", logoBase64 ? 58 : 18, 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`•  ${sessionTitle}`, logoBase64 ? 170 : 130, 17);
    return;
  }

  // Official Theme: Atomic Ruled
  if (bg === "atomic_ruled") {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, "F");

    // Top Header Banner
    doc.setFillColor(255, 247, 237);
    doc.rect(0, 0, w, 26, "F");
    doc.setFillColor(234, 88, 12);
    doc.rect(0, 26, w, 2, "F");

    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", 16, 4, 38, 18);
      } catch {}
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(234, 88, 12);
    doc.text("ATOMIC PATHSHALA", logoBase64 ? 58 : 18, 17);

    // Ruled lines below header
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    for (let y = 48; y < h - 20; y += 18) {
      doc.line(0, y, w, y);
    }
    return;
  }

  // Notebook Ruled with Margin
  if (bg === "ruled" || bg === "notebook" || bg === "lines") {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, "F");

    // Left red margin
    doc.setDrawColor(248, 113, 113);
    doc.setLineWidth(0.8);
    doc.line(45, 0, 45, h);

    // Horizontal lines
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    for (let y = 32; y < h - 20; y += 18) {
      doc.line(0, y, w, y);
    }
    return;
  }

  // Math Grid
  if (bg === "grid" || bg === "graph") {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, "F");
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    for (let x = 0; x < w; x += 15) doc.line(x, 0, x, h);
    for (let y = 0; y < h; y += 15) doc.line(0, y, w, y);
    return;
  }

  // Coordinate Plane (XY Axes with Grid)
  if (bg === "coordinate") {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, "F");

    // Light grid
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.5);
    for (let x = 0; x < w; x += 15) doc.line(x, 0, x, h);
    for (let y = 0; y < h; y += 15) doc.line(0, y, w, y);

    // Main X-Axis
    const midY = Math.round(h / 2);
    const midX = Math.round(w / 2);
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(1.2);
    doc.line(10, midY, w - 10, midY); // X Axis
    doc.line(midX, 10, midX, h - 10); // Y Axis

    // Arrowheads
    doc.setFillColor(100, 116, 139);
    doc.triangle(w - 10, midY, w - 16, midY - 3, w - 16, midY + 3, "FD"); // +X
    doc.triangle(midX, 10, midX - 3, 16, midX + 3, 16, "FD"); // +Y

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("+X", w - 24, midY - 5);
    doc.text("+Y", midX + 6, 20);
    doc.text("O (0,0)", midX + 4, midY + 10);
    return;
  }

  // Dotted Pattern
  if (bg === "dotted" || bg === "dots") {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, "F");
    doc.setFillColor(203, 213, 225);
    for (let x = 10; x < w; x += 18) {
      for (let y = 10; y < h; y += 18) {
        doc.circle(x, y, 0.75, "F");
      }
    }
    return;
  }

  // Default clean white
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, "F");
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
