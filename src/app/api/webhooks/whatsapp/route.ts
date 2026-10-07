import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookToken, verifyMetaWebhookSignature } from "@/lib/whatsapp/security";
import { processWhatsAppWebhookPayload } from "@/lib/whatsapp/processor";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Meta WhatsApp Cloud API Webhook Endpoint
 * Webhook URL: https://atomicpathshala.in/api/webhooks/whatsapp
 *
 * GET:
 * Handles initial Webhook Verification Challenge from Meta Developers Console.
 * Required query parameters:
 *   - hub.mode: "subscribe"
 *   - hub.verify_token: Matches process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
 *   - hub.challenge: Challenge token to return as text/plain
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!mode || !token) {
    console.warn("[META_WEBHOOK_VERIFY_FAILED] Missing hub.mode or hub.verify_token");
    return new Response("Bad Request", { status: 400 });
  }

  const isValid = verifyWebhookToken(mode, token);

  if (isValid && challenge) {
    console.log("[META_WEBHOOK_VERIFY_SUCCESS] Webhook verified successfully by Meta.");
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[META_WEBHOOK_VERIFY_REJECTED] Verify token mismatch or invalid mode.");
  return new Response("Forbidden", { status: 403 });
}

/**
 * POST:
 * Handles real-time events from Meta WhatsApp Cloud API:
 *   - Inbound text, interactive buttons, list selections, and media messages
 *   - Delivery status receipts (sent, delivered, read, failed)
 *
 * Security:
 *   - Enforces HMAC SHA-256 signature verification via X-Hub-Signature-256
 *   - Idempotent processing preventing duplicate actions
 *   - Responds HTTP 200 immediately to avoid Meta delivery retries/timeouts
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  // 1. Verify Cryptographic Meta Signature
  const isSignatureValid = verifyMetaWebhookSignature(rawBody, signature);
  if (!isSignatureValid) {
    console.warn("[META_WEBHOOK_UNAUTHORIZED] Invalid X-Hub-Signature-256 header.");
    return NextResponse.json(
      { success: false, error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  // 2. Parse Raw Payload Safely
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("[META_WEBHOOK_MALFORMED_JSON]", err);
    return NextResponse.json(
      { success: false, error: "Malformed JSON payload" },
      { status: 400 }
    );
  }

  // 3. Process Webhook Event
  try {
    await processWhatsAppWebhookPayload(payload);
  } catch (err) {
    // Log error but still return HTTP 200 to Meta to prevent retry storms
    console.error("[META_WEBHOOK_DISPATCH_ERROR]", err);
  }

  // 4. Record Audit Log for Observability
  try {
    await prisma.auditLog.create({
      data: {
        action: "WHATSAPP_META_WEBHOOK_EVENT",
        entityType: "WhatsAppWebhook",
        metadata: {
          object: payload.object,
          entryCount: Array.isArray(payload.entry) ? payload.entry.length : 0,
        },
      },
    }).catch(() => null);
  } catch {}

  // Acknowledge receipt to Meta immediately with HTTP 200
  return NextResponse.json({ success: true, status: "EVENT_RECEIVED" });
}
