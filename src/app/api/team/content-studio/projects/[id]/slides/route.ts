import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { persistGeneratedStudioAsset } from "@/lib/ai-studio/storage";
import {
  buildVerbatimQuestionSlide,
  exportEditablePptxBuffer,
  generateSlideOutline,
  generateSlidesFromOutline,
} from "@/lib/ai-studio/slides/engine";
import type {
  SlideItem,
  SlideOutlineItem,
  SlideThemeId,
} from "@/lib/ai-studio/slides/types";

function extractOptionsArray(raw: unknown): [string, string, string, string] {
  if (Array.isArray(raw)) {
    const strs = raw.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return String(obj.text ?? obj.label ?? obj.value ?? "");
      }
      return String(item ?? "");
    });
    return [
      strs[0] || "Option 1",
      strs[1] || "Option 2",
      strs[2] || "Option 3",
      strs[3] || "Option 4",
    ];
  }
  return ["Option 1", "Option 2", "Option 3", "Option 4"];
}

function formatQuestionSourceLabel(q: {
  pyqExam?: string | null;
  pyqYear?: number | null;
  pyqSource?: string | null;
  ncertBook?: string | null;
  examLevel?: string | null;
}): string {
  if (q.pyqExam && q.pyqYear) return `${q.pyqExam} ${q.pyqYear}`;
  if (q.pyqExam) return q.pyqExam;
  if (q.pyqSource) return q.pyqSource;
  if (q.ncertBook) return q.ncertBook;
  if (q.examLevel) return q.examLevel;
  return "Practice Question";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError("Unauthorized", 401);

    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_SLIDES);

    const project = await prisma.contentProject.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, topic: true, subject: true, chapter: true },
    });
    if (!project) return apiError("Content project not found", 404);

    const [slideDecks, exportedAssets] = await Promise.all([
      prisma.slideDeckProject.findMany({
        where: { projectId: params.id },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.generatedAsset.findMany({
        where: { projectId: params.id, assetType: "SLIDE" },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

    const qSearch = req.nextUrl.searchParams.get("q")?.trim();
    let bankQuestions: Array<{
      id: string;
      questionCode: string | null;
      subject: string;
      chapter: string | null;
      sourceLabel: string;
      statement: string;
      options: [string, string, string, string];
      imageUrl: string | null;
      solution: string | null;
    }> = [];

    if (qSearch !== null && qSearch !== undefined && req.nextUrl.searchParams.has("q")) {
      const rows = await prisma.question.findMany({
        where: qSearch
          ? {
              OR: [
                { questionCode: { contains: qSearch, mode: "insensitive" } },
                { chapter: { contains: qSearch, mode: "insensitive" } },
                { topic: { contains: qSearch, mode: "insensitive" } },
                {
                  translations: {
                    some: {
                      statement: { contains: qSearch, mode: "insensitive" },
                    },
                  },
                },
              ],
            }
          : project.subject
          ? { subject: { contains: project.subject, mode: "insensitive" } }
          : undefined,
        include: {
          translations: { take: 2 },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      });

      bankQuestions = rows
        .filter((r) => r.translations.length > 0)
        .map((r) => {
          const tr =
            r.translations.find((t) => t.language.toLowerCase().includes("en")) ||
            r.translations[0]!;
          return {
            id: r.id,
            questionCode: r.questionCode,
            subject: r.subject,
            chapter: r.chapter,
            sourceLabel: formatQuestionSourceLabel(r),
            statement: tr.statement,
            options: extractOptionsArray(tr.options),
            imageUrl: r.imageUrl || r.referenceImageUrl || null,
            solution: tr.solution || r.solution || null,
          };
        });
    }

    return apiSuccess({ slideDecks, exportedAssets, bankQuestions });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError("Unauthorized", 401);

    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_SLIDES);

    const project = await prisma.contentProject.findUnique({
      where: { id: params.id },
      include: {
        scripts: { orderBy: { version: "desc" }, take: 1 },
      },
    });
    if (!project) return apiError("Content project not found", 404);

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "GENERATE_OUTLINE") {
      await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);
      const topic = String(body.topic || project.topic || project.title);
      const subject = body.subject ? String(body.subject) : project.subject;
      const chapter = body.chapter ? String(body.chapter) : project.chapter;
      const contentType = String(body.contentType || "Chapter lecture");
      const language = String(body.language || project.language || "Hinglish");
      const medium = String(body.medium || project.scripts[0]?.medium || "English");
      const slideCount = Number(body.slideCount || 10);
      const templateTheme = String(body.templateTheme || "ATOMIC_BLACK_ORANGE");
      const sourceMaterial =
        body.sourceMaterial !== undefined
          ? String(body.sourceMaterial)
          : project.scripts[0]?.bodyMarkdown || "";

      const outline = await generateSlideOutline({
        topic,
        subject,
        chapter,
        audience: body.audience ? String(body.audience) : project.targetAudience,
        language,
        medium,
        slideCount,
        contentType,
        purpose: body.purpose ? String(body.purpose) : project.objective,
        sourceMaterial,
        userId: session.user.id,
        roleName: session.user.role || undefined,
        projectId: project.id,
      });

      const deck = await prisma.slideDeckProject.create({
        data: {
          projectId: project.id,
          title: String(body.title || `${topic} — Slide Deck`),
          subject,
          chapter,
          contentType,
          language,
          medium,
          templateTheme,
          outlineJson: outline as unknown as object,
          slidesJson: [],
          createdById: session.user.id,
        },
      });

      await prisma.contentHistory.create({
        data: {
          projectId: project.id,
          entityType: "PROJECT",
          entityId: deck.id,
          snapshot: { title: deck.title, outlineCount: outline.length },
          changeSummary: `Generated ${outline.length}-slide outline for "${deck.title}"`,
          actorId: session.user.id,
        },
      });

      return apiSuccess({ deck }, 201);
    }

    if (action === "GENERATE_SLIDES") {
      await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);
      const deckId = String(body.deckId || "");
      if (!deckId) return apiError("deckId is required", 400);

      const deck = await prisma.slideDeckProject.findFirst({
        where: { id: deckId, projectId: project.id },
      });
      if (!deck) return apiError("Slide deck not found", 404);

      const outline = (
        Array.isArray(body.outline) ? body.outline : deck.outlineJson
      ) as SlideOutlineItem[];
      if (!Array.isArray(outline) || outline.length === 0) {
        return apiError("Slide outline is empty", 400);
      }

      const themeId = String(body.templateTheme || deck.templateTheme || "ATOMIC_BLACK_ORANGE") as SlideThemeId;

      const slides = await generateSlidesFromOutline({
        outline,
        themeId,
        topic: deck.title,
        language: deck.language,
        medium: deck.medium,
        userId: session.user.id,
        roleName: session.user.role || undefined,
        projectId: project.id,
      });

      const updated = await prisma.slideDeckProject.update({
        where: { id: deck.id },
        data: {
          templateTheme: themeId,
          outlineJson: outline as unknown as object,
          slidesJson: slides as unknown as object,
        },
      });

      await prisma.contentHistory.create({
        data: {
          projectId: project.id,
          entityType: "PROJECT",
          entityId: deck.id,
          snapshot: { title: deck.title, slideCount: slides.length },
          changeSummary: `Generated ${slides.length} editable slides for "${deck.title}"`,
          actorId: session.user.id,
        },
      });

      return apiSuccess({ deck: updated });
    }

    if (action === "INSERT_QUESTION_SLIDE") {
      const deckId = String(body.deckId || "");
      if (!deckId) return apiError("deckId is required", 400);

      const deck = await prisma.slideDeckProject.findFirst({
        where: { id: deckId, projectId: project.id },
      });
      if (!deck) return apiError("Slide deck not found", 404);

      const currentSlides = Array.isArray(deck.slidesJson)
        ? (deck.slidesJson as unknown as SlideItem[])
        : [];

      const existingMaxQ = currentSlides.reduce((max, s) => {
        return s.questionNumber && s.questionNumber > max ? s.questionNumber : max;
      }, 0);
      const nextQNum = Number(body.questionNumber) || existingMaxQ + 1;

      let newSlide: SlideItem;

      if (body.questionId) {
        const q = await prisma.question.findUnique({
          where: { id: String(body.questionId) },
          include: { translations: { take: 2 } },
        });
        if (!q || q.translations.length === 0) {
          return apiError("Question not found in Question Bank", 404);
        }
        const tr =
          q.translations.find((t) => t.language.toLowerCase().includes("en")) ||
          q.translations[0]!;
        newSlide = buildVerbatimQuestionSlide(
          {
            id: q.id,
            questionNumber: nextQNum,
            questionText: tr.statement,
            options: extractOptionsArray(tr.options),
            sourceLabel: formatQuestionSourceLabel(q),
            imageUrl: q.imageUrl || q.referenceImageUrl || null,
            explanation: tr.solution || q.solution || null,
          },
          currentSlides.length + 1,
          q.pyqYear || q.pyqExam ? "PYQ" : "Question",
          (deck.templateTheme as SlideThemeId) || "ATOMIC_BLACK_ORANGE"
        );
      } else {
        const questionText = String(body.questionText || "").trim();
        if (!questionText) return apiError("questionText is required", 400);
        const options = extractOptionsArray(body.options);
        newSlide = buildVerbatimQuestionSlide(
          {
            questionNumber: nextQNum,
            questionText,
            options,
            sourceLabel: String(body.sourceLabel || "Practice Question"),
            imageUrl: body.imageUrl ? String(body.imageUrl) : null,
            explanation: body.explanation ? String(body.explanation) : null,
          },
          currentSlides.length + 1,
          String(body.slideType || "Question") as SlideItem["slideType"],
          (deck.templateTheme as SlideThemeId) || "ATOMIC_BLACK_ORANGE"
        );
      }

      const nextSlides = [...currentSlides, newSlide];
      const updated = await prisma.slideDeckProject.update({
        where: { id: deck.id },
        data: { slidesJson: nextSlides as unknown as object },
      });

      return apiSuccess({ deck: updated, insertedSlide: newSlide });
    }

    if (action === "EXPORT_PPTX") {
      await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_EXPORT);
      const deckId = String(body.deckId || "");
      if (!deckId) return apiError("deckId is required", 400);

      const deck = await prisma.slideDeckProject.findFirst({
        where: { id: deckId, projectId: project.id },
      });
      if (!deck) return apiError("Slide deck not found", 404);

      const slides = Array.isArray(deck.slidesJson)
        ? (deck.slidesJson as unknown as SlideItem[])
        : [];
      if (slides.length === 0) {
        return apiError("No slides to export. Generate slides first.", 400);
      }

      const pptxBuffer = await exportEditablePptxBuffer(deck.title, slides);
      const safeSlug = deck.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48);
      const filename = `${safeSlug || "atomic-slides"}-${Date.now()}.pptx`;

      const { generatedAsset } = await persistGeneratedStudioAsset({
        userId: session.user.id,
        projectId: project.id,
        assetType: "SLIDE",
        buffer: pptxBuffer,
        filename,
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        title: `${deck.title} (Editable PPTX)`,
        provider: "pptxgenjs",
        model: "LAYOUT_16x9",
      });

      const updatedDeck = await prisma.slideDeckProject.update({
        where: { id: deck.id },
        data: { exportedAssetId: generatedAsset.id },
      });

      await prisma.contentHistory.create({
        data: {
          projectId: project.id,
          entityType: "PROJECT",
          entityId: deck.id,
          snapshot: { exportedAssetId: generatedAsset.id, slideCount: slides.length },
          changeSummary: `Exported editable PowerPoint (${slides.length} slides) for "${deck.title}"`,
          actorId: session.user.id,
        },
      });

      return apiSuccess({ deck: updatedDeck, asset: generatedAsset });
    }

    return apiError(`Unsupported action: ${action}`, 400);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError("Unauthorized", 401);

    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_SLIDES);

    const body = await req.json();
    const deckId = String(body.deckId || "");
    if (!deckId) return apiError("deckId is required", 400);

    const existing = await prisma.slideDeckProject.findFirst({
      where: { id: deckId, projectId: params.id },
    });
    if (!existing) return apiError("Slide deck not found", 404);

    const updated = await prisma.slideDeckProject.update({
      where: { id: deckId },
      data: {
        title: body.title !== undefined ? String(body.title) : undefined,
        templateTheme:
          body.templateTheme !== undefined ? String(body.templateTheme) : undefined,
        outlineJson:
          body.outlineJson !== undefined ? (body.outlineJson as object) : undefined,
        slidesJson:
          body.slidesJson !== undefined ? (body.slidesJson as object) : undefined,
      },
    });

    return apiSuccess({ deck: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
