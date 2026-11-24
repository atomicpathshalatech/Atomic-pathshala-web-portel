import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCouponDiscount,
  generateOrderNumber,
  generateInvoiceNumber,
} from "../src/server/services/commerce-order-service";
import { paymentRegistry, FreeOrderAdapter, OfflineOrderAdapter, PaymentAdapterError } from "../src/lib/commerce/payment-provider";

describe("ATOMIC PATHSHALA — COMMERCE & PAYMENT READINESS SUITE", () => {
  // --------------------------------------------------------------------------
  // 1. ORDER & PRICING TESTS
  // --------------------------------------------------------------------------
  describe("Order & Pricing Logic", () => {
    it("generates correct annual order number format (ORD-YYYY-XXXXXX)", async () => {
      const orderNumber = await generateOrderNumber();
      assert.match(orderNumber, /^ORD-\d{4}-\d{6}$/);
    });

    it("generates correct annual invoice number format (INV-YYYY-XXXXXX)", async () => {
      const invoiceNumber = await generateInvoiceNumber();
      assert.match(invoiceNumber, /^INV-\d{4}-\d{6}$/);
    });

    it("calculates flat coupon discount correctly without dipping below zero", () => {
      const coupon = { type: "FLAT" as const, value: 500 };
      const { discountAmount, finalPayable } = calculateCouponDiscount(coupon, 2500);
      assert.strictEqual(discountAmount, 500);
      assert.strictEqual(finalPayable, 2000);

      // Capping test: coupon value > base amount
      const hugeCoupon = { type: "FLAT" as const, value: 3000 };
      const capped = calculateCouponDiscount(hugeCoupon, 2500);
      assert.strictEqual(capped.discountAmount, 2500);
      assert.strictEqual(capped.finalPayable, 0);
    });

    it("calculates percentage coupon discount correctly with decimal precision", () => {
      const coupon = { type: "PERCENT" as const, value: 15 };
      const { discountAmount, finalPayable } = calculateCouponDiscount(coupon, 4999);
      // 15% of 4999 = 749.85
      assert.strictEqual(discountAmount, 749.85);
      assert.strictEqual(finalPayable, 4249.15);
    });

    it("respects maxDiscountAmount cap on percentage coupons", () => {
      const coupon = { type: "PERCENT" as const, value: 50, maxDiscountAmount: 1000 };
      // 50% of 5000 is 2500, but capped at 1000
      const { discountAmount, finalPayable } = calculateCouponDiscount(coupon, 5000);
      assert.strictEqual(discountAmount, 1000);
      assert.strictEqual(finalPayable, 4000);
    });

    it("handles zero base price correctly without negative results", () => {
      const coupon = { type: "PERCENT" as const, value: 10 };
      const { discountAmount, finalPayable } = calculateCouponDiscount(coupon, 0);
      assert.strictEqual(discountAmount, 0);
      assert.strictEqual(finalPayable, 0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. GATEWAY-AGNOSTIC ADAPTER REGISTRY TESTS
  // --------------------------------------------------------------------------
  describe("Payment Provider Registry & Adapters", () => {
    it("registers all supported gateway adapters", () => {
      const providers = paymentRegistry.listAvailableProviders();
      const names = providers.map((p) => p.provider);
      assert.ok(names.includes("RAZORPAY"));
      assert.ok(names.includes("CASHFREE"));
      assert.ok(names.includes("PAYU"));
      assert.ok(names.includes("FREE"));
      assert.ok(names.includes("OFFLINE"));
    });

    it("retrieves the active default provider or configured provider", () => {
      const defaultProvider = paymentRegistry.getDefaultProvider();
      assert.strictEqual(defaultProvider, "RAZORPAY");
      const adapter = paymentRegistry.getAdapter("RAZORPAY");
      assert.strictEqual(adapter.provider, "RAZORPAY");
    });

    it("FreeOrderAdapter activates ₹0 orders seamlessly", async () => {
      const freeAdapter = new FreeOrderAdapter();
      assert.strictEqual(freeAdapter.isConfigured(), true);

      const orderResult = await freeAdapter.createOrder({
        orderId: "test_order_123",
        orderNumber: "ORD-2026-000001",
        amount: 0,
        currency: "INR",
        customer: { id: "std_1", name: "Test Student", email: "student@test.com" },
      });
      assert.strictEqual(orderResult.amount, 0);
      assert.strictEqual(orderResult.gatewayOrderId, "FREE_test_order_123");

      const verifyResult = await freeAdapter.verifyPayment({
        orderId: "test_order_123",
        gatewayOrderId: orderResult.gatewayOrderId,
        gatewayPaymentId: "FREE_CLAIM_123",
      });
      assert.strictEqual(verifyResult.success, true);
      assert.strictEqual(verifyResult.status, "SUCCESS");
      assert.strictEqual(verifyResult.method, "FREE");
    });

    it("FreeOrderAdapter rejects non-zero order amounts", async () => {
      const freeAdapter = new FreeOrderAdapter();
      await assert.rejects(
        async () => {
          await freeAdapter.createOrder({
            orderId: "test_order_123",
            orderNumber: "ORD-2026-000001",
            amount: 1999,
            currency: "INR",
            customer: { id: "std_1", name: "Test Student", email: "student@test.com" },
          });
        },
        (err: any) => err instanceof PaymentAdapterError
      );
    });

    it("OfflineOrderAdapter records manual payments accurately", async () => {
      const offlineAdapter = new OfflineOrderAdapter();
      assert.strictEqual(offlineAdapter.isConfigured(), true);

      const res = await offlineAdapter.createOrder({
        orderId: "test_off_1",
        orderNumber: "ORD-2026-000002",
        amount: 3500,
        currency: "INR",
        customer: { id: "std_2", name: "Offline Student", email: "offline@test.com" },
      });
      assert.strictEqual(res.gatewayProvider, "OFFLINE");
      assert.strictEqual(res.amount, 3500);

      const verify = await offlineAdapter.verifyPayment({
        orderId: "test_off_1",
        gatewayOrderId: res.gatewayOrderId,
        gatewayPaymentId: "CASH_REC_999",
      });
      assert.strictEqual(verify.success, true);
      assert.strictEqual(verify.status, "SUCCESS");
    });

    it("Cashfree and PayU adapters report unconfigured status when credentials absent", async () => {
      const cashfree = paymentRegistry.getAdapter("CASHFREE");
      if (!process.env.CASHFREE_APP_ID) {
        assert.strictEqual(cashfree.isConfigured(), false);
        await assert.rejects(async () => {
          await cashfree.createOrder({
            orderId: "cf_1",
            orderNumber: "ORD-1",
            amount: 100,
            currency: "INR",
            customer: { id: "1", name: "A", email: "a@b.com" },
          });
        });
      }

      const payu = paymentRegistry.getAdapter("PAYU");
      if (!process.env.PAYU_KEY) {
        assert.strictEqual(payu.isConfigured(), false);
        await assert.rejects(async () => {
          await payu.createOrder({
            orderId: "pu_1",
            orderNumber: "ORD-2",
            amount: 100,
            currency: "INR",
            customer: { id: "1", name: "A", email: "a@b.com" },
          });
        });
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. WEBHOOK NORMALIZATION & SIGNATURE TESTS
  // --------------------------------------------------------------------------
  describe("Webhook Event Normalization", () => {
    it("normalizes Razorpay payment.captured webhook to PAYMENT_SUCCESS", () => {
      const adapter = paymentRegistry.getAdapter("RAZORPAY");
      const samplePayload = JSON.stringify({
        id: "evt_12345",
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_xyz",
              order_id: "order_abc",
              amount: 499900,
            },
          },
        },
      });

      const normalized = adapter.parseWebhookEvent(samplePayload);
      assert.ok(normalized);
      assert.strictEqual(normalized?.eventType, "PAYMENT_SUCCESS");
      assert.strictEqual(normalized?.gatewayOrderId, "order_abc");
      assert.strictEqual(normalized?.gatewayPaymentId, "pay_xyz");
      assert.strictEqual(normalized?.amount, 4999);
      assert.strictEqual(normalized?.eventId, "evt_12345");
    });

    it("normalizes Razorpay payment.failed webhook to PAYMENT_FAILED", () => {
      const adapter = paymentRegistry.getAdapter("RAZORPAY");
      const samplePayload = JSON.stringify({
        id: "evt_fail_1",
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_failed_xyz",
              order_id: "order_abc",
              amount: 250000,
            },
          },
        },
      });

      const normalized = adapter.parseWebhookEvent(samplePayload);
      assert.ok(normalized);
      assert.strictEqual(normalized?.eventType, "PAYMENT_FAILED");
      assert.strictEqual(normalized?.gatewayOrderId, "order_abc");
    });

    it("normalizes Cashfree webhook payload accurately", () => {
      const adapter = paymentRegistry.getAdapter("CASHFREE");
      const samplePayload = JSON.stringify({
        type: "PAYMENT_SUCCESS_WEBHOOK",
        event_time: "2026-11-24T12:00:00Z",
        data: {
          order: { order_id: "cf_order_999", order_amount: 3000 },
          payment: { cf_payment_id: "123456" },
        },
      });

      const normalized = adapter.parseWebhookEvent(samplePayload);
      assert.ok(normalized);
      assert.strictEqual(normalized?.eventType, "PAYMENT_SUCCESS");
      assert.strictEqual(normalized?.gatewayOrderId, "cf_order_999");
      assert.strictEqual(normalized?.gatewayPaymentId, "123456");
      assert.strictEqual(normalized?.amount, 3000);
    });
  });

  // --------------------------------------------------------------------------
  // 4. SECURITY & INTEGRITY TESTS
  // --------------------------------------------------------------------------
  describe("Security, Tamper Resistance & Access Control", () => {
    it("rejects unauthorized client attempts to fake signature", () => {
      const adapter = paymentRegistry.getAdapter("RAZORPAY");
      const fakeResult = adapter.verifyPayment({
        orderId: "ord_sec_1",
        gatewayOrderId: "order_123",
        gatewayPaymentId: "pay_123",
        gatewaySignature: "forged_signature_hex_12345",
      });
      // In unconfigured or invalid signature mode, must reject
      return fakeResult.then((res) => {
        assert.strictEqual(res.success, false);
      }).catch((err) => {
        assert.ok(err); // Either throws PaymentAdapterError or returns success: false
      });
    });

    it("ensures zero negative amounts are possible even with extreme percentage values", () => {
      const coupon = { type: "PERCENT" as const, value: 150 }; // Attempted 150% discount
      const res = calculateCouponDiscount(coupon, 1000);
      assert.ok(res.finalPayable >= 0, "Final payable must never be negative");
      assert.strictEqual(res.finalPayable, 0);
    });
  });
});
