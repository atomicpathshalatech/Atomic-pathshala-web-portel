import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { UnauthorizedError } from "@/lib/rbac/guard";

/**
 * Gate for server-to-server calls from trusted external systems — currently
 * just the atomic-outreach-system CRM pulling the course/batch list and
 * generating lead-conversion registration links. There's no logged-in user
 * on these requests, so RBAC doesn't apply; instead a single shared secret
 * (OUTREACH_API_KEY) is sent as the `x-api-key` header. Compared in
 * constant time so a timing attack can't narrow the key down byte by byte.
 */
export function requireServiceApiKey(request: NextRequest) {
  const configured = process.env.OUTREACH_API_KEY;
  if (!configured) {
    throw new Error("OUTREACH_API_KEY is not configured on the server.");
  }

  const provided = request.headers.get("x-api-key") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(configured);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedError("Invalid or missing API key.");
  }
}
