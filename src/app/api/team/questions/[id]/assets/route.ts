import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { uploadFile, deleteFile } from "@/lib/storage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import crypto from "crypto";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const assets = await prisma.questionAsset.findMany({
      where: { questionId: params.id },
      orderBy: { order: "asc" },
    });

    return apiSuccess({ assets });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const question = await prisma.question.findUnique({
      where: { id: params.id },
    });
    if (!question) return apiError("Question not found", 404);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "REFERENCE"; // REFERENCE | SOLUTION | DIAGRAM
    const ocrText = (formData.get("ocrText") as string) || null;

    if (!file) {
      return apiError("No file provided in upload", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    const ext = file.name.split(".").pop() || "png";
    const storageKey = `questions/${params.id}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;

    const publicUrl = await uploadFile({
      key: storageKey,
      body: buffer,
      contentType: file.type || "image/png",
    });

    // Get order for new asset
    const count = await prisma.questionAsset.count({
      where: { questionId: params.id },
    });

    const asset = await prisma.questionAsset.create({
      data: {
        questionId: params.id,
        type,
        storageKey,
        publicUrl,
        originalName: file.name,
        mimeType: file.type || "image/png",
        sizeBytes: buffer.length,
        checksum,
        ocrText,
        order: count,
        createdById: session.user.id,
      },
    });

    // If type is REFERENCE and question has no imageUrl, set it as primary
    if (type === "REFERENCE" && !question.imageUrl) {
      await prisma.question.update({
        where: { id: params.id },
        data: { imageUrl: publicUrl },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "QUESTION_ASSET_UPLOADED",
        entityType: "QuestionAsset",
        entityId: asset.id,
        metadata: {
          questionId: params.id,
          type,
          sizeBytes: buffer.length,
        },
      },
    });

    return apiSuccess({ asset }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get("assetId");
    if (!assetId) return apiError("assetId query parameter is required", 400);

    const asset = await prisma.questionAsset.findFirst({
      where: { id: assetId, questionId: params.id },
    });
    if (!asset) return apiError("Asset not found", 404);

    await deleteFile(asset.storageKey);

    await prisma.questionAsset.delete({
      where: { id: asset.id },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
