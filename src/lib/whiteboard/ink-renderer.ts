import "server-only";
import { launchBrowser } from "@/lib/pdf/html-to-pdf";
import type { StrokeObject } from "@/lib/canvas/canvas-engine";
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from "@/lib/canvas/canvas-engine";

/**
 * Draws each slide's objects with the live board's own engine (in the
 * server's headless browser, on /board-render) and returns one transparent
 * PNG per slide. The PDF generator lays that over the slide background, so
 * the exported page is what the teacher saw — not a second drawing routine
 * that has to be kept in step with the board by hand (it wasn't: curves,
 * transparency, dots, pen styles and several shapes were missing from PDFs).
 *
 * Each slide is drawn from its own object list on a fresh engine, so nothing
 * from one slide can appear on another.
 */

export type InkLayer = {
  /** PNG data URL (1920×1080, transparent), or null when the slide has no objects. */
  png: string | null;
  /** How many objects were handed to the engine for this slide. */
  objects: number;
};

export function boardRenderBaseUrl(requestOrigin?: string | null): string {
  // The public site first: a raw deployment URL can sit behind Vercel's login wall.
  const fromEnv =
    process.env.BOARD_RENDER_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";
  return (requestOrigin || fromEnv || "http://localhost:3000").replace(/\/$/, "");
}

/** Objects that still exist at export time (a fully faded highlighter is gone). */
export function exportableObjects(objects: StrokeObject[] | null | undefined, now = Date.now()): StrokeObject[] {
  return (objects ?? []).filter((o) => {
    if (!o || typeof o !== "object") return false;
    const fade = (o as { fadeExpiresAt?: number }).fadeExpiresAt;
    return !(typeof fade === "number" && fade <= now);
  });
}

export async function renderInkLayers(
  pages: { pageNumber: number; objects: StrokeObject[] }[],
  opts: { baseUrl: string; timeoutMs?: number }
): Promise<InkLayer[]> {
  const timeout = opts.timeoutMs ?? 90_000;
  const lists = pages.map((p) => exportableObjects(p.objects));
  if (lists.every((l) => l.length === 0)) return lists.map(() => ({ png: null, objects: 0 }));

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT, deviceScaleFactor: 1 });
    await page.goto(`${opts.baseUrl}/board-render`, { waitUntil: "load", timeout });
    await page.waitForFunction("window.__boardRenderReady === true", { timeout });

    const out: InkLayer[] = [];
    for (const objects of lists) {
      if (objects.length === 0) {
        out.push({ png: null, objects: 0 });
        continue;
      }
      // Passed as a JSON string: one structured-clone-free hop, any size.
      const script = "window.__renderBoardInk(" + JSON.stringify(objects) + ")";
      let result: { png: string; drawn: number } | null = null;
      // The page can reload once while it settles (first compile, a service
      // worker taking over): wait for it to be ready again and draw again.
      for (let attempt = 0; attempt < 4 && !result; attempt++) {
        try {
          await page.waitForFunction("window.__boardRenderReady === true && typeof window.__renderBoardInk === \"function\"", { timeout });
          result = (await page.evaluate(script)) as { png: string; drawn: number };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (attempt === 3 || !/context was destroyed|navigation|detached|Target closed/i.test(msg)) throw err;
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      if (!result?.png?.startsWith("data:image/png") || result.drawn !== objects.length) {
        throw new Error(`Board render returned an invalid layer (${result?.drawn ?? "?"} of ${objects.length} objects).`);
      }
      out.push({ png: result.png, objects: objects.length });
    }
    return out;
  } finally {
    await browser.close().catch(() => undefined);
  }
}
