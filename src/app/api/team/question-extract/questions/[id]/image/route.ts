import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const question = await prisma.extractedQuestion.findUnique({
      where: { id: params.id },
    });
    if (!question) return apiError("Extracted question not found.", 404);

    let imageUrl = "";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) return apiError("Please upload an image file.", 400);

      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split(".").pop() || "png";
      const key = `question-diagrams/q-${question.id}-${Date.now()}.${ext}`;

      try {
        imageUrl = await uploadFile({
          key,
          body: buffer,
          contentType: file.type || "image/png",
        });
      } catch (storageErr) {
        // Local base64 fallback
        imageUrl = `data:${file.type || "image/png"};base64,${buffer.toString("base64")}`;
      }
    } else {
      const body = await request.json();
      const { base64Data, imageLink } = body;
      if (imageLink) {
        imageUrl = imageLink;
      } else if (base64Data) {
        const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
        const buffer = Buffer.from(cleanBase64, "base64");
        const key = `question-diagrams/q-${question.id}-${Date.now()}.png`;
        try {
          imageUrl = await uploadFile({
            key,
            body: buffer,
            contentType: "image/png",
          });
        } catch {
          imageUrl = base64Data;
        }
      } else {
        return apiError("No image data provided.", 400);
      }
    }

    // Clean up review reasons (remove missing diagram alert)
    const existingReasons = (question.reviewReasons as string[]) || [];
    const cleanedReasons = existingReasons.filter(
      (r) => !r.toLowerCase().includes("missing diagram") && !r.toLowerCase().includes("image")
    );

    const isClean = cleanedReasons.length === 0;

    const updated = await prisma.extractedQuestion.update({
      where: { id: params.id },
      data: {
        hasImage: true,
        imageUrl,
        reviewReasons: cleanedReasons,
        status: isClean ? "VERIFIED" : question.status,
        isEdited: true,
      },
    });

    return apiSuccess({
      question: updated,
      message: "Diagram image attached successfully!",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
