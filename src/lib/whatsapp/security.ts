import crypto from "crypto";

/**
 * Validates Meta WhatsApp Webhook GET Verification Challenge.
 * Compares hub.verify_token with the configured environment variable.
 */
export function verifyWebhookToken(
  mode: string | null,
  token: string | null,
  configuredVerifyToken?: string | null
): boolean {
  if (mode !== "subscribe") {
    return false;
  }

  const expectedToken =
    configuredVerifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!expectedToken || !token) {
    return false;
  }

  try {
    const expectedBuffer = Buffer.from(expectedToken);
    const tokenBuffer = Buffer.from(token);

    if (expectedBuffer.length !== tokenBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, tokenBuffer);
  } catch {
    return false;
  }
}

/**
 * Validates Meta WhatsApp Webhook POST X-Hub-Signature-256 HMAC SHA-256 signature.
 * Uses the Meta App Secret (or WhatsApp API Secret) and raw unparsed request body.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret?: string | null
): boolean {
  const secret = appSecret || process.env.META_APP_SECRET || process.env.WHATSAPP_API_SECRET;

  // In development, if secret is deliberately omitted, log warning but allow mock testing if needed
  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[META_WEBHOOK_SECURITY] META_APP_SECRET is not configured in development. Skipping strict signature verification."
      );
      return true;
    }
    return false;
  }

  if (!signatureHeader) {
    return false;
  }

  // Meta sends signature as "sha256=<hash>"
  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  const signatureHash = parts[1];
  if (!signatureHash) {
    return false;
  }

  try {
    const hmac = crypto.createHmac("sha256", secret);
    const calculatedHash = hmac.update(rawBody, "utf8").digest("hex");

    const calculatedBuffer = Buffer.from(calculatedHash, "hex");
    const signatureBuffer = Buffer.from(signatureHash, "hex");

    if (calculatedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(calculatedBuffer, signatureBuffer);
  } catch (err) {
    console.error("[META_SIGNATURE_VERIFICATION_ERROR]", err);
    return false;
  }
}
