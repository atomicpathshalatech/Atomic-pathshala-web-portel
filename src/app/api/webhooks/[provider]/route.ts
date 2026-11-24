import { NextRequest, NextResponse } from "next/server";
import { processGatewayWebhook } from "@/lib/commerce/webhook-service";
import type { GatewayProvider } from "@/lib/commerce/types";

export const runtime = "nodejs";

const VALID_PROVIDERS: Record<string, GatewayProvider> = {
  razorpay: "RAZORPAY",
  cashfree: "CASHFREE",
  payu: "PAYU",
};

export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const providerKey = params.provider?.toLowerCase();
  const provider = VALID_PROVIDERS[providerKey];

  if (!provider) {
    return NextResponse.json({ success: false, error: "Unsupported gateway provider" }, { status: 400 });
  }

  const rawBody = await request.text();

  // Extract signature header depending on provider convention
  let signature: string | null = null;
  if (provider === "RAZORPAY") {
    signature = request.headers.get("x-razorpay-signature");
  } else if (provider === "CASHFREE") {
    signature = request.headers.get("x-webhook-signature") || request.headers.get("x-cashfree-signature");
  } else if (provider === "PAYU") {
    signature = request.headers.get("signature") || request.headers.get("hash");
  }

  const headers: Record<string, any> = {};
  request.headers.forEach((val, key) => {
    headers[key] = val;
  });

  const result = await processGatewayWebhook(provider, rawBody, signature, headers);

  if (!result.success && result.statusCode === 400) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: result.success,
    duplicate: result.duplicate,
  });
}
