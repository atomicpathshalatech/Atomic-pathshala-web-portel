import { NextRequest, NextResponse } from "next/server";
import { generateBoardExamContent } from "@/lib/ai-chat/gemini";
import { buildBoardExamPrompt, parseBoardExamJson, BOARDS, type BoardClass, type BoardLanguage, type BoardMode } from "@/lib/ai-chat/boardExam";
import { getCurrentUser } from "@/lib/ai-chat/auth";
import {
  hasActiveSubscription,
  getDailyQuestionsUsed,
  recordQuestionUsage,
  DAILY_FREE_LIMIT,
} from "@/lib/ai-chat/access";

export const runtime = "nodejs";

const VALID_CLASSES: BoardClass[] = ["10th", "12th"];
const VALID_LANGUAGES: BoardLanguage[] = ["hindi", "english", "hinglish"];
const VALID_MODES: BoardMode[] = ["pyq", "model_paper"];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      board?: string;
      className?: string;
      subject?: string;
      language?: string;
      mode?: string;
    };

    const boardEntry = BOARDS.find((b) => b.value === body.board);
    if (!boardEntry) {
      return NextResponse.json({ error: "Invalid board." }, { status: 400 });
    }
    if (!body.className || !VALID_CLASSES.includes(body.className as BoardClass)) {
      return NextResponse.json({ error: "Invalid class." }, { status: 400 });
    }
    if (!body.subject?.trim()) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }
    const language = VALID_LANGUAGES.includes(body.language as BoardLanguage)
      ? (body.language as BoardLanguage)
      : "hindi";
    const mode = VALID_MODES.includes(body.mode as BoardMode) ? (body.mode as BoardMode) : "pyq";
    const className = body.className as BoardClass;

    const user = await getCurrentUser();
    if (user) {
      const isSubscribed = await hasActiveSubscription(user.id);
      if (!isSubscribed) {
        const used = await getDailyQuestionsUsed(user.id);
        if (used >= DAILY_FREE_LIMIT) {
          return NextResponse.json(
            {
              error: "Aaj ke free sawaal khatam ho gaye. Subscribe karke unlimited access paayein.",
              code: "DAILY_LIMIT_REACHED",
            },
            { status: 403 }
          );
        }
      }
    }

    const prompt = buildBoardExamPrompt({
      board: boardEntry.value,
      boardLabel: boardEntry.label,
      className,
      subject: body.subject.trim(),
      language,
      mode,
    });

    const raw = await generateBoardExamContent(prompt);
    const paper = parseBoardExamJson(raw, boardEntry.value, className, body.subject.trim(), mode);

    if (!paper) {
      return NextResponse.json(
        { error: "Could not generate the paper. Please try again." },
        { status: 502 }
      );
    }

    if (user) {
      await recordQuestionUsage(user.id);
    }

    return NextResponse.json({ paper });
  } catch (error) {
    console.error("[Board Exam API]", error);
    return NextResponse.json({ error: "Could not generate the paper." }, { status: 500 });
  }
}
