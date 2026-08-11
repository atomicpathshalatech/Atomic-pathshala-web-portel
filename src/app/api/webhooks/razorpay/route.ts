import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { handleWebhookEvent } from "@/server/services/subscription-service";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Razorpay webhooks (configure in the Razorpay dashboard, pointing at
 * `<domain>/api/webhooks/razorpay`, subscribed to at least:
 * subscription.charged, subscription.cancelled, payment.failed).
 *
 * IMPORTANT: signature verification needs the raw, unparsed request body —
 * this route reads it as text first, verifies, and only THEN parses JSON.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 });
  }

  const payload = JSON.parse(rawBody);
  const event: string = payload.event;

  try {
    await handleWebhookEvent(event, payload.payload);
  } catch (error) {
    // Log and still 200 — Razorpay retries on non-2xx, and we don't want a
    // transient DB hiccup to trigger a retry storm. The event is recorded
    // in the audit log below regardless of outcome for manual follow-up.
    console.error("[razorpay_webhook_error]", event, error);
  }

  await prisma.auditLog.create({
    data: {
      action: `RAZORPAY_WEBHOOK_${event.toUpperCase()}`,
      entityType: "Subscription",
      metadata: payload.payload,
    },
  });

  return NextResponse.json({ success: true });
}
