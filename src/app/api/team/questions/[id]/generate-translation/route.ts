import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const body = await req.json().catch(() => ({}));
    const targetLanguage: "HINDI" | "ENGLISH" = (body.targetLanguage || "HINDI").toUpperCase();

    const question = await prisma.question.findUnique({
      where: { id: params.id },
      include: { translations: true },
    });

    if (!question) {
      return apiError("Question not found", 404);
    }

    const sourceLang = targetLanguage === "HINDI" ? "ENGLISH" : "HINDI";
    const sourceT =
      question.translations.find((t) => t.language.toUpperCase() === sourceLang) ||
      question.translations[0];

    if (!sourceT) {
      return apiError("No source translation available to translate from", 400);
    }

    const prompt = `You are a Senior Academic Translator specializing in Indian Competitive Exams (NEET, JEE, NCERT).
Translate the following exam question from ${sourceT.language} to ${targetLanguage}.

STRICT SCIENTIFIC TRANSLATION RULES:
1. Preserve all LaTeX formulas, symbols, mathematical expressions, units, and constants ($...$, $$...$$) EXACTLY as they are without translating variables.
2. For Hindi: Use authentic NCERT Hindi terminology (e.g., त्वरण for acceleration, विभवांतर for potential difference, संवेग for momentum).
3. Ensure all option keys (A, B, C, D) maintain their corresponding semantic meaning.
4. Maintain exact negation symmetry (if source has "NOT", "INCORRECT", "EXCEPT", Hindi must have "नहीं", "गलत", "असत्य").

SOURCE QUESTION:
Statement: ${sourceT.statement}
Options: ${JSON.stringify(sourceT.options, null, 2)}
Solution: ${sourceT.solution || "None"}

Respond strictly with valid JSON:
{
  "statement": string,
  "options": {
    "A": string,
    "B": string,
    "C": string,
    "D": string
  },
  "solution": string
}`;

    const rawResponse = await executeGeminiWithFailover(async (client, modelName) => {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });
      const res = await model.generateContent(prompt);
      return res.response.text();
    });

    const parsed = JSON.parse(rawResponse);

    const existingTargetT = question.translations.find(
      (t) => t.language.toUpperCase() === targetLanguage
    );

    if (existingTargetT) {
      await prisma.questionTranslation.update({
        where: { id: existingTargetT.id },
        data: {
          statement: parsed.statement || existingTargetT.statement,
          options: parsed.options || existingTargetT.options,
          solution: parsed.solution || existingTargetT.solution,
        },
      });
    } else {
      await prisma.questionTranslation.create({
        data: {
          questionId: question.id,
          language: targetLanguage,
          statement: parsed.statement || "",
          options: parsed.options || {},
          correctOptionIds: sourceT.correctOptionIds || ["A"],
          solution: parsed.solution || "",
        },
      });
    }

    const updated = await prisma.question.findUnique({
      where: { id: params.id },
      include: {
        translations: true,
        assets: true,
        createdBy: { select: { id: true, name: true, email: true } },
        editedBy: { select: { name: true } },
        review1By: { select: { name: true } },
        review2By: { select: { name: true } },
      },
    });

    return apiSuccess({
      question: updated,
      message: `Successfully generated ${targetLanguage} translation with AI`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
