import "server-only";
import { prisma } from "@/lib/db";
import { paymentRegistry } from "@/lib/commerce/payment-provider";
import type { GatewayProvider, WebhookNormalizedEvent } from "@/lib/commerce/types";
import { notifyEnrollment } from "@/lib/email/enrollment";
import type { BatchOrder, BatchOrderStatus, Coupon, CouponType } from "@prisma/client";

export class CommerceOrderError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "CommerceOrderError";
  }
}

/**
 * Generates sequential, gapless-per-year order numbers: ORD-YYYY-000001
 */
export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const count = await prisma.batchOrder.count({
    where: { createdAt: { gte: yearStart, lt: yearEnd } },
  });
  return `ORD-${year}-${String(count + 1).padStart(6, "0")}`;
}

/**
 * Generates sequential, gapless-per-year receipt/invoice numbers: INV-YYYY-000001
 */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const count = await prisma.batchOrder.count({
    where: { invoiceNumber: { not: null }, createdAt: { gte: yearStart, lt: yearEnd } },
  });
  return `INV-${year}-${String(count + 1).padStart(6, "0")}`;
}

/**
 * Pure calculation for coupon discounts:
 * PERCENT: 0-100%, optionally capped by maxDiscountAmount
 * FLAT: rupee discount, capped to order amount
 */
export function calculateCouponDiscount(
  coupon: { type: CouponType; value: number; maxDiscountAmount?: number | null },
  baseAmount: number
): { discountAmount: number; finalPayable: number } {
  if (baseAmount <= 0) return { discountAmount: 0, finalPayable: 0 };

  let rawDiscount = 0;
  if (coupon.type === "PERCENT") {
    rawDiscount = (baseAmount * coupon.value) / 100;
    if (coupon.maxDiscountAmount != null && coupon.maxDiscountAmount > 0) {
      rawDiscount = Math.min(rawDiscount, coupon.maxDiscountAmount);
    }
  } else {
    rawDiscount = coupon.value;
  }

  // Ensure discount doesn't exceed base amount and final payable is non-negative
  const discountAmount = Math.min(baseAmount, Math.round(rawDiscount * 100) / 100);
  const finalPayable = Math.max(0, Math.round((baseAmount - discountAmount) * 100) / 100);

  return { discountAmount, finalPayable };
}

/**
 * Server-side coupon validator for batch checkouts.
 */
export async function validateBatchCoupon(
  code: string,
  batchId: string,
  baseAmount: number,
  studentId: string
): Promise<{ coupon: Coupon; discountAmount: number; finalPayable: number }> {
  const cleanCode = code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({
    where: { code: cleanCode },
  });

  if (!coupon || !coupon.isActive) {
    throw new CommerceOrderError("Coupon code is invalid or inactive.", "INVALID_COUPON");
  }

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new CommerceOrderError("This coupon code has expired.", "EXPIRED_COUPON");
  }

  if (coupon.batchId && coupon.batchId !== batchId) {
    throw new CommerceOrderError("This coupon is not valid for this batch.", "BATCH_MISMATCH");
  }

  if (coupon.minOrderValue != null && baseAmount < coupon.minOrderValue) {
    throw new CommerceOrderError(
      `Minimum order value of ₹${coupon.minOrderValue.toLocaleString("en-IN")} required for this coupon.`,
      "MIN_ORDER_VALUE_NOT_MET"
    );
  }

  if (coupon.maxRedemptions != null && coupon.redeemedCount >= coupon.maxRedemptions) {
    throw new CommerceOrderError("This coupon has reached its maximum redemption limit.", "MAX_REDEMPTIONS_REACHED");
  }

  // Check if student has already used this coupon
  const alreadyUsed = await prisma.couponUsage.findFirst({
    where: { couponId: coupon.id, studentId },
  });
  if (alreadyUsed) {
    throw new CommerceOrderError("You have already used this coupon code.", "ALREADY_REDEEMED");
  }

  const { discountAmount, finalPayable } = calculateCouponDiscount(coupon, baseAmount);

  return { coupon, discountAmount, finalPayable };
}

export type CreateOrderInput = {
  studentId: string;
  batchId: string;
  couponCode?: string;
  gatewayProvider?: GatewayProvider;
};

/**
 * Main order creation entrypoint:
 * 1. Resolves batch and pricing server-side from PostgreSQL (tamper-proof).
 * 2. Checks active entitlements (avoids duplicate purchasing).
 * 3. Applies coupon if supplied (validates and calculates discount).
 * 4. Determines whether order is Free (₹0) or Paid.
 * 5. Creates DB BatchOrder & PaymentRecord in PENDING state.
 * 6. Invokes Gateway Adapter to create gateway-level order.
 * 7. Returns client checkout parameters.
 */
export async function createBatchOrder(input: CreateOrderInput) {
  const batch = await prisma.batch.findFirst({
    where: { OR: [{ id: input.batchId }, { code: input.batchId }] },
    select: {
      id: true,
      name: true,
      code: true,
      price: true,
      originalPrice: true,
      isPurchasable: true,
    },
  });

  if (!batch) {
    throw new CommerceOrderError("Batch not found.", "BATCH_NOT_FOUND");
  }

  if (batch.isPurchasable === false || batch.price == null) {
    throw new CommerceOrderError("This batch is not currently available for enrollment/purchase.", "NOT_PURCHASABLE");
  }

  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
  });

  if (!student) {
    throw new CommerceOrderError("Student profile not found.", "STUDENT_NOT_FOUND");
  }

  // Check existing active access
  const { resolveBatchAccess } = await import("@/lib/batch/entitlement");
  const access = await resolveBatchAccess(student.userId, batch.id);
  if (
    access.status === "ACTIVE_ENROLLMENT" ||
    access.status === "ACTIVE_SUBSCRIPTION" ||
    access.status === "ADMIN_GRANTED"
  ) {
    throw new CommerceOrderError("You already have active access to this batch.", "ALREADY_ENROLLED");
  }

  const basePrice = batch.price;
  let finalAmount = basePrice;
  let discountAmount = 0;
  let appliedCouponId: string | null = null;
  let appliedCouponCode: string | null = null;

  if (input.couponCode) {
    const couponRes = await validateBatchCoupon(input.couponCode, batch.id, basePrice, student.id);
    finalAmount = couponRes.finalPayable;
    discountAmount = couponRes.discountAmount;
    appliedCouponId = couponRes.coupon.id;
    appliedCouponCode = couponRes.coupon.code;
  }

  // Provider resolution: If finalAmount is 0, automatic FREE provider
  const selectedProvider: GatewayProvider =
    finalAmount === 0 ? "FREE" : input.gatewayProvider || paymentRegistry.getDefaultProvider();

  const adapter = paymentRegistry.getAdapter(selectedProvider);
  if (!adapter.isConfigured()) {
    throw new CommerceOrderError(
      `Payment gateway [${selectedProvider}] is currently unavailable. Please contact support.`,
      "GATEWAY_UNAVAILABLE"
    );
  }

  const orderNumber = await generateOrderNumber();

  // Create internal BatchOrder and PaymentRecord
  const batchOrder = await prisma.batchOrder.create({
    data: {
      orderNumber,
      studentId: student.id,
      batchId: batch.id,
      originalAmount: basePrice,
      discountAmount,
      amount: finalAmount,
      currency: "INR",
      status: "PENDING",
      couponId: appliedCouponId,
      gatewayProvider: selectedProvider,
    },
  });

  const paymentRecord = await prisma.paymentRecord.create({
    data: {
      orderId: batchOrder.id,
      amount: finalAmount,
      currency: "INR",
      gatewayProvider: selectedProvider,
      status: "PENDING",
    },
  });

  // Call gateway adapter to initialize gateway order
  const gatewayOrder = await adapter.createOrder({
    orderId: batchOrder.id,
    orderNumber,
    amount: finalAmount,
    currency: "INR",
    customer: {
      id: student.id,
      userId: student.userId,
      name: student.user.name,
      email: student.user.email,
      phone: student.user.phone,
    },
    notes: {
      batchId: batch.id,
      batchName: batch.name,
      couponCode: appliedCouponCode || "",
    },
  });

  // Save gateway references
  await prisma.$transaction([
    prisma.batchOrder.update({
      where: { id: batchOrder.id },
      data: {
        gatewayOrderId: gatewayOrder.gatewayOrderId,
        razorpayOrderId: selectedProvider === "RAZORPAY" ? gatewayOrder.gatewayOrderId : undefined,
      },
    }),
    prisma.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: {
        gatewayOrderId: gatewayOrder.gatewayOrderId,
      },
    }),
  ]);

  return {
    orderId: batchOrder.id,
    orderNumber,
    batchId: batch.id,
    batchName: batch.name,
    originalAmount: basePrice,
    discountAmount,
    amount: finalAmount,
    currency: "INR",
    gatewayProvider: selectedProvider,
    gatewayOrderId: gatewayOrder.gatewayOrderId,
    keyId: gatewayOrder.keyId,
    clientPayload: gatewayOrder.clientPayload,
    isFree: finalAmount === 0,
  };
}

export type VerifyPaymentInput = {
  studentId: string;
  orderId?: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature?: string;
  provider?: GatewayProvider;
};

/**
 * Verifies payment confirmation and activates student enrollment:
 * 1. Locates order and ensures ownership matches authenticated student.
 * 2. Invokes Payment Gateway Adapter to cryptographically verify signature/status.
 * 3. Race-safe atomic transition using optimistic lock: checks status === PENDING.
 * 4. Assigns invoice number.
 * 5. Bumps coupon redemption count and records CouponUsage.
 * 6. Upserts BatchEnrollment with ACTIVE status and links orderId.
 * 7. Dispatches email enrollment notification and in-app notification.
 */
export async function verifyAndActivateOrder(input: VerifyPaymentInput) {
  // Find order by internal ID or by gateway order ID
  const order = await prisma.batchOrder.findFirst({
    where: {
      OR: [
        ...(input.orderId ? [{ id: input.orderId }] : []),
        { gatewayOrderId: input.gatewayOrderId },
        { razorpayOrderId: input.gatewayOrderId },
      ],
    },
    include: {
      batch: { select: { id: true, name: true, code: true } },
      student: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  if (!order) {
    throw new CommerceOrderError("Order not found.", "ORDER_NOT_FOUND");
  }

  if (order.studentId !== input.studentId) {
    throw new CommerceOrderError("Unauthorized: This order belongs to another student.", "FORBIDDEN");
  }

  if (order.status === "SUCCESS") {
    return {
      order,
      alreadyProcessed: true,
      invoiceNumber: order.invoiceNumber,
      orderNumber: order.orderNumber,
    };
  }

  const provider: GatewayProvider =
    (order.gatewayProvider as GatewayProvider) || input.provider || paymentRegistry.getDefaultProvider();
  const adapter = paymentRegistry.getAdapter(provider);

  const verification = await adapter.verifyPayment({
    orderId: order.id,
    gatewayOrderId: input.gatewayOrderId,
    gatewayPaymentId: input.gatewayPaymentId,
    gatewaySignature: input.gatewaySignature,
  });

  if (!verification.success) {
    await prisma.$transaction([
      prisma.batchOrder.update({
        where: { id: order.id },
        data: {
          failureReason: verification.failureReason || "Payment verification failed",
        },
      }),
      prisma.paymentRecord.updateMany({
        where: { orderId: order.id, status: "PENDING" },
        data: {
          status: "FAILED",
          gatewayPaymentId: input.gatewayPaymentId,
          failureReason: verification.failureReason,
        },
      }),
    ]);
    throw new CommerceOrderError(
      verification.failureReason || "Payment verification failed.",
      "VERIFICATION_FAILED"
    );
  }

  // Atomic state transition
  const invoiceNumber = await generateInvoiceNumber();

  const claim = await prisma.batchOrder.updateMany({
    where: { id: order.id, status: "PENDING" },
    data: {
      status: "SUCCESS",
      invoiceNumber,
      razorpayPaymentId: provider === "RAZORPAY" ? input.gatewayPaymentId : undefined,
      razorpaySignature: provider === "RAZORPAY" ? input.gatewaySignature : undefined,
    },
  });

  if (claim.count === 0) {
    const current = await prisma.batchOrder.findUnique({ where: { id: order.id } });
    return {
      order: current || order,
      alreadyProcessed: true,
      invoiceNumber: current?.invoiceNumber,
      orderNumber: current?.orderNumber,
    };
  }

  // Update payment record to SUCCESS
  await prisma.paymentRecord.updateMany({
    where: { orderId: order.id },
    data: {
      status: "SUCCESS",
      gatewayPaymentId: input.gatewayPaymentId,
      gatewaySignature: input.gatewaySignature,
      completedAt: new Date(),
    },
  });

  // Record coupon usage if coupon was applied
  if (order.couponId) {
    try {
      await prisma.$transaction([
        prisma.coupon.update({
          where: { id: order.couponId },
          data: { redeemedCount: { increment: 1 } },
        }),
        prisma.couponUsage.create({
          data: {
            couponId: order.couponId,
            studentId: order.studentId,
            orderId: order.id,
          },
        }),
      ]);
    } catch (couponErr) {
      console.error("[commerce] Error recording coupon usage:", couponErr);
    }
  }

  // Provision Batch Enrollment
  const enrollment = await prisma.batchEnrollment.upsert({
    where: {
      batchId_studentId: {
        batchId: order.batchId,
        studentId: order.studentId,
      },
    },
    create: {
      batchId: order.batchId,
      studentId: order.studentId,
      status: "ACTIVE",
      orderId: order.id,
    },
    update: {
      status: "ACTIVE",
      droppedAt: null,
      orderId: order.id,
    },
  });

  // Dispatch Welcome & Enrollment Notification Email
  try {
    await notifyEnrollment({
      idempotencyKey: `order_enrollment:${order.id}`,
      kind: "BATCH",
      studentUserId: order.student.userId,
      studentName: order.student.user.name,
      studentEmail: order.student.user.email,
      productName: order.batch.name,
    });
  } catch (emailErr) {
    console.error("[commerce] Failed to dispatch enrollment notification email:", emailErr);
  }

  // Dispatch In-App Notification
  try {
    await prisma.notification.create({
      data: {
        userId: order.student.userId,
        title: "Enrollment Activated! 🎉",
        body: `Your enrollment in ${order.batch.name} is now active. Receipt: ${invoiceNumber}`,
        type: "GENERAL",
        category: "SYSTEM",
        channel: "IN_APP",
        deepLink: `/courses/${order.batch.id}`,
        idempotencyKey: `notif_order_${order.id}`,
      },
    });
  } catch (notifErr) {
    console.error("[commerce] In-app notification creation error:", notifErr);
  }

  // Update CRM Lead Category
  try {
    const { recordActivity, syncCategoryToOutreach } = await import("@/lib/crm/lead-category");
    const category = await recordActivity({ studentId: order.studentId, type: "PAYMENT_SUCCESS" });
    await syncCategoryToOutreach(order.studentId, category);
  } catch (crmErr) {
    console.error("[commerce] CRM activity logging error:", crmErr);
  }

  const updatedOrder = await prisma.batchOrder.findUnique({
    where: { id: order.id },
    include: { batch: true },
  });

  return {
    order: updatedOrder || order,
    alreadyProcessed: false,
    invoiceNumber,
    orderNumber: order.orderNumber,
    enrollmentId: enrollment.id,
  };
}

/**
 * Reconciles webhook events idempotently:
 * Called by webhook handlers when payment.captured or order.paid arrives.
 */
export async function reconcileOrderFromWebhook(event: WebhookNormalizedEvent) {
  if (!event.gatewayOrderId) return null;

  const order = await prisma.batchOrder.findFirst({
    where: {
      OR: [
        { gatewayOrderId: event.gatewayOrderId },
        { razorpayOrderId: event.gatewayOrderId },
      ],
    },
  });

  if (!order) return null;

  if (event.eventType === "PAYMENT_SUCCESS") {
    return verifyAndActivateOrder({
      studentId: order.studentId,
      orderId: order.id,
      gatewayOrderId: event.gatewayOrderId,
      gatewayPaymentId: event.gatewayPaymentId || `WH_PAY_${Date.now()}`,
      provider: event.provider,
    });
  }

  if (event.eventType === "PAYMENT_FAILED") {
    await prisma.batchOrder.update({
      where: { id: order.id },
      data: {
        status: "FAILED",
        failureReason: "Payment failed according to gateway webhook event",
      },
    });
  }

  return null;
}

export type RecordRefundInput = {
  orderId: string;
  amount: number;
  reason?: string;
  processedById: string;
  revokeAccess?: boolean;
};

/**
 * Processes refund on a Batch Order:
 * 1. Checks that order was successful.
 * 2. Checks refundable balance (amount - prior successful refunds).
 * 3. Dispatches refund via Gateway Adapter if paid online, or manual offline record.
 * 4. Records BatchRefund.
 * 5. Updates BatchOrder status to REFUNDED or PARTIALLY_REFUNDED.
 * 6. If access revocation requested, drops BatchEnrollment.
 */
export async function recordBatchOrderRefund(input: RecordRefundInput) {
  const order = await prisma.batchOrder.findUnique({
    where: { id: input.orderId },
    include: {
      refunds: true,
      paymentRecords: { where: { status: "SUCCESS" } },
      batch: true,
      student: { include: { user: true } },
    },
  });

  if (!order) throw new CommerceOrderError("Order not found.", "ORDER_NOT_FOUND");
  if (order.status !== "SUCCESS") {
    throw new CommerceOrderError("Only successfully paid orders can be refunded.", "INVALID_ORDER_STATUS");
  }

  const priorRefunded = order.refunds
    .filter((r) => r.status === "SUCCESS")
    .reduce((sum, r) => sum + r.amount, 0);

  const refundable = order.amount - priorRefunded;
  if (input.amount <= 0 || input.amount > refundable) {
    throw new CommerceOrderError(
      `Refund amount of ₹${input.amount} exceeds refundable balance of ₹${refundable}.`,
      "INVALID_REFUND_AMOUNT"
    );
  }

  const latestPayment = order.paymentRecords[0];
  const provider = (order.gatewayProvider as GatewayProvider) || "OFFLINE";
  const adapter = paymentRegistry.getAdapter(provider);

  let gatewayRefundId: string | undefined;
  if (provider !== "OFFLINE" && provider !== "FREE" && latestPayment?.gatewayPaymentId) {
    const refundResult = await adapter.initiateRefund({
      paymentRecordId: latestPayment.id,
      gatewayPaymentId: latestPayment.gatewayPaymentId,
      amount: input.amount,
      currency: order.currency,
      reason: input.reason,
    });
    gatewayRefundId = refundResult.gatewayRefundId;
  }

  const isFullRefund = input.amount >= refundable;
  const newOrderStatus: BatchOrderStatus = isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";

  const [refund] = await prisma.$transaction([
    prisma.batchRefund.create({
      data: {
        orderId: order.id,
        paymentRecordId: latestPayment?.id,
        amount: input.amount,
        reason: input.reason || null,
        status: "SUCCESS",
        gatewayRefundId,
        processedById: input.processedById,
      },
    }),
    prisma.batchOrder.update({
      where: { id: order.id },
      data: { status: newOrderStatus },
    }),
    ...(input.revokeAccess && isFullRefund
      ? [
          prisma.batchEnrollment.updateMany({
            where: { batchId: order.batchId, studentId: order.studentId },
            data: { status: "DROPPED", droppedAt: new Date() },
          }),
        ]
      : []),
  ]);

  // Dispatch In-App Notification
  try {
    await prisma.notification.create({
      data: {
        userId: order.student.userId,
        title: "Refund Processed",
        body: `A refund of ₹${input.amount.toLocaleString("en-IN")} has been processed for order ${order.orderNumber || order.id}.`,
        type: "GENERAL",
        category: "SYSTEM",
        channel: "IN_APP",
      },
    });
  } catch (err) {
    console.error("[commerce] Refund notification error:", err);
  }

  return refund;
}

/**
 * Direct self-enrollment for completely FREE batches (price === 0).
 * Validates batch eligibility and price server-side, idempotently provisions
 * active enrollment, writes a zero-amount SUCCESS order record for financial auditability,
 * and notifies the student.
 */
export async function enrollStudentInFreeBatch(studentId: string, batchIdentifier: string) {
  // 1. Locate batch by ID or code
  const batch = await prisma.batch.findFirst({
    where: {
      OR: [{ id: batchIdentifier }, { code: batchIdentifier }],
    },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      price: true,
      originalPrice: true,
      isPurchasable: true,
    },
  });

  if (!batch) {
    throw new CommerceOrderError("Batch not found.", "BATCH_NOT_FOUND");
  }

  // 2. Validate batch is published and enrollment is open
  if (batch.isPurchasable === false) {
    throw new CommerceOrderError("Enrollment for this batch is currently closed.", "ENROLLMENT_CLOSED");
  }
  if (batch.status === "ARCHIVED") {
    throw new CommerceOrderError("This batch is no longer available.", "BATCH_ARCHIVED");
  }

  // 3. Verify server-side that the selling price is strictly zero
  if (batch.price !== 0) {
    throw new CommerceOrderError(
      "This is a paid batch. Please complete payment through checkout to enroll.",
      "PAYMENT_REQUIRED"
    );
  }

  // 4. Validate student profile
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
  });

  if (!student) {
    throw new CommerceOrderError("Student profile not found.", "STUDENT_NOT_FOUND");
  }

  // 5. Idempotent check: if already active, do not duplicate records
  const existingEnrollment = await prisma.batchEnrollment.findUnique({
    where: {
      batchId_studentId: {
        batchId: batch.id,
        studentId: student.id,
      },
    },
  });

  if (existingEnrollment && existingEnrollment.status === "ACTIVE") {
    return {
      success: true,
      alreadyEnrolled: true,
      batchId: batch.id,
      batchName: batch.name,
      message: "You are already enrolled in this batch.",
      enrollment: existingEnrollment,
    };
  }

  // 6. Generate order & invoice numbers
  const orderNumber = await generateOrderNumber();
  const invoiceNumber = await generateInvoiceNumber();

  // 7. Atomic transaction: create BatchOrder (status: SUCCESS, provider: FREE), PaymentRecord, and upsert BatchEnrollment
  const [batchOrder, enrollment] = await prisma.$transaction(async (tx) => {
    const order = await tx.batchOrder.create({
      data: {
        orderNumber,
        invoiceNumber,
        studentId: student.id,
        batchId: batch.id,
        originalAmount: batch.originalPrice ?? 0,
        discountAmount: batch.originalPrice ?? 0,
        amount: 0,
        currency: "INR",
        status: "SUCCESS",
        gatewayProvider: "FREE",
        gatewayOrderId: `FREE_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      },
    });

    await tx.paymentRecord.create({
      data: {
        orderId: order.id,
        amount: 0,
        currency: "INR",
        gatewayProvider: "FREE",
        gatewayOrderId: order.gatewayOrderId,
        gatewayPaymentId: `FREE_CLAIM_${order.id}`,
        status: "SUCCESS",
        completedAt: new Date(),
      },
    });

    const enrolled = await tx.batchEnrollment.upsert({
      where: {
        batchId_studentId: {
          batchId: batch.id,
          studentId: student.id,
        },
      },
      create: {
        batchId: batch.id,
        studentId: student.id,
        status: "ACTIVE",
        orderId: order.id,
      },
      update: {
        status: "ACTIVE",
        droppedAt: null,
        orderId: order.id,
      },
    });

    return [order, enrolled];
  });

  // 8. Dispatch Welcome & Enrollment Notification Email
  try {
    await notifyEnrollment({
      idempotencyKey: `free_enrollment:${enrollment.id}`,
      kind: "BATCH",
      studentUserId: student.userId,
      studentName: student.user.name,
      studentEmail: student.user.email,
      productName: batch.name,
    });
  } catch (emailErr) {
    console.error("[commerce] Failed to dispatch free enrollment email:", emailErr);
  }

  // 9. Dispatch In-App Notification
  try {
    await prisma.notification.create({
      data: {
        userId: student.userId,
        title: "Enrolled in Batch! 🎉",
        body: `You have successfully enrolled in ${batch.name}. Happy learning!`,
        type: "GENERAL",
        category: "SYSTEM",
        channel: "IN_APP",
        deepLink: `/courses/${batch.id}`,
        idempotencyKey: `notif_free_enroll_${batch.id}_${student.id}`,
      },
    });
  } catch (notifErr) {
    console.error("[commerce] In-app notification creation error:", notifErr);
  }

  // 10. CRM Activity Tracking
  try {
    const { recordActivity, syncCategoryToOutreach } = await import("@/lib/crm/lead-category");
    const category = await recordActivity({
      studentId: student.id,
      type: "PAYMENT_SUCCESS",
      batchId: batch.id,
    });
    await syncCategoryToOutreach(student.id, category);
  } catch (err) {
    console.error("Activity tracking error (free batch enrollment):", err);
  }

  return {
    success: true,
    alreadyEnrolled: false,
    batchId: batch.id,
    batchName: batch.name,
    message: `Successfully enrolled in ${batch.name}!`,
    orderNumber: batchOrder.orderNumber,
    enrollment,
  };
}

