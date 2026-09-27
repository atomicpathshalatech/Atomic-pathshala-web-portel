import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for small secrets at rest (YouTube ingest stream keys).
 * Format: "v1.<iv b64url>.<tag b64url>.<ciphertext b64url>".
 *
 * Key: STREAM_KEY_ENCRYPTION_KEY (32 bytes, base64) when set; otherwise
 * derived from the app's auth secret. If the key ever changes, stored stream
 * keys become unreadable — the stream pool's rotate step re-creates them.
 */
function encryptionKey(): Buffer {
  const explicit = process.env.STREAM_KEY_ENCRYPTION_KEY;
  if (explicit) {
    const key = Buffer.from(explicit, "base64");
    if (key.length !== 32) throw new Error("STREAM_KEY_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
    return key;
  }
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("No encryption key: set STREAM_KEY_ENCRYPTION_KEY (or NEXTAUTH_SECRET).");
  return createHash("sha256").update(`atomic-stream-key:v1:${secret}`).digest();
}

export function sealSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function openSecret(sealed: string): string {
  const [version, iv, tag, ct] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognised sealed secret format.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
