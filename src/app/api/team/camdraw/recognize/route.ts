import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recognizeStructureFromImage } from "@/lib/camdraw/recognition";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const body = await request.json();
    const imageSource = body.imageSource || body.imageUrl;
    const hintSubject = body.hintSubject || body.subject;
    const preferredType = body.preferredType;

    if (!imageSource || typeof imageSource !== "string") {
      return apiError("imageSource or imageUrl (URL or base64) is required.", 400);
    }

    const result = await recognizeStructureFromImage(imageSource, {
      preferredType,
      hintSubject,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
