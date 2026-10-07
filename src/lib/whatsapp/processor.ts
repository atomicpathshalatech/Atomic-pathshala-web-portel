import { prisma } from "@/lib/db";
import { parseMetaWhatsAppWebhook } from "./parser";
import { processInboundWhatsAppMessage } from "./inbound-service";
import { processWhatsAppStatusUpdate } from "./status-service";

export interface WebhookProcessResult {
  success: boolean;
  messagesProcessed: number;
  messagesSkipped: number;
  statusesProcessed: number;
  errors: string[];
}

/**
 * High-performance, idempotent WhatsApp webhook processor.
 * Processes incoming messages and delivery status updates safely.
 */
export async function processWhatsAppWebhookPayload(
  rawPayload: any
): Promise<WebhookProcessResult> {
  const parsed = parseMetaWhatsAppWebhook(rawPayload);

  const result: WebhookProcessResult = {
    success: true,
    messagesProcessed: 0,
    messagesSkipped: 0,
    statusesProcessed: 0,
    errors: [],
  };

  if (!parsed.isWhatsApp) {
    return result;
  }

  // 1. Process Messages with Strict Idempotency
  for (const msg of parsed.messages) {
    try {
      // Idempotency Check: check if wamId already recorded
      const existing = await prisma.whatsAppInboundMessage.findUnique({
        where: { wamId: msg.wamId },
        select: { id: true, wamId: true },
      });

      if (existing) {
        console.log(`[WHATSAPP_IDEMPOTENCY_SKIP] Duplicate message ignored: ${msg.wamId}`);
        result.messagesSkipped++;
        continue;
      }

      await processInboundWhatsAppMessage(msg);
      result.messagesProcessed++;

      console.log(
        `[WHATSAPP_INBOUND_INGESTED] MsgID: ${msg.wamId} | Type: ${msg.type} | Sender: ${msg.fromPhone.slice(0, 6)}****`
      );
    } catch (err: any) {
      console.error(`[WHATSAPP_INBOUND_ERROR] Failed on msg ${msg.wamId}:`, err?.message || err);
      result.errors.push(`Message ${msg.wamId}: ${err?.message || "Unknown error"}`);
    }
  }

  // 2. Process Status Updates
  for (const st of parsed.statuses) {
    try {
      await processWhatsAppStatusUpdate(st);
      result.statusesProcessed++;

      console.log(
        `[WHATSAPP_STATUS_UPDATE] MsgID: ${st.wamId} | Status: ${st.status} | Recipient: ${st.recipientPhone.slice(0, 6)}****`
      );
    } catch (err: any) {
      console.error(`[WHATSAPP_STATUS_ERROR] Failed on status ${st.wamId}:`, err?.message || err);
      result.errors.push(`Status ${st.wamId}: ${err?.message || "Unknown error"}`);
    }
  }

  return result;
}
