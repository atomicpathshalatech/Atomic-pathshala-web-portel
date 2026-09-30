// Electron side of test-test-pdf.mjs: loads a test-export booklet page, waits
// for its in-browser pagination, checks every sheet, prints a real PDF (the
// same engine as Chrome's "Save as PDF") and screenshots chosen sheets.
// Input via env (Electron mishandles URL/path arguments on Windows):
//   PDFCHECK_URL, PDFCHECK_OUT, PDFCHECK_PAGES="1,2,3"
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const url = process.env.PDFCHECK_URL;
const outDir = process.env.PDFCHECK_OUT;
const shotPages = (process.env.PDFCHECK_PAGES || "").split(",").filter(Boolean).map(Number);
app.commandLine.appendSwitch("force-device-scale-factor", "1");

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 900, height: 1200, show: false });
  const result = { url };
  try {
    fs.mkdirSync(outDir, { recursive: true });
    await win.loadURL(url);
    const t0 = Date.now();
    let pages = null;
    while (Date.now() - t0 < 60000) {
      pages = await win.webContents.executeJavaScript("window.__bookletPages || null");
      if (pages) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    result.layoutMs = Date.now() - t0;
    result.pages = pages;
    result.checks = await win.webContents.executeJavaScript(`(() => {
      const sheets = [...document.querySelectorAll('#doc-container > .a4-sheet, #doc-container > .page')];
      const problems = [];
      sheets.forEach((p, i) => {
        const r = p.getBoundingClientRect();
        if (Math.abs(r.height - 1122.5) > 2 && !p.classList.contains('page-overflow')) problems.push({ sheet: i + 1, height: Math.round(r.height) });
        const body = p.querySelector('.content-body');
        if (!body) return;
        const stream = body.querySelector('.questions-stream');
        if (stream && stream.offsetHeight > body.clientHeight + 1) problems.push({ sheet: i + 1, clippedPx: stream.offsetHeight - body.clientHeight });
        body.querySelectorAll('.katex-display, .fx-table-wrap, img').forEach((el) => {
          const col = el.closest('.q-side, .sol-col-side');
          if (col && el.getBoundingClientRect().right > col.getBoundingClientRect().right + 2) problems.push({ sheet: i + 1, sticksOut: el.className || el.tagName });
        });
      });
      const rows = [...document.querySelectorAll('.q-row-item')].map((r) => r.id);
      return {
        sheets: sheets.length,
        questionRows: rows.length,
        duplicateRows: rows.filter((id, i) => rows.indexOf(id) !== i),
        solutionRows: document.querySelectorAll('.sol-row-item').length,
        leftoverFlows: document.querySelectorAll('.q-flow, .sol-flow').length,
        overflowPages: document.querySelectorAll('.page-overflow').length,
        problems: problems.slice(0, 20),
        pageNumbers: sheets.map((p) => p.querySelector('.test-header-page-no')?.textContent || null).filter(Boolean),
        coverTotals: [...document.querySelectorAll('.js-total-pages')].map((e) => e.textContent),
        rawLatex: /\\\\(frac|begin|hline|text|vec|rightarrow)\\b/.test(document.getElementById('doc-container').innerText),
      };
    })()`);
    const pdf = await win.webContents.printToPDF({ pageSize: "A4", printBackground: true, margins: { marginType: "none" }, preferCSSPageSize: true });
    fs.writeFileSync(path.join(outDir, "booklet.pdf"), pdf);
    result.pdfBytes = pdf.length;
    result.pdfPages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    win.setContentSize(794, 1123);
    for (const n of shotPages) {
      const ok = await win.webContents.executeJavaScript(`(() => { const s = [...document.querySelectorAll('#doc-container > .a4-sheet, #doc-container > .page')][${n - 1}]; if (!s) return false; document.querySelector('.print-toolbar')?.remove(); s.scrollIntoView({ block: 'start' }); return true; })()`);
      if (!ok) continue;
      await new Promise((r) => setTimeout(r, 300));
      fs.writeFileSync(path.join(outDir, `sheet-${n}.png`), (await win.webContents.capturePage()).toPNG());
    }
  } catch (err) {
    result.error = String((err && err.stack) || err);
  }
  fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 1));
  app.quit();
});
