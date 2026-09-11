import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { resolveCampaignRecipients } from "@/lib/email/campaign-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  recipientGroup: z.enum([
    "ALL_STUDENTS",
    "ALL_STAFF",
    "SELECTED_STUDENTS",
    "SELECTED_STAFF",
    "BATCH",
    "TEACHER",
    "CUSTOM_FILTER_STUDENTS",
    "CUSTOM_FILTER_STAFF",
  ]),
  batchId: z.string().optional(),
  teacherId: z.string().optional(),
  userIds: z.array(z.string()).optional(),
});

/**
 * POST /api/team/communication/campaigns/preview — resolves the recipient
 * count WITHOUT writing anything. Spec section 6: "Before sending, ALWAYS
 * show a confirmation screen ... You are about to send this email to 2,847
 * recipients." This is what powers that screen.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const input = schema.parse(await req.json());
    const recipients = await resolveCampaignRecipients(input.recipientGroup, {
      batchId: input.batchId,
      teacherId: input.teacherId,
      userIds: input.userIds,
    });

    return apiSuccess({
      count: recipients.length,
      sample: recipients.slice(0, 5).map((r) => ({ name: r.name, email: r.email })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
