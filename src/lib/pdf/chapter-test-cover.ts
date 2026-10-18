/**
 * Front page of a CHAPTER test's PDF — one page for one chapter, lighter than
 * the full exam booklet cover (no OMR rules, back cover or rough pages):
 * brand, "CHAPTER TEST", subject and chapter, when it is held, the paper's
 * numbers (questions, time, marks, marking), short bilingual instructions and
 * boxes for the student's name and roll number.
 */

export type ChapterTestCoverData = {
  logoUrl: string | null;
  testName: string;
  testCode?: string | null;
  subject: string;
  chapter: string;
  batchName?: string | null;
  /** When the test is held (shown in IST). */
  heldAt?: Date | string | null;
  durationMin: number;
  totalQuestions: number;
  correctMarks: number;
  incorrectMarks: number;
  totalMarks: number;
  /** Solutions booklet instead of the question paper. */
  solutions?: boolean;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function heldAtText(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export const CHAPTER_COVER_CSS = `
.a4-sheet.ct-cover,.ct-cover{width:210mm;height:297mm;min-height:297mm;justify-content:flex-start;box-sizing:border-box;padding:14mm 14mm 12mm;display:flex;flex-direction:column;font-family:"Inter","Segoe UI",Arial,sans-serif;color:#0f172a;background:#fff;page-break-after:always;position:relative;overflow:hidden}
.ct-cover *{box-sizing:border-box}
.ct-band{position:absolute;inset:0 0 auto 0;height:58mm;background:linear-gradient(135deg,#0b3b8f 0%,#1d4ed8 55%,#0ea5e9 100%)}
.ct-band:after{content:"";position:absolute;right:-30mm;top:-30mm;width:110mm;height:110mm;border-radius:50%;background:rgba(255,255,255,.08)}
.ct-head{position:relative;display:flex;align-items:center;gap:5mm;color:#fff}
.ct-logo{width:17mm;height:17mm;border-radius:4mm;background:#fff;padding:1.6mm;object-fit:contain}
.ct-brand{font-size:17pt;font-weight:800;letter-spacing:.06em;line-height:1}
.ct-brand span{color:#fde68a}
.ct-tag{font-size:7.5pt;letter-spacing:.35em;opacity:.85;margin-top:1.5mm}
.ct-kind{position:relative;margin-top:9mm;color:#fff;display:flex;align-items:flex-end;justify-content:space-between;gap:6mm}
.ct-kind-title{font-size:30pt;font-weight:900;letter-spacing:.02em;line-height:1}
.ct-kind-sub{font-size:9pt;opacity:.9;margin-top:2mm}
.ct-code{font-family:"JetBrains Mono",Consolas,monospace;font-size:8.5pt;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.35);border-radius:2mm;padding:1.2mm 2.6mm;white-space:nowrap}
.ct-card{position:relative;margin-top:12mm;border:1px solid #e2e8f0;border-radius:4mm;padding:7mm 8mm;background:#fff;box-shadow:0 2mm 6mm rgba(15,23,42,.06)}
.ct-subject{display:inline-block;font-size:8pt;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#1d4ed8;background:#eff6ff;border-radius:1.5mm;padding:1mm 2.5mm}
.ct-chapter{font-size:22pt;font-weight:800;line-height:1.15;margin-top:3mm}
.ct-name{font-size:10.5pt;color:#475569;margin-top:2mm}
.ct-when{margin-top:5mm;display:flex;gap:2.5mm;align-items:center;font-size:10pt;font-weight:600;color:#0f172a}
.ct-when b{color:#1d4ed8}
.ct-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-top:7mm}
.ct-stat{border:1px solid #e2e8f0;border-radius:3mm;padding:3.5mm;text-align:center;background:#f8fafc}
.ct-stat-v{font-size:17pt;font-weight:800;color:#0b3b8f;line-height:1}
.ct-stat-l{font-size:7.5pt;color:#64748b;margin-top:1.5mm;letter-spacing:.04em;text-transform:uppercase}
.ct-marking{margin-top:4mm;font-size:9pt;color:#334155;text-align:center}
.ct-marking b.ok{color:#047857}.ct-marking b.no{color:#b91c1c}
.ct-inst{margin-top:8mm;display:grid;grid-template-columns:1fr 1fr;gap:6mm}
.ct-inst h3{font-size:9pt;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0b3b8f;margin:0 0 2mm}
.ct-inst ol{list-style:decimal outside!important;margin:0;padding-left:4.5mm;font-size:8.6pt;line-height:1.55;color:#334155}
.ct-student{margin-top:auto;border:1.5px dashed #94a3b8;border-radius:3mm;padding:5mm 6mm;display:grid;grid-template-columns:1.6fr 1fr;gap:5mm}
.ct-field{font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:.08em}
.ct-line{height:8mm;border-bottom:1px solid #0f172a}
.ct-foot{margin-top:5mm;display:flex;justify-content:space-between;font-size:8pt;color:#64748b}
.ct-foot a{color:#1d4ed8;text-decoration:none;font-weight:600}
`;

export function renderChapterTestCoverHtml(d: ChapterTestCoverData): string {
  const when = heldAtText(d.heldAt);
  const h = Math.floor(d.durationMin / 60);
  const m = d.durationMin % 60;
  const time = h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
  const neg = Math.abs(d.incorrectMarks);
  return `
<style>${CHAPTER_COVER_CSS}</style>
<div class="a4-sheet ct-cover">
  <div class="ct-band"></div>
  <div class="ct-head">
    ${d.logoUrl ? `<img class="ct-logo" src="${d.logoUrl}" alt="" />` : ""}
    <div>
      <div class="ct-brand">ATOMIC <span>PATHSHALA</span></div>
      <div class="ct-tag">LEARN • EXPLORE • EXCEL</div>
    </div>
  </div>
  <div class="ct-kind">
    <div>
      <div class="ct-kind-title">CHAPTER TEST</div>
      <div class="ct-kind-sub">${d.solutions ? "Solutions &amp; answer key" : "Question paper"}${d.batchName ? ` · ${esc(d.batchName)}` : ""}</div>
    </div>
    ${d.testCode ? `<div class="ct-code">${esc(d.testCode)}</div>` : ""}
  </div>

  <div class="ct-card">
    <span class="ct-subject">${esc(d.subject)}</span>
    <div class="ct-chapter">${esc(d.chapter)}</div>
    <div class="ct-name">${esc(d.testName)}</div>
    ${when ? `<div class="ct-when"><span>Held on <b>${esc(when)}</b></span></div>` : ""}
    <div class="ct-stats">
      <div class="ct-stat"><div class="ct-stat-v">${d.totalQuestions}</div><div class="ct-stat-l">Questions</div></div>
      <div class="ct-stat"><div class="ct-stat-v">${time}</div><div class="ct-stat-l">Time</div></div>
      <div class="ct-stat"><div class="ct-stat-v">${d.totalMarks}</div><div class="ct-stat-l">Max marks</div></div>
      <div class="ct-stat"><div class="ct-stat-v">1</div><div class="ct-stat-l">Chapter</div></div>
    </div>
    <div class="ct-marking">Correct <b class="ok">+${d.correctMarks}</b> · Wrong <b class="no">−${neg}</b> · Not attempted <b>0</b></div>
  </div>

  <div class="ct-inst">
    <div>
      <h3>Instructions</h3>
      <ol>
        <li>This test covers only the chapter above.</li>
        <li>Each question has one correct answer unless stated.</li>
        <li>Each correct answer gets ${d.correctMarks} marks; ${neg} mark${neg === 1 ? " is" : "s are"} deducted for each wrong one.</li>
        <li>Use a blue / black ball point pen. Rough work only in the space given.</li>
      </ol>
    </div>
    <div>
      <h3>निर्देश</h3>
      <ol>
        <li>यह परीक्षा केवल ऊपर दिए गए अध्याय पर आधारित है।</li>
        <li>प्रत्येक प्रश्न का एक ही सही उत्तर है, जब तक अन्यथा न लिखा हो।</li>
        <li>प्रत्येक सही उत्तर पर ${d.correctMarks} अंक; प्रत्येक गलत उत्तर पर ${neg} अंक घटेगा।</li>
        <li>केवल नीले / काले बॉल पॉइंट पेन का प्रयोग करें। रफ कार्य दिए गए स्थान पर ही करें।</li>
      </ol>
    </div>
  </div>

  <div class="ct-student">
    <div><div class="ct-field">Student name</div><div class="ct-line"></div></div>
    <div><div class="ct-field">Roll no.</div><div class="ct-line"></div></div>
  </div>
  <div class="ct-foot">
    <span>Atomic Pathshala · Chapter-wise practice for NEET / JEE</span>
    <a href="https://ap.atomicpathshala.in">ap.atomicpathshala.in</a>
  </div>
</div>`;
}
