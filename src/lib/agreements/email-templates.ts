import "server-only";

export function agreementInvitationEmail(params: {
  educatorName: string;
  agreementTitle: string;
  agreementNumber: string;
  reviewUrl: string;
  expiresAt: Date;
  supportEmail?: string;
}): { subject: string; html: string; text: string } {
  const expiryFormatted = params.expiresAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const subject = `Action Required: Electronic Signing of ${params.agreementTitle} (${params.agreementNumber})`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:580px;background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.05);" cellspacing="0" cellpadding="0">
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);padding:28px 32px;color:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display:inline-block;padding:4px 10px;background:rgba(255,255,255,0.2);border-radius:6px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#ffffff;">
                      Official Faculty Agreement
                    </span>
                    <h1 style="margin:10px 0 4px 0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.3;">
                      Atomic Pathshala
                    </h1>
                    <p style="margin:0;font-size:13px;color:#e0f2fe;">
                      Academic Operations &bull; Legal &amp; Compliance Division
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
                Dear <strong>${params.educatorName}</strong>,
              </p>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#334155;">
                Atomic Pathshala has issued your official <strong>${params.agreementTitle}</strong> (Ref: <code style="font-family:monospace;font-size:12px;background:#f1f5f9;padding:2px 6px;border-radius:4px;color:#0284c7;">${params.agreementNumber}</code>) for electronic review and signature.
              </p>

              <!-- Agreement Details Box -->
              <table role="presentation" width="100%" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;" cellspacing="0" cellpadding="14">
                <tr>
                  <td style="font-size:13px;color:#64748b;width:40%;">Agreement Title</td>
                  <td style="font-size:13px;font-weight:600;color:#0f172a;">${params.agreementTitle}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;">Reference Number</td>
                  <td style="font-size:13px;font-weight:600;color:#0284c7;font-family:monospace;border-top:1px solid #e2e8f0;">${params.agreementNumber}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;">Invitation Expiry</td>
                  <td style="font-size:13px;font-weight:600;color:#dc2626;border-top:1px solid #e2e8f0;">${expiryFormatted}</td>
                </tr>
              </table>

              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#334155;">
                Please click the button below to open our secure, encrypted signing portal. You can read the complete terms, inspect compensation and teaching hours, and record your electronic signature:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0;">
                <tr>
                  <td align="center">
                    <a href="${params.reviewUrl}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#0284c7;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px;box-shadow:0 4px 10px rgba(2,132,199,0.25);">
                      Review &amp; Sign Agreement &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;line-height:1.5;">
                If the button above does not work, copy and paste this secure link into your browser:
              </p>
              <p style="margin:0 0 24px 0;font-size:11px;color:#0284c7;word-break:break-all;font-family:monospace;">
                ${params.reviewUrl}
              </p>

              <div style="border-top:1px solid #f1f5f9;padding-top:16px;">
                <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;color:#475569;">
                  Important Security Notes:
                </p>
                <ul style="margin:0;padding-left:18px;font-size:12px;color:#64748b;line-height:1.6;">
                  <li>This invitation link is unique to you and cryptographically protected. Do not forward or share this link.</li>
                  <li>No administrative login or password is required.</li>
                  <li>Upon your electronic signature, the agreement will be submitted to the Founder &amp; Director for final execution.</li>
                  <li>Both parties will receive the final counter-signed PDF upon completion.</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;">
                &copy; ${new Date().getFullYear()} Atomic Pathshala Enterprise. All rights reserved.
              </p>
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                Knowledge Park III, Greater Noida, Uttar Pradesh - 201308 | Support: ${params.supportEmail || "agreements@atomicpathshala.in"}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `
Atomic Pathshala — Official Faculty Agreement
Action Required: Review & Sign Agreement

Dear ${params.educatorName},

Atomic Pathshala has issued your official agreement:
Title: ${params.agreementTitle}
Ref: ${params.agreementNumber}
Expires on: ${expiryFormatted}

Please open this secure link to review the full agreement and submit your electronic signature:
${params.reviewUrl}

This link is encrypted and intended solely for ${params.educatorName}.
After you sign, the Founder & Director will countersign, and both parties will receive the final executed PDF.

Support: ${params.supportEmail || "agreements@atomicpathshala.in"}
`;

  return { subject, html, text };
}

export function educatorSignedNotificationEmail(params: {
  educatorName: string;
  agreementTitle: string;
  agreementNumber: string;
  signedAt: Date;
  countersignUrl: string;
}): { subject: string; html: string; text: string } {
  const signedFormatted = params.signedAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const subject = `Countersignature Required: ${params.educatorName} Signed ${params.agreementTitle} (${params.agreementNumber})`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
    <h2 style="margin:0 0 8px 0;color:#0284c7;font-size:18px;">Educator Electronic Signature Recorded</h2>
    <p style="font-size:14px;color:#334155;margin:0 0 16px 0;">
      Educator <strong>${params.educatorName}</strong> has reviewed and electronically signed <strong>${params.agreementTitle}</strong> on <strong>${signedFormatted}</strong>.
    </p>
    <div style="background:#f1f5f9;border-radius:10px;padding:12px;font-size:13px;margin-bottom:20px;">
      <p style="margin:0 0 4px 0;"><strong>Agreement Ref:</strong> ${params.agreementNumber}</p>
      <p style="margin:0 0 4px 0;"><strong>Educator:</strong> ${params.educatorName}</p>
      <p style="margin:0;"><strong>Current Status:</strong> AWAITING DIRECTOR COUNTERSIGNATURE</p>
    </div>
    <p style="font-size:14px;color:#334155;margin:0 0 24px 0;">
      Please open the Admin Panel to inspect the educator's signature, timestamp, and audit trail, then complete the Director countersignature:
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${params.countersignUrl}" style="background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;display:inline-block;">
        Review &amp; Countersign Agreement &rarr;
      </a>
    </div>
  </div>
</body>
</html>`;

  const text = `
Educator ${params.educatorName} has signed ${params.agreementTitle} (${params.agreementNumber}) on ${signedFormatted}.
Status: AWAITING DIRECTOR COUNTERSIGNATURE.
Review and countersign at: ${params.countersignUrl}
`;

  return { subject, html, text };
}

export function agreementFullyExecutedEmail(params: {
  recipientName: string;
  agreementTitle: string;
  agreementNumber: string;
  effectiveDate: string;
  downloadUrl?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Your Atomic Pathshala Agreement Has Been Fully Executed (${params.agreementNumber})`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#0f172a;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:32px;box-shadow:0 4px 12px rgba(15,23,42,0.05);">
    <div style="display:inline-block;padding:4px 10px;background:#dcfce7;color:#166534;font-size:11px;font-weight:700;border-radius:6px;text-transform:uppercase;margin-bottom:12px;">
      Fully Executed &amp; Legally Binding
    </div>
    <h2 style="margin:0 0 12px 0;color:#0f172a;font-size:20px;">
      Agreement Successfully Executed
    </h2>
    <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 16px 0;">
      Dear <strong>${params.recipientName}</strong>,
    </p>
    <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 16px 0;">
      We are pleased to inform you that both parties (the Educator and Atomic Pathshala) have completed their electronic signatures for <strong>${params.agreementTitle}</strong> (Ref: <code style="font-family:monospace;font-size:12px;background:#f1f5f9;padding:2px 6px;border-radius:4px;color:#0284c7;">${params.agreementNumber}</code>).
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:20px 0;font-size:13px;">
      <p style="margin:0 0 6px 0;"><strong>Agreement:</strong> ${params.agreementTitle}</p>
      <p style="margin:0 0 6px 0;"><strong>Reference No:</strong> ${params.agreementNumber}</p>
      <p style="margin:0 0 6px 0;"><strong>Effective Date:</strong> ${params.effectiveDate}</p>
      <p style="margin:0;"><strong>Audit Status:</strong> Cryptographically Locked &amp; Verified</p>
    </div>
    <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 20px 0;">
      The official executed PDF (including verifiable digital signatures, e-stamp details, and complete audit trail) has been securely preserved in the official Atomic Pathshala Agreement Repository.
    </p>
    ${
      params.downloadUrl
        ? `
    <div style="text-align:center;margin:24px 0;">
      <a href="${params.downloadUrl}" target="_blank" style="background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;display:inline-block;">
        Download Executed PDF &rarr;
      </a>
    </div>`
        : ""
    }
    <p style="font-size:12px;color:#64748b;margin-top:24px;">
      Please preserve this executed copy for your professional and legal records. For any contractual inquiries, contact <a href="mailto:agreements@atomicpathshala.in" style="color:#0284c7;">agreements@atomicpathshala.in</a>.
    </p>
  </div>
</body>
</html>`;

  const text = `
Atomic Pathshala — Agreement Fully Executed
Title: ${params.agreementTitle}
Ref: ${params.agreementNumber}
Effective Date: ${params.effectiveDate}

Dear ${params.recipientName},
Both parties have completed their electronic signatures. The agreement is now fully executed and cryptographically locked.
${params.downloadUrl ? `Download executed PDF: ${params.downloadUrl}` : "A copy of the final agreement is attached."}

Support: agreements@atomicpathshala.in
`;

  return { subject, html, text };
}
