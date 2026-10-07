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
    configuredVerifyToken ||
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    process.env.META_WEBHOOK_VERIFY_TOKEN ||
    process.env.META_VERIFY_TOKEN ||
    process.env.WEBHOOK_VERIFY_TOKEN ||
    "atomic_pathshala_meta_verify_token";

  if (!expectedToken || !token) {
    return false;
  }

  try {
    const expectedBuffer = Buffer.from(expectedToken.trim());
    const tokenBuffer = Buffer.from(token.trim());

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
  const secret =
    appSecret ||
    process.env.META_APP_SECRET ||
    process.env.WHATSAPP_API_SECRET ||
    process.env.WHATSAPP_APP_SECRET;

  // If secret is not yet configured in environment, allow processing to avoid rejecting valid webhook deliveries
  if (!secret) {
    console.warn(
      "[META_WEBHOOK_SECURITY] META_APP_SECRET is not configured in environment. Permitting event ingestion."
    );
    return true;
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
