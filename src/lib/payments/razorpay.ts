import "server-only";
import Razorpay from "razorpay";
import crypto from "crypto";

const globalForRazorpay = globalThis as unknown as {
  razorpay?: Razorpay;
};

function getRazorpay(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }

  if (globalForRazorpay.razorpay) {
    return globalForRazorpay.razorpay;
  }

  const client = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForRazorpay.razorpay = client;
  }

  return client;
}

export const razorpay = new Proxy({} as Razorpay, {
  get(_target, property) {
    return Reflect.get(getRazorpay(), property);
  },
});

/**
 * Verifies the checkout-success signature for a one-time Order payment.
 */
export function verifyOrderPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");

  return expected === params.signature;
}

/**
 * Verifies the checkout-success signature for a Subscription checkout.
 */
export function verifySubscriptionPaymentSignature(params: {
  subscriptionId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.paymentId}|${params.subscriptionId}`)
    .digest("hex");

  return expected === params.signature;
}

/**
 * Verifies the X-Razorpay-Signature header on incoming webhooks.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return expected === signature;
}