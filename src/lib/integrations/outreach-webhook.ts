/**
 * Fire-and-forget callback to the outreach CRM once a lead-conversion
 * registration link (see lead-invite.ts) is actually completed — lets
 * the CRM flip that Lead to truly CONVERTED instead of guessing. Never
 * throws into the caller: a registration must succeed even if the CRM is
 * offline or misconfigured, so failures are just logged.
 */
export async function notifyOutreachConversion(email: string, enrollmentNumber: string) {
  const baseUrl = process.env.OUTREACH_APP_URL;
  const apiKey = process.env.OUTREACH_API_KEY;
  if (!baseUrl || !apiKey) return; // integration not configured — nothing to notify

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/webhooks/lms-conversion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ email, enrollmentNumber }),
    });
    if (!res.ok) {
      console.error("[outreach_webhook] non-OK response", res.status, await res.text());
    }
  } catch (error) {
    console.error("[outreach_webhook_error]", error);
  }
}
