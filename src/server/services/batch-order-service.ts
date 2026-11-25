import "server-only";
import { prisma } from "@/lib/db";
import {
  createBatchOrder,
  verifyAndActivateOrder,
  reconcileOrderFromWebhook,
  enrollStudentInFreeBatch,
  CommerceOrderError,
} from "./commerce-order-service";
import type { BatchOrder } from "@prisma/client";
import type { GatewayProvider } from "@/lib/commerce/types";

export class BatchOrderError extends Error {}

/**
 * Backward-compatible wrapper around CommerceOrderService:
 * Creates the order and initiates gateway preparation. Supports optional coupon codes.
 */
export async function createBatchCheckout(
  studentId: string,
  batchId: string,
  couponCode?: string,
  gatewayProvider?: GatewayProvider
) {
  try {
    const result = await createBatchOrder({
      studentId,
      batchId,
      couponCode,
      gatewayProvider,
    });

    return {
      razorpayOrderId: result.gatewayOrderId,
      gatewayOrderId: result.gatewayOrderId,
      amount: result.amount,
      originalAmount: result.originalAmount,
      discountAmount: result.discountAmount,
      batchOrderId: result.orderId,
      orderNumber: result.orderNumber,
      isFree: result.isFree,
    };
  } catch (err: any) {
    if (err instanceof CommerceOrderError) {
      throw new BatchOrderError(err.message);
    }
    throw err;
  }
}

export type ActivationResult = {
  order: BatchOrder;
  alreadyProcessed: boolean;
  invoiceNumber?: string | null;
  orderNumber?: string | null;
};

/**
 * Confirms a batch purchase after client checkout verification.
 */
export async function verifyAndActivateBatchOrder(
  studentId: string,
  payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
): Promise<ActivationResult> {
  try {
    const res = await verifyAndActivateOrder({
      studentId,
      gatewayOrderId: payload.razorpay_order_id,
      gatewayPaymentId: payload.razorpay_payment_id,
      gatewaySignature: payload.razorpay_signature,
      provider: "RAZORPAY",
    });

    return {
      order: res.order,
      alreadyProcessed: res.alreadyProcessed,
      invoiceNumber: res.invoiceNumber,
      orderNumber: res.orderNumber,
    };
  } catch (err: any) {
    if (err instanceof CommerceOrderError) {
      throw new BatchOrderError(err.message);
    }
    throw err;
  }
}

/**
 * Webhook reconciliation backup for Razorpay payment.captured events.
 */
export async function reconcileBatchOrderFromWebhook(payload: any): Promise<ActivationResult | null> {
  const razorpayOrderId = payload?.payment?.entity?.order_id;
  const razorpayPaymentId = payload?.payment?.entity?.id;
  if (!razorpayOrderId || !razorpayPaymentId) return null;

  try {
    const res = await reconcileOrderFromWebhook({
      provider: "RAZORPAY",
      eventId: payload?.payment?.entity?.id || `RP_${Date.now()}`,
      eventType: "PAYMENT_SUCCESS",
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: razorpayPaymentId,
      rawPayload: payload,
    });

    if (!res) return null;

    return {
      order: res.order,
      alreadyProcessed: res.alreadyProcessed,
      invoiceNumber: res.invoiceNumber,
      orderNumber: res.orderNumber,
    };
  } catch {
    return null;
  }
}

/**
 * Free batch 1-click self-enrollment.
 */
export async function enrollInFreeBatch(studentId: string, batchIdentifier: string) {
  try {
    return await enrollStudentInFreeBatch(studentId, batchIdentifier);
  } catch (err: any) {
    if (err instanceof CommerceOrderError) {
      throw new BatchOrderError(err.message);
    }
    throw err;
  }
}

