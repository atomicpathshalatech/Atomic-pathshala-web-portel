import "server-only";
import { launchBrowser } from "@/lib/pdf/html-to-pdf";

/**
 * Prints a card document (render.ts, mode "pdf") to a one-page vector PDF at
 * CR80 size, 2.125 × 3.37 in (54 × 85.6 mm) — text, QR and artwork stay
 * vector; only the photo and logo are images.
 */
export async function renderCardPdf(html: string, opts: { timeoutMs?: number } = {}): Promise<Buffer> {
  const timeout = opts.timeoutMs ?? 45_000;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: "networkidle0", timeout });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete ? null : new Promise((r) => ((img.onload = r), (img.onerror = r)))
        )
      );
    });
    const pdf = await page.pdf({ width: "2.125in", height: "3.37in", printBackground: true, pageRanges: "1", timeout });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** The PDF as a private, uncached download (or inline, for the browser's print view). */
export function cardPdfResponse(pdf: Buffer, personName: string, inline: boolean): Response {
  const safe = personName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "card";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="Atomic-Pathshala-ID-${safe}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
