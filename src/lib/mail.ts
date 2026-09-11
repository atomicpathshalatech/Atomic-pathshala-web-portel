import "server-only";

/**
 * Minimal, dependency-free transactional mail. If `RESEND_API_KEY` (+
 * `MAIL_FROM`) is set it sends via Resend's HTTP API; otherwise it logs and
 * returns `{ delivered: false }` so the caller can fall back to showing the
 * link in the admin UI. No new npm package, no SMTP client.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ delivered: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "Atomic Pathshala <noreply@atomicpathshala.in>";

  if (!key) {
    console.warn(
      `[mail] RESEND_API_KEY is not set — "${opts.subject}" to ${opts.to} was NOT sent. ` +
        `Set RESEND_API_KEY (and MAIL_FROM with a Resend-verified sender) to enable email.`
    );
    return { delivered: false, reason: "MAIL_NOT_CONFIGURED" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[mail] Resend rejected "${opts.subject}" to ${opts.to} (from ${from}) — ` +
          `HTTP ${res.status}: ${body}. A 403 here usually means the MAIL_FROM domain ` +
          `is not verified in Resend.`
      );
      return { delivered: false, reason: `HTTP_${res.status}` };
    }
    return { delivered: true };
  } catch (e) {
    console.error("[mail] send threw:", e);
    return { delivered: false, reason: "EXCEPTION" };
  }
}

export function staffInviteEmailHtml(params: {
  inviteUrl: string;
  invitedByName: string;
  expiresAt: Date;
}): string {
  const exp = params.expiresAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 4px">You're invited to join Atomic Pathshala</h2>
    <p style="color:#475569;margin:0 0 16px">
      ${params.invitedByName} has invited you to create your staff profile on Atomic Pathshala.
    </p>
    <p style="margin:0 0 16px">
      Click below to set up your profile. You'll add your details and set a password —
      an administrator then approves your account before you get access.
    </p>
    <p style="margin:0 0 20px">
      <a href="${params.inviteUrl}"
         style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:10px">
        Accept invitation
      </a>
    </p>
    <p style="color:#64748b;font-size:13px;margin:0 0 4px">
      This link expires on <b>${exp}</b> and can only be used once.
    </p>
    <p style="color:#64748b;font-size:13px;margin:0">
      Didn't expect this? You can ignore this email, or contact your Founder,
      Coordinator, or Administrator.
    </p>
  </div>`;
}

/** Password-reset email body (email-link flow). */
export function passwordResetEmailHtml(params: {
  resetUrl: string;
  name?: string | null;
  expiresInMinutes: number;
}): string {
  const hi = params.name ? ` ${params.name}` : "";
  return `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 4px">Reset your Atomic Pathshala password</h2>
    <p style="color:#475569;margin:0 0 16px">
      Hi${hi}, we received a request to reset the password for your account.
    </p>
    <p style="margin:0 0 20px">
      <a href="${params.resetUrl}"
         style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:10px">
        Reset password
      </a>
    </p>
    <p style="color:#64748b;font-size:13px;margin:0 0 4px">
      This link expires in <b>${params.expiresInMinutes} minutes</b> and can be used once.
    </p>
    <p style="color:#64748b;font-size:13px;margin:0">
      Didn't request this? You can safely ignore this email — your password won't change.
    </p>
  </div>`;
}

export function passwordResetEmailText(resetUrl: string, expiresInMinutes: number): string {
  return `Reset your Atomic Pathshala password.

Open this link to choose a new password (expires in ${expiresInMinutes} minutes, single use):
${resetUrl}

If you didn't request this, ignore this email — nothing will change.`;
}
