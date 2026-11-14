import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { countersignDirector } from "@/lib/agreements/agreement-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const countersignSchema = z.object({
  directorSignedName: z.string().min(2, "Director legal name is required"),
  signatureDataUrl: z.string().optional(),
  signatureMethod: z.enum(["ELECTRONIC_DRAWN", "ELECTRONIC_TYPED"]).default("ELECTRONIC_TYPED"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const canCountersign =
      (await hasPermission(session.user.id, PERMISSIONS.CONTRACT_CREATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS));
    if (!canCountersign) {
      throw new UnauthorizedError("You do not have authorization to countersign agreements.");
    }

    const body = await request.json();
    const input = countersignSchema.parse(body);

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || undefined;

    const result = await countersignDirector({
      agreementId: params.id,
      directorUserId: session.user.id,
      directorSignedName: input.directorSignedName.trim(),
      signatureDataUrl: input.signatureDataUrl,
      signatureMethod: input.signatureMethod,
      ipAddress,
      userAgent,
    });

    return apiSuccess({
      message: "Agreement successfully countersigned and fully executed.",
      finalPdfUrl: result.finalPdfUrl,
      finalDocHash: result.finalDocHash,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
