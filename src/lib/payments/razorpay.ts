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
 * Constant-time comparison for signature checks — a plain `===` on two hex
 * digests leaks timing information proportional to how many leading bytes
 * match, which is a (low-severity but real) side channel for an attacker
 * trying to forge a signature byte-by-byte. `crypto.timingSafeEqual` throws
 * on mismatched buffer lengths instead of returning false, so that case is
 * handled explicitly first.
 */
function safeCompare(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

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

  return safeCompare(expected, params.signature);
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

  return safeCompare(expected, params.signature);
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

  return safeCompare(expected, signature);
}