export type GatewayProvider = "RAZORPAY" | "CASHFREE" | "PAYU" | "OFFLINE" | "FREE";

export type CommerceCustomer = {
  id: string;
  userId?: string;
  name: string;
  email: string;
  phone?: string | null;
};

export type CreateGatewayOrderParams = {
  orderId: string;
  orderNumber: string;
  amount: number; // in Rupees
  currency: string;
  customer: CommerceCustomer;
  notes?: Record<string, string>;
};

export type GatewayOrderResult = {
  gatewayProvider: GatewayProvider;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  keyId?: string;
  clientPayload?: Record<string, any>;
};

export type VerifyPaymentParams = {
  orderId: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature?: string;
  rawPayload?: Record<string, any>;
};

export type GatewayVerificationResult = {
  success: boolean;
  gatewayPaymentId: string;
  gatewayOrderId: string;
  amount?: number;
  status: "SUCCESS" | "FAILED" | "PENDING";
  method?: string;
  failureReason?: string;
};

export type InitiateRefundParams = {
  paymentRecordId?: string;
  gatewayPaymentId?: string;
  amount: number;
  currency: string;
  reason?: string;
};

export type GatewayRefundResult = {
  gatewayRefundId?: string;
  status: "SUCCESS" | "PENDING" | "FAILED";
  amount: number;
  failureReason?: string;
};

export type WebhookNormalizedEvent = {
  provider: GatewayProvider;
  eventId: string;
  eventType: "PAYMENT_SUCCESS" | "PAYMENT_FAILED" | "REFUND_SUCCESS" | "REFUND_FAILED" | "OTHER";
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  amount?: number;
  rawPayload: any;
};

export interface PaymentGatewayAdapter {
  readonly provider: GatewayProvider;
  isConfigured(): boolean;
  createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<GatewayVerificationResult>;
  initiateRefund(params: InitiateRefundParams): Promise<GatewayRefundResult>;
  verifyWebhookSignature(rawBody: string, signature: string, headers?: Record<string, any>): boolean;
  parseWebhookEvent(rawBody: string, headers?: Record<string, any>): WebhookNormalizedEvent | null;
}
