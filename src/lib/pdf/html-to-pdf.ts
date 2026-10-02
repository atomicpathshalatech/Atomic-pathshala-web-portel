import "server-only";
import { existsSync } from "node:fs";

/**
 * Renders a booklet page (test-export-engine HTML) to a real, vector PDF
 * with headless Chromium — so students get a small file that downloads
 * directly, instead of the browser's print dialog.
 *
 * On Vercel/Linux this uses @sparticuz/chromium; on a developer machine it
 * uses a locally installed Chrome/Edge (or CHROME_PATH).
 */

const LOCAL_BROWSERS = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean) as string[];

export async function launchBrowser() {
  const puppeteer = (await import("puppeteer-core")).default;
  const local = process.platform !== "linux" || process.env.CHROME_PATH ? LOCAL_BROWSERS.find((p) => existsSync(p)) : undefined;
  if (local) {
    return puppeteer.launch({ executablePath: local, headless: true, args: ["--no-sandbox", "--font-render-hinting=none"] });
  }
  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, "--font-render-hinting=none"],
    headless: true,
    defaultViewport: { width: 1240, height: 1754 },
  });
}

export async function renderBookletPdf(html: string, opts: { timeoutMs?: number } = {}): Promise<Buffer> {
  const timeout = opts.timeoutMs ?? 50_000;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: "networkidle0", timeout });
    // The booklet lays itself out (pagination) and then marks <html> ready.
    await page.waitForSelector("html.booklet-ready", { timeout });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, timeout });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/**
 * Prints a complete HTML document (e.g. the premium module notes) to an A4
 * PDF — waits for web fonts and images, prints backgrounds, and can add a
 * running header/footer.
 */
export async function renderHtmlPdf(
  html: string,
  opts: { timeoutMs?: number; headerTemplate?: string; footerTemplate?: string } = {}
): Promise<Buffer> {
  const timeout = opts.timeoutMs ?? 120_000;
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
    const withHeader = Boolean(opts.headerTemplate || opts.footerTemplate);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: withHeader,
      headerTemplate: opts.headerTemplate ?? "<span></span>",
      footerTemplate: opts.footerTemplate ?? "<span></span>",
      timeout,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
