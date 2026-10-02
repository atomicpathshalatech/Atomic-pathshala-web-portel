import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The logo is embedded in the page (public/brand/logo.png is traced into
// every function — see next.config.mjs), so printing never waits on a
// third-party image host.
let logoDataUrl: string | null | undefined;
export function brandLogoDataUrl(): string | null {
  if (logoDataUrl === undefined) {
    try {
      logoDataUrl = `data:image/png;base64,${readFileSync(join(process.cwd(), "public", "brand", "logo.png")).toString("base64")}`;
    } catch {
      logoDataUrl = null;
    }
  }
  return logoDataUrl;
}
