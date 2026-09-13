import path from "path";
import fs from "fs";

export interface WatermarkConfig {
  position: "bottom-right" | "bottom-left" | "top-right";
  width: number;
  height: number;
  margin: number;
  opacity: number;
}

export const SLIDE_WATERMARK: WatermarkConfig = {
  position: "bottom-right",
  width: 120,
  height: 120,
  margin: 30,
  opacity: 0.85,
};

let cachedLogoBase64: string | null = null;

export function getLogoBase64(): string {
  if (cachedLogoBase64) return cachedLogoBase64;

  const candidatePaths = [
    path.join(process.cwd(), "public", "brand", "logo.png"),
    path.join(process.cwd(), "public", "atomic-logo.png"),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const buffer = fs.readFileSync(p);
      cachedLogoBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
      return cachedLogoBase64;
    }
  }

  // This used to fail silently in production (public/ isn't auto-traced
  // into a serverless function's bundle — see next.config.mjs's
  // outputFileTracingIncludes for the actual fix) with no log at all, so
  // exported PDFs/PPTXs were missing the watermark with no way to notice
  // except visually. Kept as a warning, not a thrown error — a missing
  // logo should never fail the whole export.
  console.warn("[branding] logo file not found at any candidate path — watermark will be omitted", candidatePaths);
  return "";
}
