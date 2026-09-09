import "server-only";

/**
 * Minimal, dependency-free SMS. Sends via MSG91 (flow API) or Twilio if the
 * matching env vars are set; otherwise logs and returns `{ delivered:false }`.
 * No new npm package.
 *
 * Debug help for non-production: when `OTP_DEBUG_RETURN` is "1" AND
 * NODE_ENV !== "production", the OTP send route echoes the code in its JSON
 * response so the flow can be tested without a live SMS gateway. This is
 * force-disabled in production regardless of the env var.
 */
export function otpDebugReturnEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.OTP_DEBUG_RETURN === "1";
}

export async function sendSms(opts: { to: string; text: string }): Promise<{ delivered: boolean; reason?: string }> {
  const to = opts.to.replace(/\D/g, "");
  const e164 = to.length === 10 ? `91${to}` : to;

  // --- MSG91 -----------------------------------------------------------
  const msg91Key = process.env.MSG91_AUTHKEY;
  const msg91Sender = process.env.MSG91_SENDER_ID;
  if (msg91Key && msg91Sender) {
    try {
      const res = await fetch("https://control.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: { authkey: msg91Key, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: msg91Sender,
          short_url: "0",
          mobiles: e164,
          message: opts.text,
          route: "4",
        }),
      });
      if (!res.ok) return { delivered: false, reason: `MSG91_${res.status}` };
      return { delivered: true };
    } catch {
      return { delivered: false, reason: "MSG91_EXCEPTION" };
    }
  }

  // --- Twilio --------------------------------------------------------
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (sid && token && from) {
    try {
      const body = new URLSearchParams({ To: `+${e164}`, From: from, Body: opts.text });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      if (!res.ok) return { delivered: false, reason: `TWILIO_${res.status}` };
      return { delivered: true };
    } catch {
      return { delivered: false, reason: "TWILIO_EXCEPTION" };
    }
  }

  console.info(`[sms] not configured — would send to ${e164}: ${opts.text}`);
  return { delivered: false, reason: "SMS_NOT_CONFIGURED" };
}
