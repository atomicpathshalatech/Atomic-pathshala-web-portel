import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { isUsableQuestion } from "@/lib/questions/create-with-code";
import {
  type DppImportValidationItem,
  type DppQuickImportSummary,
  parseQuestionIds,
} from "@/lib/questions/dpp-quick-import";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_UPDATE);

    const dpp = await prisma.dpp.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, subject: true, chapter: true },
    });
    if (!dpp) {
      return NextResponse.json({ success: false, error: "DPP not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const rawIdsText: string = body.rawInput || "";
    const action: "validate" | "import" = body.action || "validate";
    const parsedIds = parseQuestionIds(rawIdsText);

    if (parsedIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No Question IDs provided" },
        { status: 400 }
      );
    }

    // Find existing questions in DPP
    const existingLinks = await prisma.dppQuestion.findMany({
      where: { dppId: params.id },
      select: { questionId: true, order: true },
    });
    const alreadyLinkedQuestionIds = new Set(existingLinks.map((l) => l.questionId));

    // Look up questions by questionCode OR id
    const matchedQuestions = await prisma.question.findMany({
      where: {
        OR: [
          { questionCode: { in: parsedIds } },
          { id: { in: parsedIds } },
        ],
      },
      include: {
        translations: { select: { language: true, statement: true } },
      },
    });

    const questionByCode = new Map<string, typeof matchedQuestions[0]>();
    const questionById = new Map<string, typeof matchedQuestions[0]>();
    for (const q of matchedQuestions) {
      if (q.questionCode) questionByCode.set(q.questionCode.toUpperCase(), q);
      questionById.set(q.id, q);
    }

    const items: DppImportValidationItem[] = [];
    let validCount = 0;
    let eligibleCount = 0;
    let duplicateInDppCount = 0;
    let notApprovedCount = 0;
    let notFoundCount = 0;

    const eligibleQuestionDbIds: string[] = [];

    for (const rawId of parsedIds) {
      const q = questionByCode.get(rawId) || questionById.get(rawId);

      if (!q) {
        notFoundCount++;
        items.push({
          inputRaw: rawId,
          normalizedId: rawId,
          found: false,
          alreadyInDpp: false,
          isEligible: false,
          error: "INVALID_QUESTION_ID: Question not found in Question Bank",
        });
        continue;
      }

      validCount++;
      const alreadyInDpp = alreadyLinkedQuestionIds.has(q.id);
      const isApprovedOrPublished = isUsableQuestion(q);
      const statementSnippet =
        q.translations.find((t) => t.language === "ENGLISH")?.statement ||
        q.translations[0]?.statement ||
        "No statement text";

      let isEligible = true;
      let error: string | undefined;

      if (alreadyInDpp) {
        duplicateInDppCount++;
        isEligible = false;
        error = "DUPLICATE_IN_DPP: Question is already attached to this DPP";
      } else if (!isApprovedOrPublished) {
        notApprovedCount++;
        isEligible = false;
        error = `NOT_APPROVED: Question status is '${q.status}', pending review or revision`;
      } else {
        eligibleCount++;
        eligibleQuestionDbIds.push(q.id);
      }

      items.push({
        inputRaw: rawId,
        normalizedId: q.questionCode || q.id,
        found: true,
        questionId: q.id,
        questionCode: q.questionCode || undefined,
        statementSnippet: statementSnippet.slice(0, 90),
        subject: q.subject,
        chapter: q.chapter || undefined,
        difficulty: q.difficulty,
        status: q.status,
        isPublished: q.isPublished,
        alreadyInDpp,
        isEligible,
        error,
      });
    }

    const summary: DppQuickImportSummary = {
      totalInput: parsedIds.length,
      validCount,
      eligibleCount,
      duplicateInDppCount,
      notApprovedCount,
      notFoundCount,
      items,
    };

    // If action is "import", execute insertion of all eligible questions
    if (action === "import") {
      if (eligibleQuestionDbIds.length === 0) {
        return NextResponse.json({
          success: false,
          error: "No eligible questions found to import into DPP",
          data: summary,
        }, { status: 400 });
      }

      let nextOrder = existingLinks.reduce((max, l) => Math.max(max, l.order), -1) + 1;
      await prisma.dppQuestion.createMany({
        data: eligibleQuestionDbIds.map((questionId) => ({
          dppId: params.id,
          questionId,
          order: nextOrder++,
        })),
      });

      return NextResponse.json({
        success: true,
        message: `Successfully imported ${eligibleQuestionDbIds.length} canonical questions into DPP.`,
        data: {
          importedCount: eligibleQuestionDbIds.length,
          summary,
        },
      });
    }

    // Default "validate" response
    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("[dpp quick-import] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
