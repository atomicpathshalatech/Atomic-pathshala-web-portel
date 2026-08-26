import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireServiceApiKey } from "@/lib/integrations/service-auth";
import { leadInviteCreateSchema } from "@/lib/validation/integration";
import { createLeadInviteToken } from "@/lib/integrations/lead-invite";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Called by the outreach CRM when a counselor hits "Convert to LMS" on a
 * qualified lead. Doesn't create a Student record directly — the CRM only
 * has name/email/mobile/course/batch, and the real Student record needs
 * a lot more (father's name, DOB, school, city, state, ...). Instead this
 * mints a signed registration link pre-filled with what the CRM knows;
 * the student (or the counselor, on a call) finishes the real /register
 * form, which auto-enrolls into the batch encoded in the link.
 */
export async function POST(request: NextRequest) {
  try {
    requireServiceApiKey(request);
    const input = leadInviteCreateSchema.parse(await request.json());

    const course = await prisma.course.findUnique({ where: { slug: input.courseSlug } });
    if (!course || !course.isPublished) {
      return apiError("Unknown or unpublished course.", 404);
    }

    const batch = await prisma.batch.findUnique({ where: { code: input.batchCode } });
    if (!batch || batch.courseId !== course.id) {
      return apiError("Unknown batch for this course.", 404);
    }

    const { token, expiresAt } = createLeadInviteToken({
      name: input.name,
      email: input.email.toLowerCase(),
      mobile: input.mobile,
      courseSlug: course.slug,
      courseTitle: course.title,
      batchId: batch.id,
      batchCode: batch.code,
      batchName: batch.name,
      counselorNotes: input.counselorNotes,
    });

    await prisma.auditLog.create({
      data: {
        action: "LEAD_INVITE_CREATED",
        entityType: "Batch",
        entityId: batch.id,
        metadata: {
          name: input.name,
          email: input.email,
          mobile: input.mobile,
          courseSlug: course.slug,
          batchCode: batch.code,
        },
      },
    });

    const appUrl = (process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(
      /\/$/,
      ""
    );

    return apiSuccess(
      { registrationUrl: `${appUrl}/register?invite=${token}`, expiresAt },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
