import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { generateCreative } from "@/lib/creative/engine";

export const runtime = "nodejs";

const schema = z.object({
  type: z.enum(["BATCH", "TEST_SERIES", "CHAPTER", "LECTURE", "LECTURE_START_SLIDE"]),
  entityId: z.string(),
  templateId: z.string().optional().nullable(),
  backgroundId: z.string().optional().nullable(),
  force: z.boolean().optional(),
});

/**
 * POST — the "[Regenerate Creative]" / "[Change Template]" / "[Change
 * Background]" action available to admins on any entity (spec section 15).
 * Same engine call the automatic hooks use; `force: true` skips the
 * hash-match short-circuit so an admin can force a re-render even when
 * nothing the engine tracks has changed (e.g. they only want to confirm
 * the current asset renders cleanly).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const input = schema.parse(await req.json());

    // The only UI entry point that calls this today is the Chapter detail
    // page's "Regenerate Creative" button, which is shown to a teacher
    // based on PERMISSIONS.CHAPTER_UPDATE (see (team)/team/chapters/[id]/
    // page.tsx's `canUpdate`). This route was gated on
    // COMMUNICATION_CENTER_ACCESS instead - a permission with nothing to
    // do with chapter/creative management - so a teacher who could see
    // and click the button always got a 403 back. Chapter regeneration
    // now requires the same permission the button's own visibility is
    // based on; every other creative type keeps the original gate since
    // nothing in the UI calls this route for them yet.
    if (input.type === "CHAPTER") {
      await requirePermission(session.user.id, PERMISSIONS.CHAPTER_UPDATE);
    } else {
      await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);
    }
    const result = await generateCreative(input.type, input.entityId, {
      templateId: input.templateId,
      backgroundId: input.backgroundId,
      force: input.force,
    });

    if (!result.ok) return apiError(result.reason, 422);
    return apiSuccess({ assetUrl: result.assetUrl, skipped: result.skipped });
  } catch (error) {
    return handleApiError(error);
  }
}
