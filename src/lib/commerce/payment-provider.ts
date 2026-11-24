import "server-only";
import crypto from "crypto";
import type {
  PaymentGatewayAdapter,
  GatewayProvider,
  CreateGatewayOrderParams,
  GatewayOrderResult,
  VerifyPaymentParams,
  GatewayVerificationResult,
  InitiateRefundParams,
  GatewayRefundResult,
  WebhookNormalizedEvent,
} from "./types";
import { razorpay, isPaymentGatewayConfigured, verifyOrderPaymentSignature, verifyWebhookSignature } from "@/lib/payments/razorpay";

export class PaymentAdapterError extends Error {
  constructor(message: string, public provider: GatewayProvider, public code?: string) {
    super(`[${provider}] ${message}`);
    this.name = "PaymentAdapterError";
  }
}

/**
 * Constant-time comparison for cryptographic signature verification.
 */
function safeTimingCompare(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ----------------------------------------------------------------------------
// 1. RAZORPAY ADAPTER
// ----------------------------------------------------------------------------
export class RazorpayAdapter implements PaymentGatewayAdapter {
  readonly provider: GatewayProvider = "RAZORPAY";

  isConfigured(): boolean {
    return isPaymentGatewayConfigured();
  }

  async createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult> {
    if (!this.isConfigured()) {
      throw new PaymentAdapterError("Razorpay credentials are not configured.", this.provider);
    }

    try {
      const order = await razorpay.orders.create({
        amount: Math.round(params.amount * 100), // paise
        currency: params.currency || "INR",
        receipt: params.orderNumber,
        notes: {
          internalOrderId: params.orderId,
          orderNumber: params.orderNumber,
          studentId: params.customer.id,
          ...(params.notes || {}),
        },
      });

      return {
        gatewayProvider: this.provider,
        gatewayOrderId: order.id,
        amount: params.amount,
        currency: params.currency || "INR",
        keyId: process.env.RAZORPAY_KEY_ID,
        clientPayload: {
          razorpayOrderId: order.id,
          amountPaise: Math.round(params.amount * 100),
          currency: params.currency || "INR",
        },
      };
    } catch (err: any) {
      throw new PaymentAdapterError(err?.message || "Failed to create Razorpay order", this.provider);
    }
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<GatewayVerificationResult> {
    if (!this.isConfigured()) {
      throw new PaymentAdapterError("Razorpay credentials are not configured.", this.provider);
    }

    if (!params.gatewaySignature) {
      return {
        success: false,
        gatewayPaymentId: params.gatewayPaymentId,
        gatewayOrderId: params.gatewayOrderId,
        status: "FAILED",
        failureReason: "Missing signature",
      };
    }

    const valid = verifyOrderPaymentSignature({
      orderId: params.gatewayOrderId,
      paymentId: params.gatewayPaymentId,
      signature: params.gatewaySignature,
    });

    if (!valid) {
      return {
        success: false,
        gatewayPaymentId: params.gatewayPaymentId,
        gatewayOrderId: params.gatewayOrderId,
        status: "FAILED",
        failureReason: "Invalid cryptographic signature",
      };
    }

    return {
      success: true,
      gatewayPaymentId: params.gatewayPaymentId,
      gatewayOrderId: params.gatewayOrderId,
      status: "SUCCESS",
    };
  }

  async initiateRefund(params: InitiateRefundParams): Promise<GatewayRefundResult> {
    if (!this.isConfigured()) {
      throw new PaymentAdapterError("Razorpay credentials are not configured.", this.provider);
    }

    if (!params.gatewayPaymentId) {
      throw new PaymentAdapterError("gatewayPaymentId is required for gateway refund.", this.provider);
    }

    try {
      const refund = await razorpay.payments.refund(params.gatewayPaymentId, {
        amount: Math.round(params.amount * 100), // paise
        notes: params.reason ? { reason: params.reason } : undefined,
      });

      return {
        gatewayRefundId: refund.id,
        status: refund.status === "processed" ? "SUCCESS" : "PENDING",
        amount: params.amount,
      };
    } catch (err: any) {
      throw new PaymentAdapterError(err?.message || "Failed to initiate Razorpay refund", this.provider);
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    return verifyWebhookSignature(rawBody, signature);
  }

  parseWebhookEvent(rawBody: string, _headers?: Record<string, any>): WebhookNormalizedEvent | null {
    try {
      const payload = JSON.parse(rawBody);
      const event: string = payload?.event || "";

      let eventType: WebhookNormalizedEvent["eventType"] = "OTHER";
      if (event === "payment.captured" || event === "order.paid") {
        eventType = "PAYMENT_SUCCESS";
      } else if (event === "payment.failed") {
        eventType = "PAYMENT_FAILED";
      } else if (event === "refund.processed") {
        eventType = "REFUND_SUCCESS";
      } else if (event === "refund.failed") {
        eventType = "REFUND_FAILED";
      }

      const paymentEntity = payload?.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id || payload?.payload?.order?.entity?.id;
      const paymentId = paymentEntity?.id;
      const amount = paymentEntity?.amount ? paymentEntity.amount / 100 : undefined;

      const eventId = payload?.id || `${event}_${orderId || paymentId || Date.now()}`;

      return {
        provider: this.provider,
        eventId,
        eventType,
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        amount,
        rawPayload: payload,
      };
    } catch {
      return null;
    }
  }
}

// ----------------------------------------------------------------------------
// 2. CASHFREE ADAPTER (Ready for Future Gateway Activation)
// ----------------------------------------------------------------------------
export class CashfreeAdapter implements PaymentGatewayAdapter {
  readonly provider: GatewayProvider = "CASHFREE";

  isConfigured(): boolean {
    return Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
  }

  async createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult> {
    if (!this.isConfigured()) {
      throw new PaymentAdapterError(
        "Cashfree gateway credentials (CASHFREE_APP_ID, CASHFREE_SECRET_KEY) are not configured.",
        this.provider
      );
    }
    // Future Cashfree PG API call: /pg/orders
    throw new PaymentAdapterError("Cashfree adapter live integration is awaiting gateway activation credentials.", this.provider);
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<GatewayVerificationResult> {
    if (!this.isConfigured()) {
      throw new PaymentAdapterError("Cashfree gateway credentials are not configured.", this.provider);
    }
    return {
      success: false,
      gatewayPaymentId: params.gatewayPaymentId,
      gatewayOrderId: params.gatewayOrderId,
      status: "FAILED",
      failureReason: "Cashfree verification requires live credentials.",
    };
  }

  async initiateRefund(_params: InitiateRefundParams): Promise<GatewayRefundResult> {
    if (!this.isConfigured()) {
      throw new PaymentAdapterError("Cashfree credentials are not configured.", this.provider);
    }
    throw new PaymentAdapterError("Cashfree refund requires live credentials.", this.provider);
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = process.env.CASHFREE_SECRET_KEY;
    if (!secret || !signature) return false;
    const computed = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
    return safeTimingCompare(computed, signature);
  }

  parseWebhookEvent(rawBody: string): WebhookNormalizedEvent | null {
    try {
      const payload = JSON.parse(rawBody);
      const type = payload?.type || "";
      let eventType: WebhookNormalizedEvent["eventType"] = "OTHER";
      if (type === "PAYMENT_SUCCESS_WEBHOOK") eventType = "PAYMENT_SUCCESS";
      else if (type === "PAYMENT_FAILED_WEBHOOK") eventType = "PAYMENT_FAILED";
      else if (type === "REFUND_SUCCESS_WEBHOOK") eventType = "REFUND_SUCCESS";

      const orderId = payload?.data?.order?.order_id;
      const paymentId = payload?.data?.payment?.cf_payment_id ? String(payload.data.payment.cf_payment_id) : undefined;
      const eventId = payload?.event_time ? `${type}_${orderId}_${payload.event_time}` : `${type}_${Date.now()}`;

      return {
        provider: this.provider,
        eventId,
        eventType,
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        amount: payload?.data?.order?.order_amount,
        rawPayload: payload,
      };
    } catch {
      return null;
    }
  }
}

// ----------------------------------------------------------------------------
// 3. PAYU ADAPTER (Ready for Future Gateway Activation)
// ----------------------------------------------------------------------------
export class PayUAdapter implements PaymentGatewayAdapter {
  readonly provider: GatewayProvider = "PAYU";

  isConfigured(): boolean {
    return Boolean(process.env.PAYU_KEY && process.env.PAYU_SALT);
  }

  async createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult> {
    if (!this.isConfigured()) {
      throw new PaymentAdapterError("PayU gateway credentials (PAYU_KEY, PAYU_SALT) are not configured.", this.provider);
    }
    throw new PaymentAdapterError("PayU adapter live integration is awaiting gateway activation credentials.", this.provider);
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<GatewayVerificationResult> {
    if (!this.isConfigured()) {
      throw new PaymentAdapterError("PayU credentials are not configured.", this.provider);
    }
    return {
      success: false,
      gatewayPaymentId: params.gatewayPaymentId,
      gatewayOrderId: params.gatewayOrderId,
      status: "FAILED",
      failureReason: "PayU verification requires live credentials.",
    };
  }

  async initiateRefund(_params: InitiateRefundParams): Promise<GatewayRefundResult> {
    if (!this.isConfigured()) {
      throw new PaymentAdapterError("PayU credentials are not configured.", this.provider);
    }
    throw new PaymentAdapterError("PayU refund requires live credentials.", this.provider);
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const salt = process.env.PAYU_SALT;
    if (!salt || !signature) return false;
    const computed = crypto.createHash("sha512").update(`${rawBody}|${salt}`).digest("hex");
    return safeTimingCompare(computed, signature);
  }

  parseWebhookEvent(rawBody: string): WebhookNormalizedEvent | null {
    try {
      const payload = JSON.parse(rawBody);
      const status = payload?.status;
      let eventType: WebhookNormalizedEvent["eventType"] = "OTHER";
      if (status === "success") eventType = "PAYMENT_SUCCESS";
      else if (status === "failure") eventType = "PAYMENT_FAILED";

      const orderId = payload?.txnid;
      const paymentId = payload?.mihpayid;
      const eventId = payload?.id || `PAYU_${orderId}_${Date.now()}`;

      return {
        provider: this.provider,
        eventId,
        eventType,
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        amount: payload?.amount ? Number(payload.amount) : undefined,
        rawPayload: payload,
      };
    } catch {
      return null;
    }
  }
}

// ----------------------------------------------------------------------------
// 4. FREE ORDER ADAPTER (Instant zero-amount batch fulfillment)
// ----------------------------------------------------------------------------
export class FreeOrderAdapter implements PaymentGatewayAdapter {
  readonly provider: GatewayProvider = "FREE";

  isConfigured(): boolean {
    return true;
  }

  async createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult> {
    if (params.amount > 0) {
      throw new PaymentAdapterError("Free adapter cannot be used for orders with non-zero amounts.", this.provider);
    }
    const gatewayOrderId = `FREE_${params.orderId}`;
    return {
      gatewayProvider: this.provider,
      gatewayOrderId,
      amount: 0,
      currency: "INR",
      clientPayload: { free: true },
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<GatewayVerificationResult> {
    return {
      success: true,
      gatewayPaymentId: `FREE_CLAIM_${params.orderId}`,
      gatewayOrderId: params.gatewayOrderId,
      amount: 0,
      status: "SUCCESS",
      method: "FREE",
    };
  }

  async initiateRefund(): Promise<GatewayRefundResult> {
    return {
      gatewayRefundId: `FREE_REVOKE_${Date.now()}`,
      status: "SUCCESS",
      amount: 0,
    };
  }

  verifyWebhookSignature(): boolean {
    return false;
  }

  parseWebhookEvent(): WebhookNormalizedEvent | null {
    return null;
  }
}

// ----------------------------------------------------------------------------
// 5. OFFLINE MANUAL ADAPTER (Admin manual cash/bank transfers)
// ----------------------------------------------------------------------------
export class OfflineOrderAdapter implements PaymentGatewayAdapter {
  readonly provider: GatewayProvider = "OFFLINE";

  isConfigured(): boolean {
    return true;
  }

  async createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult> {
    return {
      gatewayProvider: this.provider,
      gatewayOrderId: `OFFLINE_${params.orderId}`,
      amount: params.amount,
      currency: params.currency || "INR",
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<GatewayVerificationResult> {
    return {
      success: true,
      gatewayPaymentId: params.gatewayPaymentId || `OFFLINE_REC_${Date.now()}`,
      gatewayOrderId: params.gatewayOrderId,
      status: "SUCCESS",
      method: "OFFLINE",
    };
  }

  async initiateRefund(params: InitiateRefundParams): Promise<GatewayRefundResult> {
    return {
      gatewayRefundId: `OFFLINE_REFUND_${Date.now()}`,
      status: "SUCCESS",
      amount: params.amount,
    };
  }

  verifyWebhookSignature(): boolean {
    return false;
  }

  parseWebhookEvent(): WebhookNormalizedEvent | null {
    return null;
  }
}

// ----------------------------------------------------------------------------
// PROVIDER REGISTRY & FACTORY
// ----------------------------------------------------------------------------
class PaymentProviderRegistry {
  private adapters = new Map<GatewayProvider, PaymentGatewayAdapter>();

  constructor() {
    this.register(new RazorpayAdapter());
    this.register(new CashfreeAdapter());
    this.register(new PayUAdapter());
    this.register(new FreeOrderAdapter());
    this.register(new OfflineOrderAdapter());
  }

  register(adapter: PaymentGatewayAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  getAdapter(provider?: GatewayProvider): PaymentGatewayAdapter {
    const targetProvider = provider || this.getDefaultProvider();
    const adapter = this.adapters.get(targetProvider);
    if (!adapter) {
      throw new Error(`Unsupported payment provider: ${targetProvider}`);
    }
    return adapter;
  }

  getDefaultProvider(): GatewayProvider {
    const envProvider = process.env.PAYMENT_GATEWAY_PROVIDER?.toUpperCase() as GatewayProvider | undefined;
    if (envProvider && this.adapters.has(envProvider)) {
      return envProvider;
    }
    return "RAZORPAY";
  }

  listAvailableProviders(): { provider: GatewayProvider; isConfigured: boolean }[] {
    return Array.from(this.adapters.values()).map((a) => ({
      provider: a.provider,
      isConfigured: a.isConfigured(),
    }));
  }
}

export const paymentRegistry = new PaymentProviderRegistry();
