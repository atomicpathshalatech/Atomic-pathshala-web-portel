/**
 * ID-card emails (pure — no DB, unit-tested). Two kinds:
 *  - "card":    the card PDF is attached; a button opens the card page.
 *  - "nophoto": no card yet — "Your photo is missing" with a button straight
 *               to the photo upload on the card page. The card updates by
 *               itself the moment the photo is uploaded.
 */
import { escapeHtml } from "./render";

export type IdCardEmailMode = "card" | "nophoto";

export function idCardPagePath(kind: "STUDENT" | "TEAM", photo = false): string {
  return `${kind === "TEAM" ? "/team/id-card" : "/id-card"}${photo ? "#photo" : ""}`;
}

export function idCardEmail(opts: {
  mode: IdCardEmailMode;
  kind: "STUDENT" | "TEAM";
  name: string;
  baseUrl: string;
}): { subject: string; html: string; text: string } {
  const who = opts.kind === "TEAM" ? "Team" : "Student";
  const first = opts.name.trim().split(/\s+/)[0] || "there";
  const pageUrl = `${opts.baseUrl}${idCardPagePath(opts.kind)}`;
  const photoUrl = `${opts.baseUrl}${idCardPagePath(opts.kind, true)}`;
  const logo = `${opts.baseUrl}/brand/logo.png`;

  const button = (href: string, label: string) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;background:#0f3a9e;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px">${escapeHtml(label)}</a>`;

  const body =
    opts.mode === "card"
      ? `<p style="margin:0 0 14px">Your official <b>Atomic Pathshala ${who} ID Card</b> is attached to this email as a PDF.</p>
         <p style="margin:0 0 20px">Print it at <b>actual size (100%)</b> or keep it on your phone. Anyone can check that it is genuine by scanning its QR code.</p>
         <p style="margin:0 0 20px">${button(pageUrl, "View my ID card")}</p>
         <p style="margin:0;color:#64748b;font-size:13px">If you change your photo later, your ID card updates automatically — download the new one from the same page.</p>`
      : `<p style="margin:0 0 14px">Your <b>Atomic Pathshala ${who} ID Card</b> is ready — it only needs your photo.</p>
         <div style="margin:0 0 20px;padding:14px 16px;border-radius:10px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-weight:700">
           Your photo is missing. Kindly upload your photo and re-download your ID card.
         </div>
         <p style="margin:0 0 20px">${button(photoUrl, "Upload my photo")}</p>
         <p style="margin:0;color:#64748b;font-size:13px">Use a clear, front-facing photo (like a passport photo). As soon as you upload it, your ID card is updated automatically and you can download it from the same page.</p>`;

  const html = `<!doctype html><html><body style="margin:0;background:#eef4ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4ff;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0f3a9e;padding:18px 22px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td><img src="${escapeHtml(logo)}" width="44" height="44" alt="" style="display:block;border-radius:10px;background:#ffffff"/></td>
    <td style="padding-left:12px;color:#ffffff"><div style="font-size:19px;font-weight:700">Atomic Pathshala</div><div style="font-size:12px;color:#cfe0ff">Learn • Explore • Excel</div></td>
  </tr></table>
</td></tr>
<tr><td style="padding:24px 22px;font-size:15px;line-height:1.55">
  <p style="margin:0 0 14px">Dear ${escapeHtml(first)},</p>
  ${body}
</td></tr>
<tr><td style="padding:14px 22px;background:#f8fafc;color:#64748b;font-size:12px">Atomic Pathshala · This is an automated email about your ID card.</td></tr>
</table></td></tr></table></body></html>`;

  const text =
    opts.mode === "card"
      ? `Dear ${first},\n\nYour official Atomic Pathshala ${who} ID Card is attached (PDF). Print it at actual size or keep it on your phone.\n\nView your ID card: ${pageUrl}\n\nAtomic Pathshala`
      : `Dear ${first},\n\nYour photo is missing. Kindly upload your photo and re-download your ID card.\n\nUpload your photo: ${photoUrl}\n\nYour ID card updates automatically as soon as the photo is uploaded.\n\nAtomic Pathshala`;

  return {
    subject: opts.mode === "card" ? `Your Atomic Pathshala ${who} ID Card` : "Upload your photo to get your Atomic Pathshala ID Card",
    html,
    text,
  };
}

/**
 * The WhatsApp version. `params` fill an approved template's body
 * ({{1}} first name, {{2}} link); `text` is the plain message used when no
 * template is set up (WhatsApp only delivers that inside a 24-hour chat).
 */
export function idCardWhatsApp(opts: {
  mode: IdCardEmailMode;
  kind: "STUDENT" | "TEAM";
  name: string;
  baseUrl: string;
}): { text: string; params: Record<string, string> } {
  const who = opts.kind === "TEAM" ? "Team" : "Student";
  const first = opts.name.trim().split(/\s+/)[0] || "there";
  if (opts.mode === "card") {
    const link = `${opts.baseUrl}${idCardPagePath(opts.kind)}`;
    return {
      text: `Dear ${first}, your official Atomic Pathshala ${who} ID Card is attached. Print it at actual size or keep it on your phone.\nView your ID card: ${link}`,
      params: { "1": first, "2": link },
    };
  }
  const link = `${opts.baseUrl}${idCardPagePath(opts.kind, true)}`;
  return {
    text: `Dear ${first}, your photo is missing. Kindly upload your photo and re-download your ID card.\nUpload your photo: ${link}\nYour ID card updates automatically as soon as the photo is uploaded. — Atomic Pathshala`,
    params: { "1": first, "2": link },
  };
}
