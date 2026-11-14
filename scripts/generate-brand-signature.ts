import { launchBrowser } from "../src/lib/pdf/html-to-pdf";
import fs from "fs";
import path from "path";

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 200, deviceScaleFactor: 4 });

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mrs+Saint+Delafield&display=block" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
  }
  .sig-container {
    position: relative;
    width: 180px;
    height: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .sig-script {
    position: relative;
    width: 100%;
    height: 48px;
  }
  .sig-script span {
    position: absolute;
    left: 50%;
    top: 2px;
    transform: translateX(-50%) rotate(-5deg);
    font-family: "Mrs Saint Delafield", "Segoe Script", cursive;
    font-size: 46px;
    line-height: 1;
    white-space: nowrap;
    color: #13235c;
    letter-spacing: 0.2px;
  }
  .sig-flourish {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 2px;
    width: calc(100% - 20px);
    height: 16px;
  }
</style>
</head>
<body>
  <div class="sig-container" id="sig">
    <div class="sig-script">
      <span>Firoz Ali</span>
      <svg class="sig-flourish" viewBox="0 0 120 16" aria-hidden="true">
        <path d="M4 11 C 30 4, 62 15, 88 8 S 112 3, 117 6" fill="none" stroke="#13235c" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </div>
  </div>
</body>
</html>`;

  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  // small wait to ensure font rasterization
  await new Promise((r) => setTimeout(r, 600));

  const element = await page.$("#sig");
  if (!element) throw new Error("Element not found");

  const buffer = await element.screenshot({
    omitBackground: true,
    type: "png",
  });

  const outPath = path.join(process.cwd(), "public", "brand", "signature.png");
  fs.writeFileSync(outPath, buffer);
  console.log(`Saved signature to ${outPath} (${buffer.length} bytes)`);

  await browser.close();
}

main().catch(console.error);
