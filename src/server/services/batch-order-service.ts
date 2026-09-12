import "server-only";
import { prisma } from "@/lib/db";
import { razorpay, verifyOrderPaymentSignature } from "@/lib/payments/razorpay";
import type { BatchOrder } from "@prisma/client";

export class BatchOrderError extends Error {}

/**
 * Creates the Razorpay order the client-side Checkout widget needs, and a
 * PENDING BatchOrder row keyed by that order id — mirrors
 * subscription-service.ts's createCheckout() for the one-time (Order)
 * case, but for an individual batch purchase instead of a platform plan.
 * The price always comes from Batch.price (the trusted DB source), never
 * from the client.
 */
export async function createBatchCheckout(studentId: string, batchId: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) throw new BatchOrderError("Batch not found.");
  if (batch.price == null) {
    throw new BatchOrderError("This batch is not available for individual purchase.");
  }

  const existingEnrollment = await prisma.batchEnrollment.findFirst({
    where: { studentId, batchId, status: "ACTIVE" },
  });
  if (existingEnrollment) {
    throw new BatchOrderError("You already have access to this batch.");
  }

  const amount = batch.price;
  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    notes: { studentId, batchId },
  });

  const batchOrder = await prisma.batchOrder.create({
    data: {
      studentId,
      batchId,
      amount,
      status: "PENDING",
      razorpayOrderId: order.id,
    },
  });

  return { razorpayOrderId: order.id, amount, batchOrderId: batchOrder.id };
}

type ActivationResult = { order: BatchOrder; alreadyProcessed: boolean };

/**
 * Race-safe activation shared by the client-verify route and the webhook
 * backup below. Only the caller that sees the order still PENDING actually
 * flips it and creates the enrollment — a concurrent retry (double-click,
 * webhook arriving alongside the client's own verify call) sees count:0
 * and just reports the already-activated state. Mirrors the reclaim
 * pattern already used by email dispatch idempotency
 * (src/lib/email/dispatch.ts's reclaimFailedLog) for the same "don't
 * double-process a concurrent retry" problem.
 */
async function activateBatchOrder(
  order: BatchOrder,
  razorpayPaymentId: string,
  razorpaySignature: string | null
): Promise<ActivationResult> {
  if (order.status === "SUCCESS") {
    return { order, alreadyProcessed: true };
  }

  const claim = await prisma.batchOrder.updateMany({
    where: { id: order.id, status: "PENDING" },
    data: {
      status: "SUCCESS",
      razorpayPaymentId,
      razorpaySignature: razorpaySignature ?? undefined,
    },
  });

  if (claim.count === 0) {
    const current = await prisma.batchOrder.findUnique({ where: { id: order.id } });
    return { order: current ?? order, alreadyProcessed: true };
  }

  await prisma.batchEnrollment.upsert({
    where: { batchId_studentId: { batchId: order.batchId, studentId: order.studentId } },
    create: { batchId: order.batchId, studentId: order.studentId, status: "ACTIVE" },
    update: { status: "ACTIVE", droppedAt: null },
  });

  try {
    const { recordActivity, syncCategoryToOutreach } = await import("@/lib/crm/lead-category");
    const category = await recordActivity({ studentId: order.studentId, type: "PAYMENT_SUCCESS" });
    await syncCategoryToOutreach(order.studentId, category);
  } catch (err) {
    console.error("Activity tracking error (batch order payment success):", err);
  }

  const updated = await prisma.batchOrder.findUnique({ where: { id: order.id } });
  return { order: updated ?? order, alreadyProcessed: false };
}

/**
 * Confirms a batch purchase after the client-side Razorpay Checkout success
 * callback. Verifies the signature server-side (never trusts the browser
 * redirect alone), re-fetches the order by its server-stored
 * razorpayOrderId (never trusts a client-supplied studentId/batchId/amount),
 * and only then activates it.
 */
export async function verifyAndActivateBatchOrder(
  studentId: string,
  payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
): Promise<ActivationResult> {
  const valid = verifyOrderPaymentSignature({
    orderId: payload.razorpay_order_id,
    paymentId: payload.razorpay_payment_id,
    signature: payload.razorpay_signature,
  });
  if (!valid) throw new BatchOrderError("Payment signature verification failed.");

  const order = await prisma.batchOrder.findUnique({
    where: { razorpayOrderId: payload.razorpay_order_id },
  });
  if (!order || order.studentId !== studentId) {
    throw new BatchOrderError("No matching order for this student.");
  }

  return activateBatchOrder(order, payload.razorpay_payment_id, payload.razorpay_signature);
}

/**
 * Webhook backup — `payment.captured` arrives independently of the
 * client-side verify call, covering the case where a student pays and
 * closes the tab before the browser gets to call /verify. The webhook
 * route already authenticates the whole payload via
 * verifyWebhookSignature() before this is ever called, so there's no
 * per-payment client signature to check here (unlike the client-verify
 * path above) — the order id is looked up straight from the payload.
 * A no-op (returns null) for any order id that isn't a BatchOrder's, so
 * this never interferes with Subscription's own webhook handling.
 */
export async function reconcileBatchOrderFromWebhook(payload: any): Promise<ActivationResult | null> {
  const razorpayOrderId = payload?.payment?.entity?.order_id;
  const razorpayPaymentId = payload?.payment?.entity?.id;
  if (!razorpayOrderId || !razorpayPaymentId) return null;

  const order = await prisma.batchOrder.findUnique({ where: { razorpayOrderId } });
  if (!order) return null;

  return activateBatchOrder(order, razorpayPaymentId, null);
}
