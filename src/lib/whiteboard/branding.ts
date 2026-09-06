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

  return "";
}
