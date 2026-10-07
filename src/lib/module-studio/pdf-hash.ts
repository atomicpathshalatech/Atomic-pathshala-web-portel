import "server-only";
import { createHash } from "crypto";

/**
 * Computes deterministic SHA-256 fingerprint for a PDF buffer.
 * Used for instant cache lookups and duplicate detection.
 */
export function computePdfHash(buffer: Buffer | Uint8Array): string {
  const hash = createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}
