import pptxgen from "pptxgenjs";
import { PageDataForExport } from "./pdf-generator";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "@/lib/canvas/canvas-engine";
import { SLIDE_WATERMARK, getLogoBase64 } from "@/lib/whiteboard/branding";

/**
 * Generates an authoritative 16:9 PPTX presentation with native PowerPoint
 * shapes, slide backgrounds, and the Atomic Pathshala watermark.
 */
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
    if (p.background === "dark" || p.background === "atomic_dark") {
      slide.background = { color: "12141E" };
    } else {
      slide.background = { color: "FFFFFF" };
    }

    // 2. Render Shapes natively
    for (const obj of p.objects || []) {
      if (obj.type === "shape") {
        renderNativeShape(slide, obj, scaleX, scaleY);
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
    }
  } catch (err) {
    console.warn("[PPTX Generator] Shape add warning:", err);
  }
}
