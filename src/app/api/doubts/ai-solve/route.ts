import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { solveDoubtWithAi } from "@/lib/ai/doubt-solver-engine";

const conversationTurnSchema = z.object({
  role: z.enum(["student", "ai"]),
  content: z.string(),
});

const aiSolveSchema = z.object({
  subject: z.string().optional(),
  questionText: z.string().min(1, "Question text is required"),
  imageUrl: z.string().optional(),
  imageBase64: z.string().optional(),
  history: z.array(conversationTurnSchema).optional(),
});

/**
 * AI Instant Doubt Solver & Realtime Academic Faculty Engine
 * Replaces generic problem-solving templates with tailored, conceptual & numerical answers.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized. Please sign in to ask doubts." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = aiSolveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { subject, questionText, imageUrl, imageBase64, history } = parsed.data;

    // Call the dedicated NEET faculty engine with question classification and context memory
    const solution = await solveDoubtWithAi({
      questionText,
      subject,
      imageUrl,
      imageBase64,
      history,
    });

    return NextResponse.json({
      success: true,
      data: {
        questionText,
        imageUrl: imageUrl || imageBase64 || null,
        solution,
      },
    });
  } catch (err: any) {
    console.error("[AiSolveRoute] Error solving doubt:", err);
    return NextResponse.json(
      {
        success: false,
        error: "AI tutor is momentarily busy. Please try again or submit to faculty.",
      },
      { status: 500 }
    );
  }
}
