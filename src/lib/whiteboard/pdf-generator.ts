import { jsPDF } from "jspdf";
import { StrokeObject, VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "@/lib/canvas/canvas-engine";
import { SLIDE_WATERMARK, getLogoBase64 } from "@/lib/whiteboard/branding";
import { SHAPE_RENDERERS } from "@/lib/canvas/shapes/registry";

export interface PageDataForExport {
  pageNumber: number;
  background: string;
  objects: StrokeObject[];
}

/**
 * Generates an authoritative 16:9 PDF vector document with all whiteboard pages,
 * strokes, shapes, and the official Atomic Pathshala watermark.
 */
/**
 * The PDF of a board, exactly as it was drawn: the ink of every slide is
 * rendered by the live board's own engine (see ink-renderer.ts) and laid over
 * the slide background. If that renderer cannot run, the older vector
 * drawing below is used so an export never fails outright.
 */
export async function generateWhiteboardPdfExact(
  pages: PageDataForExport[],
  sessionTitle: string = "Class Notes",
  opts: { baseUrl?: string | null } = {}
): Promise<{ pdf: Buffer; exact: boolean; objectsPerPage: number[] }> {
  const { renderInkLayers, boardRenderBaseUrl, exportableObjects } = await import("@/lib/whiteboard/ink-renderer");
  const ordered = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const objectsPerPage = ordered.map((pg) => exportableObjects(pg.objects).length);
  try {
    const layers = await renderInkLayers(ordered, { baseUrl: boardRenderBaseUrl(opts.baseUrl) });
    // Every slide must come back with exactly its own objects.
    if (layers.length !== ordered.length || layers.some((l, i) => l.objects !== objectsPerPage[i])) {
      throw new Error("ink layers do not match the slides");
    }
    return { pdf: await generateWhiteboardPdf(ordered, sessionTitle, layers), exact: true, objectsPerPage };
  } catch (err) {
    console.error("[whiteboard_pdf_exact_render_failed] falling back to vector drawing:", err);
    return { pdf: await generateWhiteboardPdf(ordered, sessionTitle), exact: false, objectsPerPage };
  }
}

export async function generateWhiteboardPdf(
  pages: PageDataForExport[],
  sessionTitle: string = "Class Notes",
  inkLayers?: { png: string | null; objects: number }[]
): Promise<Buffer> {
  // 16:9 standard slide in points: 960pt x 540pt (landscape)
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [960, 540],
    // Deflate page and image streams: a 36-slide lecture was ~100 MB without it.
    compress: true,
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

    // 2. The slide's ink. Preferred: the layer drawn by the board's own
    // engine (exactly what was on screen). Otherwise the vector drawing.
    const layer = inkLayers?.[i];
    if (layer) {
      if (layer.png) {
        try {
          doc.addImage(layer.png, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
        } catch (err) {
          console.warn("[PDF Generator] Ink layer addImage error:", err);
        }
      }
    } else
    for (const obj of p.objects || []) {
      if (obj.type === "stroke") {
        renderStroke(doc, obj, scale);
      } else if (obj.type === "shape") {
        renderShape(doc, obj, scale);
      } else if (obj.type === "text") {
        renderText(doc, obj, scale);
      } else if (obj.type === "raster" && (obj as any).dataUrl) {
        try {
          const rObj = obj as any;
          doc.addImage(rObj.dataUrl, "PNG", rObj.x * scale, rObj.y * scale, rObj.width * scale, rObj.height * scale);
        } catch (err) {
          console.warn("[PDF Generator] Raster addImage error:", err);
        }
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
    doc.text(`Atomic Pathshala • ${sessionTitle} • Slide ${i + 1} of ${pages.length}`, 20, pdfHeight - 12);
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
        doc.addImage(img.dataUrl, img.format, 0, 0, w, h, undefined, "FAST");
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
  if (!points || points.length === 0) return;
  if (points.length === 1) {
    const dot = hexToRgb(stroke.color || "#1A1A1A");
    doc.setFillColor(dot.r, dot.g, dot.b);
    doc.circle(points[0].x * scale, points[0].y * scale, Math.max(0.5, ((stroke.size || 3) * 1.3 * scale) / 2), "F");
    return;
  }

  const isHighlighter = stroke.tool === "highlighter" || stroke.tool === "highlighter-fade";
  const { r, g, b } = hexToRgb(stroke.color || "#1A1A1A");

  try {
    if (isHighlighter && (doc as any).GState) {
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.35 }));
    }
  } catch {}

  doc.setDrawColor(r, g, b);
  doc.setLineWidth(Math.max(0.5, (isHighlighter ? (stroke.size || 5) * 3.5 : (stroke.size || 3)) * scale));
  doc.setLineCap("round");
  doc.setLineJoin("round");

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    doc.line(p1.x * scale, p1.y * scale, p2.x * scale, p2.y * scale);
  }

  try {
    if (isHighlighter && (doc as any).GState) {
      doc.restoreGraphicsState();
    }
  } catch {}
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

/**
 * Creates a fully-featured Canvas2D context adapter that maps canvas drawing
 * operations directly to vector jsPDF instructions, preserving all scientific
 * shapes (bonds, rings, circuits, lenses, biological cells, polygons).
 */
function createJsPdfCanvasContext(doc: jsPDF, scale: number): CanvasRenderingContext2D {
  let currentPath: Array<{ type: "M" | "L" | "Z"; x: number; y: number }> = [];
  let curX = 0;
  let curY = 0;
  let strokeStyle = "#1A1A1A";
  let fillStyle = "#1A1A1A";
  let lineWidth = 1;
  let lineDash: number[] = [];
  const stateStack: any[] = [];
  let matrix = { a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 };

  const transformPoint = (x: number, y: number) => {
    return {
      x: matrix.a * x + matrix.c * y + matrix.e,
      y: matrix.b * x + matrix.d * y + matrix.f,
    };
  };

  const ctx: any = {
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(val: string) {
      strokeStyle = val;
    },
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(val: string) {
      fillStyle = val;
    },
    get lineWidth() {
      return lineWidth;
    },
    set lineWidth(val: number) {
      lineWidth = val;
    },

    save() {
      stateStack.push({
        strokeStyle,
        fillStyle,
        lineWidth,
        lineDash: [...lineDash],
        matrix: { ...matrix },
      });
    },
    restore() {
      if (stateStack.length) {
        const state = stateStack.pop();
        strokeStyle = state.strokeStyle;
        fillStyle = state.fillStyle;
        lineWidth = state.lineWidth;
        lineDash = state.lineDash;
        matrix = state.matrix;
      }
    },
    translate(x: number, y: number) {
      matrix.e += matrix.a * x + matrix.c * y;
      matrix.f += matrix.b * x + matrix.d * y;
    },
    rotate(angle: number) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const a = matrix.a * cos + matrix.c * sin;
      const c = -matrix.a * sin + matrix.c * cos;
      const b = matrix.b * cos + matrix.d * sin;
      const d = -matrix.b * sin + matrix.d * cos;
      matrix.a = a;
      matrix.c = c;
      matrix.b = b;
      matrix.d = d;
    },
    scale(sx: number, sy: number) {
      matrix.a *= sx;
      matrix.c *= sx;
      matrix.b *= sy;
      matrix.d *= sy;
    },
    setLineDash(dash: number[]) {
      lineDash = dash || [];
    },
    getLineDash() {
      return lineDash;
    },
    beginPath() {
      currentPath = [];
    },
    closePath() {
      if (currentPath.length > 0) {
        const first = currentPath[0]!;
        currentPath.push({ type: "Z", x: first.x, y: first.y });
      }
    },
    moveTo(x: number, y: number) {
      const pt = transformPoint(x, y);
      curX = pt.x;
      curY = pt.y;
      currentPath.push({ type: "M", x: pt.x, y: pt.y });
    },
    lineTo(x: number, y: number) {
      const pt = transformPoint(x, y);
      curX = pt.x;
      curY = pt.y;
      currentPath.push({ type: "L", x: pt.x, y: pt.y });
    },
    arc(
      x: number,
      y: number,
      radius: number,
      startAngle: number = 0,
      endAngle: number = Math.PI * 2
    ) {
      const steps = 36;
      const span = endAngle - startAngle;
      for (let i = 0; i <= steps; i++) {
        const theta = startAngle + (span * i) / steps;
        const px = x + radius * Math.cos(theta);
        const py = y + radius * Math.sin(theta);
        const pt = transformPoint(px, py);
        if (i === 0 && currentPath.length === 0) {
          currentPath.push({ type: "M", x: pt.x, y: pt.y });
        } else {
          currentPath.push({ type: "L", x: pt.x, y: pt.y });
        }
      }
    },
    ellipse(
      x: number,
      y: number,
      rx: number,
      ry: number,
      rotation: number = 0,
      startAngle: number = 0,
      endAngle: number = Math.PI * 2
    ) {
      const steps = 36;
      const span = endAngle - startAngle;
      const cosR = Math.cos(rotation);
      const sinR = Math.sin(rotation);
      for (let i = 0; i <= steps; i++) {
        const theta = startAngle + (span * i) / steps;
        const ex = rx * Math.cos(theta);
        const ey = ry * Math.sin(theta);
        const px = x + ex * cosR - ey * sinR;
        const py = y + ex * sinR + ey * cosR;
        const pt = transformPoint(px, py);
        if (i === 0 && currentPath.length === 0) {
          currentPath.push({ type: "M", x: pt.x, y: pt.y });
        } else {
          currentPath.push({ type: "L", x: pt.x, y: pt.y });
        }
      }
    },
    rect(x: number, y: number, w: number, h: number) {
      this.moveTo(x, y);
      this.lineTo(x + w, y);
      this.lineTo(x + w, y + h);
      this.lineTo(x, y + h);
      this.closePath();
    },
    roundRect(x: number, y: number, w: number, h: number, r: number = 8) {
      const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
      this.moveTo(x + radius, y);
      this.lineTo(x + w - radius, y);
      this.arc(x + w - radius, y + radius, radius, -Math.PI / 2, 0);
      this.lineTo(x + w, y + h - radius);
      this.arc(x + w - radius, y + h - radius, radius, 0, Math.PI / 2);
      this.lineTo(x + radius, y + h);
      this.arc(x + radius, y + h - radius, radius, Math.PI / 2, Math.PI);
      this.lineTo(x, y + radius);
      this.arc(x + radius, y + radius, radius, Math.PI, (3 * Math.PI) / 2);
      this.closePath();
    },
    stroke() {
      if (!currentPath.length) return;
      const rgb = hexToRgb(strokeStyle);
      doc.setDrawColor(rgb.r, rgb.g, rgb.b);
      doc.setLineWidth(Math.max(0.5, lineWidth * scale));

      let startX = 0;
      let startY = 0;
      let lastX = 0;
      let lastY = 0;

      for (let i = 0; i < currentPath.length; i++) {
        const seg = currentPath[i]!;
        if (seg.type === "M") {
          startX = seg.x;
          startY = seg.y;
          lastX = seg.x;
          lastY = seg.y;
        } else if (seg.type === "L") {
          doc.line(lastX, lastY, seg.x, seg.y);
          lastX = seg.x;
          lastY = seg.y;
        } else if (seg.type === "Z") {
          doc.line(lastX, lastY, startX, startY);
          lastX = startX;
          lastY = startY;
        }
      }
    },
    fill() {
      if (!currentPath.length) return;
      const rgb = hexToRgb(fillStyle);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);

      const points: Array<[number, number]> = [];
      for (const seg of currentPath) {
        if (seg.type === "M" || seg.type === "L") {
          points.push([seg.x, seg.y]);
        }
      }
      if (points.length >= 3) {
        const origin = points[0]!;
        for (let i = 1; i < points.length - 1; i++) {
          doc.triangle(
            origin[0],
            origin[1],
            points[i]![0],
            points[i]![1],
            points[i + 1]![0],
            points[i + 1]![1],
            "F"
          );
        }
      }
    },
    fillText(text: string, x: number, y: number) {
      const pt = transformPoint(x, y);
      const rgb = hexToRgb(fillStyle);
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(Math.max(4, 14 * scale));
      doc.text(String(text), pt.x, pt.y);
    },
    measureText(text: string) {
      return { width: String(text).length * 8 * scale };
    },
  };

  return ctx as CanvasRenderingContext2D;
}

function renderShape(doc: jsPDF, shapeObj: any, scale: number) {
  const { shape, color, size, start, end, fill } = shapeObj;
  if (!start || !end) return;

  const renderer = SHAPE_RENDERERS[shape];
  if (renderer) {
    try {
      const ctx = createJsPdfCanvasContext(doc, scale);
      renderer({
        ctx,
        start,
        end,
        color: color || "#1A1A1A",
        size: Math.max(0.5, size || 3),
        fill,
      });
      return;
    } catch (err) {
      console.warn("[PDF Generator] Shape renderer error:", shape, err);
    }
  }

  // Fallback vector primitives
  const { r, g, b } = hexToRgb(color || "#1A1A1A");
  doc.setDrawColor(r, g, b);
  if (fill) {
    const fRgb = hexToRgb(fill);
    doc.setFillColor(fRgb.r, fRgb.g, fRgb.b);
  } else {
    doc.setFillColor(r, g, b);
  }
  doc.setLineWidth(Math.max(0.5, (size || 3) * scale));

  const x1 = start.x * scale;
  const y1 = start.y * scale;
  const x2 = end.x * scale;
  const y2 = end.y * scale;
  const drawMode = fill ? "FD" : "S";

  if (shape === "line") {
    doc.line(x1, y1, x2, y2);
  } else if (shape === "rectangle" || shape === "square") {
    const rx = Math.min(x1, x2);
    const ry = Math.min(y1, y2);
    const rw = Math.abs(x2 - x1);
    const rh = Math.abs(y2 - y1);
    doc.rect(rx, ry, rw, rh, drawMode);
  } else if (shape === "circle" || shape === "ellipse") {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    doc.ellipse(cx, cy, rx, ry, drawMode);
  } else if (shape === "triangle") {
    const topX = (x1 + x2) / 2;
    const topY = y1;
    doc.triangle(topX, topY, x1, y2, x2, y2, drawMode);
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
