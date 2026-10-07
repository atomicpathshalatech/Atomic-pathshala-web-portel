import "server-only";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { parseAiJson } from "@/lib/ai/latex-json";
import { lightThinking } from "@/lib/ai/gemini-models";
import type { ModuleElementInput } from "@/lib/validation/module";
import { prisma } from "@/lib/db";

export interface AiEditOperation {
  id: string;
  type: "REPLACE_TEXT" | "UPDATE_BLOCK" | "INSERT_BLOCK" | "DELETE_BLOCK" | "CHANGE_STYLE" | "CHANGE_TYPE";
  pageNumber: number;
  targetElementId: string;
  description: string;
  oldContent?: string;
  newContent?: string;
  newType?: string;
  newLabel?: string;
  newVariant?: string;
  newStyle?: Record<string, any>;
  status: "PROPOSED" | "ACCEPTED" | "REJECTED";
}

export interface AiEditPlanResult {
  summary: string;
  totalOperations: number;
  operations: AiEditOperation[];
  affectedPages: number[];
}

const AI_EDIT_PLANNER_PROMPT = `You are a precision academic content editor for Atomic Pathshala educational study modules (NEET / JEE / Boards).
You receive a user's natural language editing instruction and the structured content blocks of the targeted module pages.

Your job is to generate a list of TARGETED, SURGICAL edit operations.
DO NOT rewrite the entire document. ONLY modify the specific blocks or text mentioned in the user's instruction.

Rules:
1. Hindi stays Hindi (Devanagari UTF-8), English stays English. Never transliterate unless explicitly asked to translate.
2. Academic Safety: NEVER change chemical formulas, mathematical constants, question correct answers, or numerical values unless explicitly instructed.
3. Return STRICT JSON:
{
  "summary": "<Short explanation of changes in English/Hindi>",
  "operations": [
    {
      "type": "REPLACE_TEXT" | "UPDATE_BLOCK" | "INSERT_BLOCK" | "DELETE_BLOCK" | "CHANGE_TYPE" | "CHANGE_STYLE",
      "pageNumber": <number>,
      "targetElementId": "<id of element being edited>",
      "description": "<Human-readable summary of this specific change>",
      "oldContent": "<exact old text / content>",
      "newContent": "<new text / content>",
      "newType": "<optional new block type: HEADING|SUBHEADING|PARAGRAPH|CALLOUT|EQUATION|QUESTION|OPTION|BULLETS>",
      "newLabel": "<optional for CALLOUT: Note|Formula|Example|Tip|Caution|Remember|Summary>",
      "newVariant": "<optional for CALLOUT: CONCEPT|NOTE|EXAMPLE|TIP|REMEMBER|CAUTION|FORMULA|SUMMARY>"
    }
  ]
}`;

/**
 * Plans targeted AI edits without mutating the database, returning
 * structured diff proposals for user review and preview.
 */
export async function planAiEdits(
  moduleId: string,
  instruction: string,
  options: { targetPage?: number } = {}
): Promise<AiEditPlanResult> {
  // 1. Fetch relevant module pages
  const pages = await prisma.modulePage.findMany({
    where: {
      moduleId,
      ...(options.targetPage ? { pageNumber: options.targetPage } : {}),
    },
    orderBy: { pageNumber: "asc" },
  });

  if (pages.length === 0) {
    throw new Error("No module pages found to edit.");
  }

  // Format pages for AI context
  const pagesPayload = pages.map((p) => ({
    pageNumber: p.pageNumber,
    elements: (p.elements as unknown as ModuleElementInput[]).map((el) => ({
      id: el.id,
      type: el.type,
      label: el.label,
      variant: el.variant,
      content: el.content,
    })),
  }));

  const rawJson = await executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 16384,
        ...lightThinking(modelName, "low"),
      } as Record<string, unknown>,
    });

    const res = await model.generateContent([
      AI_EDIT_PLANNER_PROMPT,
      `USER INSTRUCTION: ${instruction}`,
      `TARGET PAGES CONTENT:\n${JSON.stringify(pagesPayload, null, 2)}`,
    ]);

    const text = res.response?.text() || "";
    if (!text.trim()) throw new Error("Empty AI edit response");
    return text;
  });

  const parsed = parseAiJson<{
    summary?: string;
    operations?: any[];
  }>(rawJson.replace(/```json|```/gi, "").trim());

  const rawOps = Array.isArray(parsed?.operations) ? parsed.operations : [];
  const operations: AiEditOperation[] = rawOps.map((op, idx) => ({
    id: `op-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    type: op.type || "REPLACE_TEXT",
    pageNumber: Number(op.pageNumber) || (pages[0]?.pageNumber ?? 1),
    targetElementId: String(op.targetElementId || ""),
    description: String(op.description || "Modified block content"),
    oldContent: op.oldContent ? String(op.oldContent) : undefined,
    newContent: op.newContent ? String(op.newContent) : undefined,
    newType: op.newType ? String(op.newType) : undefined,
    newLabel: op.newLabel ? String(op.newLabel) : undefined,
    newVariant: op.newVariant ? String(op.newVariant) : undefined,
    newStyle: op.newStyle || undefined,
    status: "PROPOSED",
  }));

  const affectedPages = Array.from(new Set(operations.map((o) => o.pageNumber))).sort((a, b) => a - b);

  return {
    summary: parsed?.summary || `Found ${operations.length} proposed changes.`,
    totalOperations: operations.length,
    operations,
    affectedPages,
  };
}

/**
 * Applies a list of accepted AI edit operations to the database safely.
 */
export async function applyAcceptedAiEdits(
  moduleId: string,
  acceptedOps: AiEditOperation[]
): Promise<{ success: boolean; appliedCount: number }> {
  if (acceptedOps.length === 0) return { success: true, appliedCount: 0 };

  // Group operations by pageNumber
  const opsByPage = new Map<number, AiEditOperation[]>();
  for (const op of acceptedOps) {
    if (op.status !== "ACCEPTED") continue;
    if (!opsByPage.has(op.pageNumber)) opsByPage.set(op.pageNumber, []);
    opsByPage.get(op.pageNumber)!.push(op);
  }

  let appliedCount = 0;

  for (const [pageNumber, ops] of opsByPage.entries()) {
    const page = await prisma.modulePage.findUnique({
      where: { moduleId_pageNumber: { moduleId, pageNumber } },
    });
    if (!page) continue;

    let elements = [...((page.elements as unknown as ModuleElementInput[]) || [])];

    for (const op of ops) {
      if (op.type === "DELETE_BLOCK") {
        elements = elements.filter((el) => el.id !== op.targetElementId);
        appliedCount++;
        continue;
      }

      if (op.type === "INSERT_BLOCK" && op.newContent) {
        const targetIdx = elements.findIndex((el) => el.id === op.targetElementId);
        const insertIdx = targetIdx >= 0 ? targetIdx + 1 : elements.length;
        elements.splice(insertIdx, 0, {
          id: `p${pageNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          order: insertIdx,
          type: (op.newType as any) || "PARAGRAPH",
          content: op.newContent,
          label: op.newLabel,
          variant: op.newVariant,
        });
        appliedCount++;
        continue;
      }

      const el = elements.find((e) => e.id === op.targetElementId);
      if (el) {
        if (op.newContent !== undefined) el.content = op.newContent;
        if (op.newType) el.type = op.newType as any;
        if (op.newLabel) el.label = op.newLabel;
        if (op.newVariant) el.variant = op.newVariant;
        if (op.newStyle) el.style = { ...el.style, ...op.newStyle };
        appliedCount++;
      }
    }

    // Re-index orders
    elements = elements.map((el, idx) => ({ ...el, order: idx }));

    await prisma.modulePage.update({
      where: { id: page.id },
      data: { elements: elements as any },
    });
  }

  return { success: true, appliedCount };
}
