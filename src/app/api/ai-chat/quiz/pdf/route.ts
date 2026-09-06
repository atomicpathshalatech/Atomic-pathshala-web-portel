import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/ai-chat/auth";
import { persistQuizPdf } from "@/lib/ai-chat/atomicGuruPipeline";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = (await request.json()) as {
      quizId?: string;
      fileName?: string;
      fileSizeBytes?: number;
      publicUrl?: string;
      storageKey?: string;
      generationJobId?: string;
    };

    const { quizId, fileName, fileSizeBytes = 0, publicUrl, storageKey, generationJobId } = body;

    if (!quizId || !fileName) {
      return NextResponse.json({ error: "Missing required quiz or file information." }, { status: 400 });
    }

    const userId = user?.id || "anonymous-student";

    const pdfRecord = await persistQuizPdf({
      quizId,
      userId,
      fileName,
      fileSizeBytes,
      publicUrl,
      storageKey,
      generationJobId,
    });

    return NextResponse.json({ success: true, pdf: pdfRecord });
  } catch (error) {
    console.error("[Quiz PDF API]", error);
    return NextResponse.json({ error: "Failed to persist PDF record." }, { status: 500 });
  }
}
