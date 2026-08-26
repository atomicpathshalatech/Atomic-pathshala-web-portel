import { NextRequest } from "next/server";
import { verifyLeadInviteToken } from "@/lib/integrations/lead-invite";
import { apiSuccess, apiError } from "@/lib/api/response";

/**
 * Public (no API key) — the invite token itself is the credential here,
 * and this is what the /register page's client-side prefill calls when it
 * finds `?invite=` in the URL. Deliberately doesn't expose batchId/exp to
 * the browser, only what's needed to prefill and show context.
 */
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const payload = verifyLeadInviteToken(decodeURIComponent(params.token));
  if (!payload) {
    return apiError("This invite link is invalid or has expired.", 410);
  }

  return apiSuccess({
    name: payload.name,
    email: payload.email,
    mobile: payload.mobile,
    courseTitle: payload.courseTitle,
    batchName: payload.batchName,
  });
}
