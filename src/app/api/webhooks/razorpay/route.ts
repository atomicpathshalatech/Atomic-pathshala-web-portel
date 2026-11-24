import { NextRequest, NextResponse } from "next/server";
import { processGatewayWebhook } from "@/lib/commerce/webhook-service";

export const runtime = "nodejs";

/**
 * Razorpay Webhook Handler
 * Reads raw unparsed body for signature check, enforces idempotency via WebhookEvent table,
 * and updates orders and subscriptions.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  const result = await processGatewayWebhook("RAZORPAY", rawBody, signature, {
    signature,
  });

  if (!result.success && result.statusCode === 400) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  // Gateway webhooks expect 200 OK so retries aren't flooded for application-level handling
  return NextResponse.json({
    success: result.success,
    duplicate: result.duplicate,
  });
}
