import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const request = await prisma.callingRequest.findUnique({
      where: { id: params.id },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        device: { select: { id: true, deviceName: true, isOnline: true } },
        sessions: { take: 1, orderBy: { createdAt: "desc" } },
      },
    });

    if (!request) {
      return handleApiError(new Error("Calling request not found"));
    }

    return apiSuccess({ request });
  } catch (error) {
    return handleApiError(error);
  }
}
