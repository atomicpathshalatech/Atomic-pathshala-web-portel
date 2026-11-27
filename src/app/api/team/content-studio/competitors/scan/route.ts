import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { scanAllActiveCompetitors, scanCompetitorChannel } from "@/lib/ai-studio/research/competitors";

const scanSchema = z.object({
  channelId: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_RESEARCH);

    const body = scanSchema.parse(await req.json().catch(() => ({})));
    if (body.channelId) {
      const result = await scanCompetitorChannel(body.channelId);
      return apiSuccess({ results: [result] });
    }

    const results = await scanAllActiveCompetitors();
    return apiSuccess({ results });
  } catch (err) {
    return handleApiError(err);
  }
}
