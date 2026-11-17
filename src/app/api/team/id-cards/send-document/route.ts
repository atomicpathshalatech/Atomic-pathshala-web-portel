import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { canManageCards } from "@/lib/id-card/admin";
import { sendIndividualDocument, IndividualDocType } from "@/lib/id-card/individual-sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const payloadSchema = z.object({
  userId: z.string().min(1, "Recipient User ID is required"),
  kind: z.enum(["TEAM", "STUDENT"]),
  documentType: z.enum([
    "ID_CARD",
    "JOINING_LETTER",
    "EXPERIENCE_CERTIFICATE",
    "RELIEVING_LETTER",
    "CONTRACT_LETTER",
    "CUSTOM_EMAIL",
  ]),
  channel: z.enum(["email", "whatsapp"]).default("email"),
  customSubject: z.string().optional(),
  customMessage: z.string().optional(),
  joiningDate: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  workLocation: z.string().optional(),
  reportingAuthority: z.string().optional(),
  assignedSubject: z.string().optional(),
  assignedBatch: z.string().optional(),
  tenureStart: z.string().optional(),
  tenureEnd: z.string().optional(),
  relievingDate: z.string().optional(),
  conductRemarks: z.string().optional(),
  monthlySalary: z.string().optional(),
  annualSalary: z.string().optional(),
  noticePeriodDays: z.string().optional(),
  specialConditions: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please log in.", 401);

    const body = await request.json();
    const input = payloadSchema.parse(body);

    if (!(await canManageCards(session.user.id, input.kind))) {
      return apiError("You do not have permission to send documents for this category.", 403);
    }

    const result = await sendIndividualDocument({
      ...input,
      documentType: input.documentType as IndividualDocType,
    });

    await prisma.auditLog
      .create({
        data: {
          userId: session.user.id,
          action: "INDIVIDUAL_DOCUMENT_SENT",
          entityType: "UserDocument",
          metadata: {
            recipientUserId: input.userId,
            kind: input.kind,
            documentType: input.documentType,
            channel: input.channel,
            message: result.message,
          },
        },
      })
      .catch(() => undefined);

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
