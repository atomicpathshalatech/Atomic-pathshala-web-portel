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
        // Content wider than the room it has in its column (after fitWide's zoom).
        body.querySelectorAll('.katex-display, .fx-table-wrap, .qp-cell img, .qp-cell table:not(.fx-table)').forEach((el) => {
          const parent = el.parentElement;
          if (!parent || !el.closest('.qp-cell')) return;
          const cs = getComputedStyle(parent);
          const room = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          const zoom = parseFloat(el.style.zoom) || 1;
          const width = Math.max(el.scrollWidth, el.offsetWidth) * zoom;
          if (width > room + 2) problems.push({ sheet: i + 1, sticksOut: el.className || el.tagName, width: Math.round(width), room: Math.round(room) });
        });
      });
      const rows = [...document.querySelectorAll('.q-row-item')].map((r) => r.id);
      // How full each question page is (the last page of a subject may be short).
      const fill = sheets.map((p) => {
        const b = p.querySelector('.content-body');
        const s = b && b.querySelector('.questions-stream');
        if (!s) return null;
        const next = p.nextElementSibling;
        const lastOfFlow = !next || !next.querySelector('.questions-stream') || next.querySelector('.test-header-subject-row');
        return { pct: Math.round((100 * s.offsetHeight) / b.clientHeight), lastOfFlow: Boolean(lastOfFlow) };
      });
      const akText = [...document.querySelectorAll('.ak-table td.ak-q')].map((td) => td.textContent.trim()).filter(Boolean);
      const akBlocks = [...document.querySelectorAll('.ak-block')].map((b) => { const c = b.closest('.content-body'); return c ? b.getBoundingClientRect().bottom <= c.getBoundingClientRect().bottom + 1 : false; });
      return {
        sheets: sheets.length,
        questionRows: rows.length,
        duplicateRows: rows.filter((id, i) => rows.indexOf(id) !== i),
        solutionRows: document.querySelectorAll('.sol-row-item').length,
        leftoverFlows: document.querySelectorAll('.q-flow, .sol-flow').length,
        overflowPages: document.querySelectorAll('.page-overflow').length,
        underfilled: fill.map((f, i) => f && !f.lastOfFlow && f.pct < 65 ? { sheet: i + 1, pct: f.pct } : null).filter(Boolean),
        answerKeyNumbers: akText,
        answerKeyFits: akBlocks.every(Boolean),
        siteLinks: [...document.querySelectorAll('a.site-link')].filter((a) => a.href === 'https://ap.atomicpathshala.in/').length,
        pagesWithLink: sheets.filter((p) => p.querySelector('a.site-link')).length,
        optionLabels: [...document.querySelectorAll('.q-opt .qp-en .opt-key')].slice(0, 4).map((e) => e.textContent),
        tinyOptionImages: [...document.querySelectorAll('.opt-text img')].filter((img) => img.getBoundingClientRect().width < 0.5 * img.closest('.opt-text').getBoundingClientRect().width).length,
        coverText: (document.querySelector('.cover-page') || {}).innerText || '',
        firstSheetHasAnswerKey: Boolean(sheets[0] && sheets[0].querySelector('.ak-block')),
        solutionFollowsQuestion: (() => {
          const seq = [...document.querySelectorAll('.q-row-item, .sol-row-item')].map((e) => e.id);
          if (!seq.some((id) => id.startsWith('sol-'))) return false;
          for (let i = 0; i < seq.length; i += 2) if (seq[i + 1] !== 'sol-' + seq[i]) return false;
          return true;
        })(),
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
    result.pdfLinks = (pdf.toString("latin1").match(/\/URI\s*\(https:\/\/ap\.atomicpathshala\.in\/?\)/g) || []).length;
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
