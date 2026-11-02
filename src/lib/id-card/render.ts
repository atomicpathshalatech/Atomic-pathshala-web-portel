/**
 * The Atomic Pathshala ID card as one self-contained HTML document — the
 * same markup is shown in the on-screen preview (an iframe) and printed to
 * the PDF by headless Chromium, so screen and print can never drift apart.
 * All text is live data, escaped here; nothing is a pre-rendered image.
 *
 * Size: CR80 (the standard plastic ID card), portrait, 54 × 85.6 mm. The
 * card is laid out at 6 px per mm (324 × 513.6 px) and zoomed to exact
 * millimetres for print.
 */
import { nameFontPx, rowValueFontPx, type IdCardKindName } from "./format";

export type IdCardIcon = "id" | "gift" | "briefcase" | "users" | "calendarCheck" | "cap" | "layers" | "calendar" | "phone" | "mail";

export type IdCardRow = { icon: IdCardIcon; label: string; value: string };

export type IdCardModel = {
  kind: IdCardKindName;
  name: string;
  photoUrl: string | null;
  /** Team: designation badge under the name. */
  badge: string | null;
  /** Student: the enrollment number pill under the name. */
  enrollmentNumber: string | null;
  rows: IdCardRow[];
  /** Student: internal test rank badge, only when a real rank exists. */
  rank: { title: string; value: string; sub: string | null } | null;
  verifyUrl: string;
  qrSvg: string;
  revoked: boolean;
};

export type RenderOptions = {
  mode: "screen" | "pdf";
  logoSrc: string;
  /** An approved signature image, when one is configured; otherwise the name is set in a script face. */
  signatureSrc?: string | null;
  signatoryName?: string;
};

const CARD_W = 324;
const CARD_H = 513.6;
const PX_PER_MM = 6;
// 1 CSS mm = 96 / 25.4 px; the card is drawn at 6 px per mm.
const PRINT_ZOOM = 96 / 25.4 / PX_PER_MM;

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const ICON_PATHS: Record<IdCardIcon, string> = {
  id: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M13 10h5M13 14h4"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  calendarCheck: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
  cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
};

/** Escaped text that may only wrap after "@" or "." (emails, long batch names) rather than mid-word. */
function breakable(s: string) {
  return escapeHtml(s).replace(/([@.])(?=\S)/g, "$1<wbr>");
}

function icon(name: IdCardIcon, cls = "ic") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Mrs+Saint+Delafield&display=block";

export function renderIdCardHtml(card: IdCardModel, opts: RenderOptions): string {
  const isStudent = card.kind === "STUDENT";
  const label = isStudent ? "STUDENT" : "TEAM MEMBER";
  const signatory = opts.signatoryName ?? "Firoz Ali";
  const rowBase = isStudent ? 8.2 : 9.4;
  const rowH = isStudent ? 15.6 : 19;
  const labelW = isStudent ? 70 : 72;
  const qrCol = isStudent ? 70 : 82;
  const qrSize = isStudent ? 64 : 72;

  const photo = card.photoUrl
    ? `<img src="${escapeHtml(card.photoUrl)}" alt="" />`
    : `<div class="nophoto">Photo pending</div>`;

  const rows = card.rows
    .map((r) => {
      const fs = rowValueFontPx(r.value, rowBase);
      return `<div class="row"><span class="ri">${icon(r.icon)}</span><span class="rl">${escapeHtml(r.label)}</span><span class="rc">:</span><span class="rv" style="font-size:${fs}px">${breakable(r.value)}</span></div>`;
    })
    .join("");

  const nameFs = nameFontPx(card.name);
  const badgeFs = card.badge && card.badge.length > 22 ? 8.4 : 9.6;

  const identity = isStudent
    ? `<div class="pill"><span class="pl">Enrollment No.</span><span class="pv">${escapeHtml(card.enrollmentNumber ?? "")}</span></div>`
    : card.badge
    ? `<div class="badge" style="font-size:${badgeFs}px">${icon("cap", "bi")}<span>${escapeHtml(card.badge)}</span></div>`
    : "";

  const rank = card.rank
    ? `<div class="abs rank" title="${escapeHtml(card.rank.sub ?? "")}">
        <svg class="rank-bg" viewBox="0 0 60 70" aria-hidden="true"><defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset=".55" stop-color="#fbbf24"/><stop offset="1" stop-color="#d97706"/></linearGradient></defs><path d="M30 1 57 9v24c0 17-11.5 29-27 36C14.5 62 3 50 3 33V9z" fill="url(#gold)" stroke="#fff7d6" stroke-width="1.6"/></svg>
        <div class="rank-in"><span class="rt">${escapeHtml(card.rank.title)}</span><span class="rn">${escapeHtml(card.rank.value)}</span>${card.rank.sub ? `<span class="rs">${escapeHtml(card.rank.sub)}</span>` : ""}</div>
      </div>`
    : "";

  const signature = opts.signatureSrc
    ? `<img class="sig-img" src="${escapeHtml(opts.signatureSrc)}" alt="" />`
    : `<div class="sig-script"><span>${escapeHtml(signatory)}</span><svg class="sig-flourish" viewBox="0 0 120 16" aria-hidden="true"><path d="M4 11 C 30 4, 62 15, 88 8 S 112 3, 117 6" fill="none" stroke="#13235c" stroke-width="1.3" stroke-linecap="round"/></svg></div>`;

  const pdf = opts.mode === "pdf";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=${CARD_W}" />
<title>Atomic Pathshala ID Card</title>
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${FONTS_HREF}" />
<style>
@page { size: 2.125in 3.37in; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: transparent; }
body { font-family: "Poppins", "Segoe UI", Arial, sans-serif; color: #0b1f4d; -webkit-print-color-adjust: exact; print-color-adjust: exact; -webkit-font-smoothing: antialiased; }
${pdf ? `html, body { width: 2.125in; height: 3.37in; overflow: hidden; background: #fff; } .card { zoom: ${PRINT_ZOOM.toFixed(6)}; border-radius: 0 !important; } .card * { box-shadow: none !important; filter: none !important; }` : ""}
.card { position: relative; width: ${CARD_W}px; height: ${CARD_H}px; overflow: hidden; background: #fff; border-radius: 18px; }
.abs { position: absolute; }
.head { left: 0; top: 0; width: ${CARD_W}px; height: 132px; }
.slot { left: ${CARD_W / 2 - 25}px; top: 8px; width: 50px; height: 10px; border-radius: 6px; background: #f1f5f9; box-shadow: inset 0 1.5px 2.5px rgba(2,6,23,.45); border: 1px solid rgba(255,255,255,.7); }
.logo { left: 16px; top: 28px; width: 60px; height: 60px; border-radius: 13px; background: #fff; padding: 2px; box-shadow: 0 3px 8px rgba(2,6,23,.3); }
.logo img { width: 56px; height: 56px; display: block; }
.divider { left: 86px; top: 34px; width: 1.5px; height: 48px; background: rgba(255,255,255,.55); }
.brand { left: 96px; top: 31px; right: 8px; color: #fff; }
.brand .bn { font-weight: 700; font-size: 20.5px; line-height: 1.15; letter-spacing: -.2px; white-space: nowrap; }
.brand .bt { margin-top: 4px; font-size: 10.6px; color: #d6e6ff; letter-spacing: .35px; white-space: nowrap; }
.side { left: 0; top: 150px; width: 25px; height: 176px; border-radius: 0 14px 14px 0; background: linear-gradient(180deg, #1650d0, #0a2463); box-shadow: 3px 0 0 #38bdf8; display: flex; align-items: center; justify-content: center; }
.side span { writing-mode: vertical-rl; transform: rotate(180deg); color: #fff; font-weight: 700; font-size: 10.8px; letter-spacing: 2.2px; white-space: nowrap; }
.photo { left: 38px; top: 140px; width: 106px; height: 132px; border-radius: 13px; padding: 3px; background: #fff; border: 2.5px solid #1d4ed8; box-shadow: 0 5px 12px rgba(15,58,158,.2); }
.photo img { width: 100%; height: 100%; object-fit: cover; border-radius: 9px; display: block; background: #e2e8f0; }
.nophoto { width: 100%; height: 100%; border-radius: 9px; background: repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 6px,#e2e8f0 6px,#e2e8f0 12px); color: #64748b; font-size: 9px; font-weight: 600; display: flex; align-items: center; justify-content: center; text-align: center; }
.who { left: 154px; right: 12px; top: ${isStudent && card.rank ? 196 : 146}px; height: ${isStudent && card.rank ? 80 : 126}px; display: flex; flex-direction: column; justify-content: center; }
.name { font-weight: 700; color: #0a1f5c; line-height: 1.12; letter-spacing: -.3px; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.bar { width: 38px; height: 3px; border-radius: 2px; background: #0a2463; margin: 5px 0 8px; }
.badge { display: inline-flex; align-items: center; gap: 5px; align-self: flex-start; max-width: 100%; padding: 4px 10px 4px 8px; border-radius: 999px; background: linear-gradient(135deg, #1d4ed8, #0f3a9e); color: #fff; font-weight: 600; line-height: 1.2; box-shadow: 0 2px 5px rgba(29,78,216,.3); }
.badge span { overflow-wrap: anywhere; }
.bi { width: 13px; height: 13px; flex: none; }
.pill { align-self: flex-start; max-width: 100%; display: flex; flex-direction: column; padding: 3px 9px 4px; border-radius: 8px; background: #dbeafe; border: 1px solid #bfdbfe; }
.pl { font-size: 7.4px; font-weight: 500; color: #1e3a8a; }
.pv { font-size: 11.6px; font-weight: 700; color: #0a1f5c; letter-spacing: .3px; line-height: 1.15; }
.rank { right: 12px; top: 120px; width: 62px; height: 72px; }
.rank-bg { position: absolute; inset: 0; width: 100%; height: 100%; filter: drop-shadow(0 2px 3px rgba(146,64,14,.35)); }
.rank-in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 6px 6px; color: #422006; text-align: center; }
.rt { font-size: 7.2px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; line-height: 1; }
.rn { font-size: ${card.rank && card.rank.value.length > 4 ? 13 : 16}px; font-weight: 800; line-height: 1.1; }
.rs { font-size: 6.6px; font-weight: 600; line-height: 1; }
.lower { left: 30px; right: 12px; top: ${isStudent ? 280 : 290}px; bottom: 22px; display: flex; flex-direction: column; justify-content: space-between; }
.info { display: grid; grid-template-columns: 1fr ${qrCol}px; column-gap: 8px; }
.rows { min-width: 0; }
.row { display: grid; grid-template-columns: 16px ${labelW}px 7px 1fr; align-items: center; min-height: ${rowH}px; padding: 1.5px 0; border-bottom: .7px solid #e2e8f0; }
.row:last-child { border-bottom: 0; }
.ri { color: #1d4ed8; display: flex; }
.ic { width: 11.5px; height: 11.5px; }
.rl { font-size: ${rowBase}px; font-weight: 600; color: #0b1f4d; white-space: nowrap; }
.rc { font-size: ${rowBase}px; font-weight: 600; color: #334155; }
.rv { font-weight: 500; color: #0f172a; line-height: 1.2; overflow-wrap: anywhere; min-width: 0; }
.qr { border-left: 1px solid #e2e8f0; padding-left: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.qr .q { width: ${qrSize}px; height: ${qrSize}px; background: #fff; }
.qr .q svg { width: 100%; height: 100%; display: block; }
.qr p { margin-top: 4px; font-size: 7.6px; font-weight: 600; color: #0b1f4d; text-align: center; line-height: 1.2; }
.sig { width: 132px; flex: none; text-align: center; color: #0a1f5c; }
.sig-script { position: relative; height: 34px; }
.sig-script span { position: absolute; left: 50%; top: 0; transform: translateX(-50%) rotate(-5deg); font-family: "Mrs Saint Delafield", "Segoe Script", cursive; font-size: 34px; line-height: 1; white-space: nowrap; color: #13235c; letter-spacing: .2px; }
.sig-flourish { position: absolute; left: 14px; right: 6px; bottom: 0; width: calc(100% - 20px); height: 12px; }
.sig-img { height: 34px; max-width: 128px; object-fit: contain; display: block; margin: -4px auto 0; }
.sig .line { height: 1.2px; background: #0a2463; margin: 2px 4px 3px; }
.sig .t1 { font-size: 8px; font-weight: 500; }
.foot { left: 0; bottom: 0; width: ${CARD_W}px; height: 96px; }
.mark { right: 16px; bottom: 13px; width: 38px; height: 38px; border-radius: 10px; background: #fff; padding: 2px; box-shadow: 0 2px 6px rgba(2,6,23,.3); }
.mark img { width: 34px; height: 34px; display: block; }
.revoked { inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.revoked span { transform: rotate(-28deg); border: 4px solid #dc2626; color: #dc2626; font-size: 40px; font-weight: 800; padding: 2px 14px; border-radius: 10px; background: rgba(255,255,255,.82); letter-spacing: 3px; }
</style></head>
<body>
<div class="card">
  <svg class="abs head" viewBox="0 0 ${CARD_W} 132" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a2463"/><stop offset=".6" stop-color="#0f3a9e"/><stop offset="1" stop-color="#1650d0"/></linearGradient></defs>
    <rect width="${CARD_W}" height="132" fill="url(#hg)"/>
    <path d="M140 0 C 205 34 268 34 ${CARD_W} 6 L${CARD_W} 0 Z" fill="#2563eb" opacity=".55"/>
    <path d="M205 0 C 250 22 292 22 ${CARD_W} 10 L${CARD_W} 0 Z" fill="#60a5fa" opacity=".45"/>
    <path d="M0 116 C 92 136 205 92 ${CARD_W} 100 L${CARD_W} 108 C 205 101 92 144 0 124 Z" fill="#38bdf8"/>
    <path d="M0 124 C 92 144 205 101 ${CARD_W} 108 L${CARD_W} 132 L0 132 Z" fill="#fff"/>
  </svg>
  ${pdf ? "" : '<div class="abs slot"></div>'}
  <div class="abs logo"><img src="${escapeHtml(opts.logoSrc)}" alt="Atomic Pathshala" /></div>
  <div class="abs divider"></div>
  <div class="abs brand"><div class="bn">Atomic Pathshala</div><div class="bt">Learn &nbsp;•&nbsp; Explore &nbsp;•&nbsp; Excel</div></div>
  <div class="abs side"><span>${label}</span></div>
  <div class="abs photo">${photo}</div>
  ${rank}
  <div class="abs who"><div class="name" style="font-size:${nameFs}px">${escapeHtml(card.name)}</div><div class="bar"></div>${identity}</div>
  <div class="abs lower">
    <div class="info"><div class="rows">${rows}</div><div class="qr"><div class="q">${card.qrSvg}</div><p>Scan to Verify<br/>Profile</p></div></div>
    <div class="sig">${signature}<div class="line"></div><div class="t1">Authorised Signatory</div></div>
  </div>
  <svg class="abs foot" viewBox="0 0 ${CARD_W} 96" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="fg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1650d0"/><stop offset="1" stop-color="#0a2463"/></linearGradient></defs>
    <path d="M150 96 C 215 78 270 62 ${CARD_W} 34 L${CARD_W} 96 Z" fill="#60a5fa" opacity=".5"/>
    <path d="M0 84 C 92 96 190 74 ${CARD_W} 16 L${CARD_W} 24 C 190 82 92 104 0 92 Z" fill="#38bdf8"/>
    <path d="M0 92 C 92 104 190 82 ${CARD_W} 24 L${CARD_W} 96 L0 96 Z" fill="url(#fg)"/>
  </svg>
  <div class="abs mark"><img src="${escapeHtml(opts.logoSrc)}" alt="" /></div>
  ${card.revoked ? '<div class="abs revoked"><span>REVOKED</span></div>' : ""}
</div>
<script>document.fonts && document.fonts.ready.then(function(){document.documentElement.classList.add("fonts-ready")});</script>
</body></html>`;
}
