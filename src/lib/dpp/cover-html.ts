import QRCode from "qrcode";

/**
 * The DPP front page (A4) — shared by the PDF booklet (server) and the live
 * preview in the DPP form (browser), so the preview is exactly what prints.
 * Links are real <a href> (Chrome keeps them clickable in the PDF) and the
 * QR codes are vector SVG, so they scan sharply at any print size.
 */

export type DppBrand = {
  tagline: string;
  youtubeUrl: string;
  telegramUrl: string;
  websiteUrl: string;
};

export const DEFAULT_DPP_BRAND: DppBrand = {
  tagline: "Concept · Practice · Selection",
  youtubeUrl: "",
  telegramUrl: "",
  websiteUrl: "https://atomicpathshala.in",
};

export type DppCoverInfo = {
  dppNumberLabel: string; // "DPP 03" or the DPP code
  name: string;
  subject: string;
  className?: string | null;
  exam?: string | null;
  chapter?: string | null;
  topic?: string | null;
  subTopic?: string | null;
  questionCount: number;
  difficulty?: string | null;
  teacher?: string | null;
  durationMin?: number | null;
  correctMarks?: number | null;
  incorrectMarks?: number | null;
  solutions?: boolean;
};

/** Vector QR codes for the configured links (missing links get none). */
export type DppCoverQrs = { youtube?: string; telegram?: string; website?: string };

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Accepts "atomicpathshala.in" or a full URL; returns an absolute http(s) URL or "". */
export function normalizeLink(url: string | null | undefined): string {
  const v = (url ?? "").trim();
  if (!v) return "";
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

const displayHost = (url: string) => url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");

async function qrSvg(url: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    return await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } });
  } catch {
    return undefined;
  }
}

export async function buildDppCoverQrs(brand: DppBrand): Promise<DppCoverQrs> {
  const [youtube, telegram, website] = await Promise.all([
    qrSvg(normalizeLink(brand.youtubeUrl)),
    qrSvg(normalizeLink(brand.telegramUrl)),
    qrSvg(normalizeLink(brand.websiteUrl)),
  ]);
  return { youtube, telegram, website };
}

const DIFFICULTY_LABEL: Record<string, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };

const fmtMarks = (n: number) => (n > 0 ? `+${n}` : String(n));

const ICON_YT = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="5" width="21" height="14" rx="4" fill="#FF0033"/><path d="M10 9v6l5.2-3z" fill="#fff"/></svg>`;
const ICON_TG = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="#229ED9"/><path d="M6.2 11.7l9.9-3.8c.5-.2.9.1.7.9l-1.7 7.9c-.1.6-.5.7-1 .4l-2.6-1.9-1.3 1.2c-.1.1-.3.3-.6.3l.2-2.7 4.9-4.4c.2-.2 0-.3-.3-.1l-6 3.8-2.6-.8c-.6-.2-.6-.6.1-.8z" fill="#fff"/></svg>`;
const ICON_WEB = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="#F57C00"/><path d="M12 3.5c2.3 2.3 3.4 5.2 3.4 8.5s-1.1 6.2-3.4 8.5M12 3.5C9.7 5.8 8.6 8.7 8.6 12s1.1 6.2 3.4 8.5M3.8 9h16.4M3.8 15h16.4" stroke="#fff" stroke-width="1.4" fill="none"/></svg>`;

function linkCard(kind: string, icon: string, title: string, url: string, qr: string | undefined, cta: string) {
  if (!url) return "";
  return `<a class="dc-link" href="${esc(url)}" target="_blank" rel="noopener">
      <div class="dc-qr">${qr ?? ""}</div>
      <div class="dc-link-text">
        <div class="dc-link-title"><span class="dc-ico">${icon}</span>${esc(title)}</div>
        <div class="dc-link-cta">${esc(cta)}</div>
        <div class="dc-link-url">${esc(displayHost(url))}</div>
      </div>
      <span class="dc-sr">${esc(kind)}</span>
    </a>`;
}

/** The front page markup: one `.page.dpp-cover-page` A4 sheet. */
export function renderDppCoverHtml(info: DppCoverInfo, brand: DppBrand, qrs: DppCoverQrs, logoUrl: string | null): string {
  const youtube = normalizeLink(brand.youtubeUrl);
  const telegram = normalizeLink(brand.telegramUrl);
  const website = normalizeLink(brand.websiteUrl) || DEFAULT_DPP_BRAND.websiteUrl;

  // Two columns; long fields (chapter, topic, sub-topic) take a full row, and
  // a short field left without a partner widens to fill its row.
  const fields = (
    [
      ["Subject", info.subject, false],
      ["Class", info.className, false],
      ["Exam", info.exam, false],
      ["Difficulty", info.difficulty ? DIFFICULTY_LABEL[info.difficulty] ?? info.difficulty : "", false],
      ["Chapter", info.chapter, true],
      ["Topic", info.topic, true],
      ["Sub-topic", info.subTopic, true],
      ["Teacher", info.teacher, false],
      ["Questions", info.questionCount ? String(info.questionCount) : "", false],
    ] as [string, string | null | undefined, boolean][]
  )
    .filter((r) => Boolean(r[1] && String(r[1]).trim()))
    .map(([k, v, wide]) => ({ k, v: String(v).trim(), wide }));
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]!;
    if (f.wide) continue;
    if (fields[i + 1] && !fields[i + 1]!.wide) i++;
    else f.wide = true;
  }

  const stats: [string, string][] = [];
  if (info.questionCount) stats.push(["Questions", String(info.questionCount)]);
  if (info.durationMin) stats.push(["Time", `${info.durationMin} min`]);
  if (info.correctMarks != null) stats.push(["Correct", fmtMarks(info.correctMarks)]);
  if (info.incorrectMarks != null) stats.push(["Wrong", info.incorrectMarks === 0 ? "0" : fmtMarks(info.incorrectMarks)]);

  const links = [
    linkCard("YouTube", ICON_YT, "YouTube", youtube, qrs.youtube, "Scan to watch the lectures"),
    linkCard("Telegram", ICON_TG, "Telegram", telegram, qrs.telegram, "Scan to join for notes & updates"),
    linkCard("Website", ICON_WEB, "Website", website, qrs.website, "Tests, DPPs & results online"),
  ].filter(Boolean);

  return `
  <div class="page dpp-cover-page">
    <div class="dc-band">
      <div class="dc-brand">
        ${logoUrl ? `<div class="dc-logo"><img src="${esc(logoUrl)}" alt="Atomic Pathshala" /></div>` : ""}
        <div>
          <div class="dc-name">ATOMIC PATHSHALA</div>
          <div class="dc-tagline">${esc(brand.tagline)}</div>
        </div>
      </div>
      <div class="dc-no">
        <div class="dc-no-label">${info.solutions ? "SOLUTIONS" : "DPP NO."}</div>
        <div class="dc-no-value">${esc(info.dppNumberLabel.replace(/^DPP\s*/i, "") || info.dppNumberLabel)}</div>
      </div>
    </div>
    <div class="dc-accent"></div>

    <div class="dc-body">
      <div class="dc-kicker">DAILY PRACTICE PROBLEM</div>
      <h1 class="dc-title">${esc(info.name)}</h1>
      ${info.chapter ? `<div class="dc-chapter">${esc(info.chapter)}${info.topic ? ` <span>›</span> ${esc(info.topic)}` : ""}</div>` : ""}

      ${
        stats.length
          ? `<div class="dc-stats">${stats.map(([k, v]) => `<div class="dc-stat"><div class="dc-stat-v">${esc(v)}</div><div class="dc-stat-k">${esc(k)}</div></div>`).join("")}</div>`
          : ""
      }

      <div class="dc-details">
        ${fields.map((f) => `<div class="dc-row${f.wide ? " dc-wide" : ""}"><div class="dc-k">${esc(f.k)}</div><div class="dc-v">${esc(f.v)}</div></div>`).join("")}
      </div>

      <div class="dc-note">
        <b>How to use this DPP:</b> attempt every question in one sitting within the time given, mark your answers,
        then check the solutions and note the mistakes in your Mistake Book. Attempt it online in the Atomic Pathshala app for instant results.
      </div>
    </div>

    <div class="dc-connect">
      <div class="dc-connect-title">CONNECT WITH ATOMIC PATHSHALA</div>
      <div class="dc-links dc-links-${links.length}">${links.join("")}</div>
    </div>

    <div class="dc-foot">
      <span>© Atomic Pathshala</span>
      <a href="${esc(website)}" target="_blank" rel="noopener">${esc(displayHost(website))}</a>
      <span>${esc(info.dppNumberLabel)}</span>
    </div>
  </div>`;
}

export const DPP_COVER_CSS = `
  .dpp-cover-page { width: 210mm; height: 297mm; box-sizing: border-box; padding: 0 !important; display: flex !important; flex-direction: column !important; justify-content: flex-start !important;
    background: #fff; color: #16181d; font-family: 'Montserrat', 'Noto Serif Devanagari', Arial, sans-serif; overflow: hidden; position: relative;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .dpp-cover-page * { box-sizing: border-box; }
  .dpp-cover-page a { color: inherit; text-decoration: none; }
  .dc-band { background: #16181d; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 11mm 14mm 9mm; }
  .dc-brand { display: flex; align-items: center; gap: 5mm; }
  .dc-logo { width: 21mm; height: 21mm; background: #fff; border-radius: 4.5mm; display: flex; align-items: center; justify-content: center; padding: 1.2mm; }
  .dc-logo img { width: 100%; height: 100%; object-fit: contain; }
  .dc-name { font-weight: 900; font-size: 21pt; letter-spacing: 2.2px; line-height: 1.05; }
  .dc-tagline { margin-top: 1.6mm; color: #FF9A3C; font-weight: 700; font-size: 9.5pt; letter-spacing: 1.4px; text-transform: uppercase; }
  .dc-no { text-align: center; border: 1.4px solid #F57C00; border-radius: 3.5mm; padding: 2.4mm 5mm 2mm; min-width: 30mm; }
  .dc-no-label { font-size: 7.5pt; font-weight: 800; letter-spacing: 2px; color: #FF9A3C; }
  .dc-no-value { font-size: 26pt; font-weight: 900; line-height: 1.05; font-family: 'JetBrains Mono', 'Montserrat', monospace; }
  .dc-accent { height: 2.2mm; background: linear-gradient(90deg, #F57C00 0%, #FF9A3C 55%, #16181d 55.2%, #16181d 100%); }
  .dc-body { padding: 8.5mm 14mm 0; flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; }
  .dc-body > * { flex-shrink: 0; }
  .dc-kicker { font-size: 10pt; font-weight: 800; letter-spacing: 5px; color: #F57C00; }
  .dc-title { margin: 2mm 0 0; font-size: 23pt; line-height: 1.15; font-weight: 900; color: #16181d; text-wrap: balance; }
  .dc-chapter { margin-top: 2mm; font-size: 12pt; font-weight: 700; color: #4a4f5a; }
  .dc-chapter span { color: #F57C00; padding: 0 1mm; }
  .dc-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 5.5mm; }
  .dc-stat { border: 1px solid #e3e5ea; border-radius: 3mm; padding: 2.2mm 2mm; text-align: center; background: #fafafb; }
  .dc-stat-v { font-size: 14pt; font-weight: 900; font-family: 'JetBrains Mono', 'Montserrat', monospace; color: #16181d; }
  .dc-stat-k { margin-top: 0.6mm; font-size: 7.5pt; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #7a808c; }
  .dc-details { margin-top: 5.5mm; border: 1.3px solid #16181d; border-radius: 3.5mm; overflow: hidden; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #e3e5ea; }
  .dc-row { display: grid; grid-template-columns: 27mm 1fr; background: #fff; }
  .dc-row.dc-wide { grid-column: 1 / -1; }
  .dc-k { background: #f3f4f6; padding: 2.2mm 3.5mm; font-size: 7.5pt; font-weight: 800; letter-spacing: 1.3px; text-transform: uppercase; color: #5b616d; display: flex; align-items: center; }
  .dc-v { padding: 2.2mm 3.5mm; font-size: 11pt; font-weight: 700; color: #16181d; font-family: 'Montserrat', 'Noto Serif Devanagari', Arial, sans-serif; }
  .dc-note { margin-top: 5mm; border-left: 1.2mm solid #F57C00; background: #fff6ed; padding: 3mm 4.5mm; font-family: 'PT Serif', 'Noto Serif Devanagari', serif; font-size: 9.3pt; line-height: 1.45; color: #3a3f49; border-radius: 0 2.5mm 2.5mm 0; }
  .dc-note b { font-family: 'Montserrat', Arial, sans-serif; color: #16181d; }
  .dc-connect { padding: 4mm 14mm 0; flex-shrink: 0; }
  .dc-connect-title { font-size: 8.5pt; font-weight: 800; letter-spacing: 3px; color: #5b616d; text-align: center; margin-bottom: 3.5mm; display: flex; align-items: center; gap: 3mm; }
  .dc-connect-title::before, .dc-connect-title::after { content: ""; flex: 1; height: 1px; background: #d9dce2; }
  .dc-links { display: grid; gap: 4mm; grid-template-columns: repeat(3, 1fr); }
  .dc-links-1 { grid-template-columns: 1fr; max-width: 70mm; margin: 0 auto; }
  .dc-links-2 { grid-template-columns: repeat(2, 1fr); max-width: 130mm; margin: 0 auto; }
  .dc-link { display: flex; flex-direction: column; align-items: center; gap: 2mm; border: 1.2px solid #e0e2e7; border-radius: 3.5mm; padding: 3.5mm 3mm 3mm; background: #fff; position: relative; }
  .dc-qr { width: 27mm; height: 27mm; }
  .dc-qr svg { width: 100%; height: 100%; display: block; }
  .dc-link-text { text-align: center; }
  .dc-link-title { display: flex; align-items: center; justify-content: center; gap: 1.6mm; font-size: 10.5pt; font-weight: 900; color: #16181d; }
  .dc-ico svg { width: 5mm; height: 5mm; display: block; }
  .dc-link-cta { margin-top: 0.8mm; font-size: 7.5pt; color: #6b717d; font-weight: 600; }
  .dc-link-url { margin-top: 0.8mm; font-size: 7.8pt; color: #F57C00; font-weight: 800; word-break: break-all; }
  .dc-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .dc-foot { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; padding: 3.5mm 14mm; margin-top: 5mm; background: #16181d; color: #c9ccd3; font-size: 8pt; font-weight: 700; letter-spacing: 1px; }
  .dc-foot a { color: #FF9A3C !important; }
`;
