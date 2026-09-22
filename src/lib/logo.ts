import path from "path";
import fs from "fs";

let cachedLogoUri: string | null = null;

export function getLogoDataUri(): string {
  if (cachedLogoUri) return cachedLogoUri;

  try {
    const candidatePaths = [
      path.join(process.cwd(), "public", "brand", "logo.png"),
      path.join(process.cwd(), "public", "atomic-logo.png"),
      path.join(process.cwd(), "public", "logo.png"),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const buffer = fs.readFileSync(p);
        cachedLogoUri = `data:image/png;base64,${buffer.toString("base64")}`;
        return cachedLogoUri;
      }
    }
  } catch (err) {
    console.warn("[logo] Could not load logo as base64:", err);
  }

  return "/brand/logo.png";
}
