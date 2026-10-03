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
  tagline: "Learn • Explore • Excel",
  youtubeUrl: "",
  telegramUrl: "",
  websiteUrl: "https://atomicpathshala.in",
};

/** Printed when a DPP has no exam set. */
export const DEFAULT_DPP_EXAM = "NEET / CUET / JEE";

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
    qrSvg(normalizeLink(brand.websiteUrl) || DEFAULT_DPP_BRAND.websiteUrl),
  ]);
  return { youtube, telegram, website };
}

// Outline icons of the detail rows (orange on a soft tile).
const svg = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="#F26A1B" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  chapter: svg(`<path d="M12 6.5C10.4 5.2 8 4.6 4 4.8v13c4-.2 6.4.4 8 1.7 1.6-1.3 4-1.9 8-1.7v-13c-4-.2-6.4.4-8 1.7z"/><path d="M12 6.5v13"/>`),
  topic: svg(`<circle cx="11" cy="13" r="7.5"/><circle cx="11" cy="13" r="3.6"/><path d="M11 13l7.5-7.5M16 4.5l.4 3.1 3.1.4 1.5-2-3-.5-.5-3z"/>`),
  teacher: svg(`<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.8-4 3.7-6 7.5-6s6.700 2 7.500 6z"/>`),
  questions: svg(`<path d="M6.500 3.500h8l4 4v13h-12z"/><path d="M14.500 3.500v4h4M9 12h6M9 15.500h6"/>`),
  klass: svg(`<path d="M2.500 9.500L12 5l9.500 4.500L12 14z"/><path d="M6.500 11.800v4.200c1.500 1.600 3.300 2.400 5.500 2.400s4-.8 5.500-2.400v-4.200M21.500 9.500v5"/>`),
  exam: svg(`<rect x="5" y="4.500" width="14" height="16.500" rx="2"/><path d="M9 4.500V3h6v1.500M8.500 10h7M8.500 13.500h7M8.500 17h4"/>`),
  subtopic: svg(`<path d="M5 6h14M5 12h9M5 18h6"/>`),
};
const ICON_GLOBE = `<svg viewBox="0 0 24 24" fill="none" stroke="#F26A1B" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.500"/><path d="M2.500 12h19M12 2.500c2.600 2.700 3.900 5.900 3.900 9.500s-1.300 6.800-3.900 9.500M12 2.500C9.400 5.200 8.100 8.400 8.100 12s1.300 6.800 3.900 9.500"/></svg>`;

function row(icon: string, label: string, value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  return `<div class="dc-row"><span class="dc-ico">${icon}</span><span class="dc-k">${esc(label)}</span><span class="dc-colon">:</span><span class="dc-v">${esc(v)}</span></div>`;
}

function linkCard(url: string, qr: string | undefined, label: string): string {
  if (!url) return "";
  return `<a class="dc-link" href="${esc(url)}" target="_blank" rel="noopener">
      <span class="dc-qr">${qr ?? ""}</span>
      <span class="dc-link-url">${ICON_GLOBE}<b>${esc(label)}</b></span>
    </a>`;
}

/** The front page markup: one `.page.dpp-cover-page` A4 sheet. */
export function renderDppCoverHtml(info: DppCoverInfo, brand: DppBrand, qrs: DppCoverQrs, logoUrl: string | null): string {
  const youtube = normalizeLink(brand.youtubeUrl);
  const telegram = normalizeLink(brand.telegramUrl);
  const website = normalizeLink(brand.websiteUrl) || DEFAULT_DPP_BRAND.websiteUrl;
  const number = info.dppNumberLabel.replace(/^DPP\s*/i, "") || info.dppNumberLabel;
  const tagline = (brand.tagline || DEFAULT_DPP_BRAND.tagline)
    .split(/\s*[•·|]\s*/)
    .filter(Boolean)
    .map((w) => esc(w))
    .join(`<i>•</i>`);

  const rows = [
    row(ICONS.chapter, "Chapter Name", info.chapter),
    row(ICONS.topic, "Topic", info.topic),
    row(ICONS.subtopic, "Sub-topic", info.subTopic),
    row(ICONS.teacher, "Teacher", info.teacher),
    row(ICONS.questions, "Total Questions", info.questionCount ? String(info.questionCount) : ""),
    row(ICONS.klass, "Class", info.className),
    row(ICONS.exam, "Exam", info.exam || DEFAULT_DPP_EXAM),
  ].join("");

  const links = [
    linkCard(website, qrs.website, displayHost(website)),
    linkCard(youtube, qrs.youtube, "YouTube"),
    linkCard(telegram, qrs.telegram, "Telegram"),
  ].filter(Boolean);

  return `
  <div class="page dpp-cover-page">
    <div class="dc-frame">
      ${logoUrl ? `<img class="dc-wm dc-wm-logo" src="${esc(logoUrl)}" alt="" />` : `<div class="dc-wm">ATOMIC PATHSHALA</div>`}
      <div class="dc-top">
        ${logoUrl ? `<div class="dc-logo"><img src="${esc(logoUrl)}" alt="Atomic Pathshala" /></div>` : ""}
        <div class="dc-name">ATOMIC <span>PATHSHALA</span></div>
        <div class="dc-tagline"><span class="dc-rule"></span><span class="dc-tag">${tagline}</span><span class="dc-rule"></span></div>
      </div>

      <div class="dc-no">${info.solutions ? "DPP NO." : "DPP NO."} <span>${esc(number)}</span></div>

      <div class="dc-rows">${rows}</div>

      <div class="dc-connect">
        <div class="dc-connect-title"><span class="dc-rule"></span><span>CONNECT WITH ATOMIC PATHSHALA</span><span class="dc-rule"></span></div>
        <div class="dc-links">${links.join("")}</div>
      </div>
    </div>
  </div>`;
}

export const DPP_COVER_CSS = `
  .dpp-cover-page { width: 210mm; height: 297mm; box-sizing: border-box; padding: 7mm !important; display: block !important;
    background: #fff; color: #14181f; font-family: 'Montserrat', 'Noto Serif Devanagari', Arial, sans-serif; overflow: hidden; position: relative;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .dpp-cover-page * { box-sizing: border-box; }
  .dpp-cover-page a { color: inherit; text-decoration: none; }
  .dc-frame { position: relative; height: 100%; border: 0.9mm solid #14181f; border-radius: 6mm; padding: 9mm 9mm 8mm; display: flex; flex-direction: column; overflow: hidden; }
  .dc-wm { position: absolute; left: 50%; top: 56%; transform: translate(-50%, -50%); font-weight: 900; font-size: 36pt; letter-spacing: 4px; color: rgba(20, 24, 31, 0.03); white-space: nowrap; pointer-events: none; z-index: 0; }
  .dc-wm-logo { width: 110mm; height: auto; opacity: 0.05; }
  .dc-frame > *:not(.dc-wm) { position: relative; z-index: 1; }
  .dc-top { display: flex; flex-direction: column; align-items: center; }
  .dc-logo { width: 25mm; height: 25mm; }
  .dc-logo img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .dc-name { margin-top: 3.500mm; font-weight: 900; font-size: 32pt; letter-spacing: 0.5px; line-height: 1; color: #14181f; white-space: nowrap; }
  .dc-name span { color: #F26A1B; }
  .dc-tagline { margin-top: 3.500mm; width: 100%; display: flex; align-items: center; gap: 4mm; }
  .dc-rule { flex: 1; height: 0.35mm; background: #F26A1B; opacity: 0.85; }
  .dc-tag { font-size: 11.500pt; font-weight: 500; letter-spacing: 4.5px; text-transform: uppercase; color: #2a2f38; white-space: nowrap; }
  .dc-tag i { font-style: normal; color: #F26A1B; padding: 0 3mm; }
  .dc-no { align-self: center; margin-top: 7mm; border: 0.7mm solid #F26A1B; border-radius: 3.500mm; padding: 2mm 13mm 2.500mm; font-weight: 900; font-size: 36pt; line-height: 1.05; letter-spacing: 0.5px; color: #14181f; white-space: nowrap; }
  .dc-no span { color: #F26A1B; }
  .dc-rows { margin-top: 6mm; }
  .dc-row { display: grid; grid-template-columns: 14mm 46mm 6mm 1fr; align-items: center; min-height: 15mm; border-bottom: 0.3mm solid #d9dce2; padding: 1.500mm 0; }
  .dc-row:last-child { border-bottom: none; }
  .dc-ico { width: 11.500mm; height: 11.500mm; border-radius: 2.800mm; background: #FDEDE2; display: flex; align-items: center; justify-content: center; }
  .dc-ico svg { width: 7mm; height: 7mm; display: block; }
  .dc-k { padding-left: 5mm; font-size: 9.500pt; font-weight: 600; letter-spacing: 2.4px; text-transform: uppercase; color: #3a404b; white-space: nowrap; }
  .dc-colon { font-size: 10pt; font-weight: 600; color: #3a404b; text-align: center; }
  .dc-v { border-left: 0.5mm solid #F26A1B; padding: 1mm 0 1mm 6mm; font-size: 14.500pt; font-weight: 700; color: #14181f; line-height: 1.25; }
  .dc-connect { margin-top: auto; padding-top: 4mm; }
  .dc-connect-title { display: flex; align-items: center; gap: 4mm; font-size: 9.500pt; font-weight: 600; letter-spacing: 3.2px; color: #2a2f38; white-space: nowrap; }
  .dc-links { margin-top: 3mm; display: flex; justify-content: center; gap: 6mm; }
  .dc-link { display: flex; flex-direction: column; align-items: center; gap: 2.500mm; border: 0.3mm solid #dfe2e7; border-radius: 3mm; padding: 3mm 8mm 2.500mm; background: #fff; }
  .dc-qr { width: 25mm; height: 25mm; display: block; }
  .dc-qr svg { width: 100%; height: 100%; display: block; }
  .dc-link-url { display: flex; align-items: center; gap: 1.800mm; font-size: 10pt; color: #F26A1B; }
  .dc-link-url svg { width: 5mm; height: 5mm; }
  .dc-link-url b { font-weight: 800; }
`;
