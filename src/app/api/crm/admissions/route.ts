import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { convertLeadToAdmission } from "@/lib/crm/crm-service";
import { z } from "zod";

const admissionSchema = z.object({
  leadId: z.string().min(1),
  batchId: z.string().min(1),
  courseFee: z.number().optional(),
  discount: z.number().optional(),
  finalAmount: z.number().optional(),
  paymentTransactionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_UPDATE);

    const body = await req.json();
    const data = admissionSchema.parse(body);

    const result = await convertLeadToAdmission({
      ...data,
      performedById: session.user.id,
    });

    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
