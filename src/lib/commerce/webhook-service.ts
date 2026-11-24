import "server-only";
import { prisma } from "@/lib/db";
import { paymentRegistry } from "./payment-provider";
import type { GatewayProvider, WebhookNormalizedEvent } from "./types";
import { reconcileOrderFromWebhook } from "@/server/services/commerce-order-service";
import { handleWebhookEvent as handleSubscriptionWebhook } from "@/server/services/subscription-service";

export type WebhookProcessResult = {
  success: boolean;
  duplicate?: boolean;
  error?: string;
  statusCode: number;
};

/**
 * Universal, gateway-agnostic webhook processor with strict idempotency and event storage:
 * 1. Resolves adapter and verifies cryptographic signature on the raw request body.
 * 2. Parses normalized event.
 * 3. Enforces idempotency via the `WebhookEvent` table (`provider` + `eventId` unique key).
 * 4. Dispatches to commerce order reconciliation and subscription handlers.
 * 5. Records event outcome and logs to AuditLog.
 */
export async function processGatewayWebhook(
  provider: GatewayProvider,
  rawBody: string,
  signature: string | null,
  headers: Record<string, any> = {}
): Promise<WebhookProcessResult> {
  const adapter = paymentRegistry.getAdapter(provider);

  // 1. Signature Verification
  if (!signature || !adapter.verifyWebhookSignature(rawBody, signature, headers)) {
    console.warn(`[webhook] Signature verification failed for provider: ${provider}`);
    return {
      success: false,
      error: "Invalid webhook signature",
      statusCode: 400,
    };
  }

  // 2. Event Normalization
  const normalizedEvent: WebhookNormalizedEvent | null = adapter.parseWebhookEvent(rawBody, headers);
  if (!normalizedEvent) {
    return {
      success: false,
      error: "Unable to parse webhook payload",
      statusCode: 400,
    };
  }

  const { eventId, eventType } = normalizedEvent;

  // 3. Idempotency Check & Event Claim
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: {
      provider_eventId: {
        provider,
        eventId,
      },
    },
  });

  if (existingEvent) {
    if (existingEvent.status === "PROCESSED") {
      console.info(`[webhook] Idempotency: Event ${eventId} from ${provider} was already processed. Skipping.`);
      return {
        success: true,
        duplicate: true,
        statusCode: 200,
      };
    }
  } else {
    // Record the newly arrived event in PENDING state
    try {
      await prisma.webhookEvent.create({
        data: {
          provider,
          eventId,
          eventType,
          payload: normalizedEvent.rawPayload,
          status: "PENDING",
        },
      });
    } catch (insertErr) {
      // Race condition: another thread inserted the same event simultaneously
      console.warn(`[webhook] Concurrent event arrival for ${eventId}:`, insertErr);
      return {
        success: true,
        duplicate: true,
        statusCode: 200,
      };
    }
  }

  // 4. Dispatch Processing
  try {
    // If it's a batch order event, reconcile batch orders
    if (normalizedEvent.gatewayOrderId) {
      await reconcileOrderFromWebhook(normalizedEvent);
    }

    // If it's a subscription event (for Razorpay recurring subscriptions)
    if (provider === "RAZORPAY") {
      const rawEvent = normalizedEvent.rawPayload?.event;
      if (rawEvent) {
        await handleSubscriptionWebhook(rawEvent, normalizedEvent.rawPayload?.payload);
      }
    }

    // 5. Mark as PROCESSED
    await prisma.webhookEvent.update({
      where: {
        provider_eventId: {
          provider,
          eventId,
        },
      },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: `WEBHOOK_PROCESSED_${provider}_${eventType}`,
        entityType: "WebhookEvent",
        entityId: eventId,
        metadata: {
          provider,
          eventType,
          orderId: normalizedEvent.gatewayOrderId,
        },
      },
    });

    return {
      success: true,
      statusCode: 200,
    };
  } catch (processError: any) {
    console.error(`[webhook] Error processing event ${eventId}:`, processError);

    await prisma.webhookEvent.update({
      where: {
        provider_eventId: {
          provider,
          eventId,
        },
      },
      data: {
        status: "FAILED",
        errorMessage: processError?.message || "Internal processing error",
      },
    });

    return {
      success: false,
      error: "Webhook processing encountered an error",
      statusCode: 500,
    };
  }
}
