import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";

export interface PptQuestionTranslation {
  statement: string;
  options: Record<string, string>;
  correctOptionIds: string[];
}

export interface PptQuestionItem {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  type: string;
  difficulty: string;
  imageUrl: string | null;
  camDrawData: unknown;
  english: PptQuestionTranslation | null;
  hindi: PptQuestionTranslation | null;
  warnings: string[];
}

function isReferenceImageUrl(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    url.includes("/questions/q_") ||
    url.includes("/ref_") ||
    lower.includes("reference") ||
    lower.includes("question-ref")
  );
}

function normalizeOptions(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const out: Record<string, string> = {};
    const keys = ["A", "B", "C", "D", "E", "F"];
    raw.forEach((item, idx) => {
      const k = keys[idx] || String(idx + 1);
      if (typeof item === "string") {
        out[k] = item;
      } else if (item && typeof item === "object") {
        const obj = item as { id?: string; key?: string; text?: string; label?: string; value?: string };
        const key = (obj.id || obj.key || k).toUpperCase();
        out[key] = String(obj.text ?? obj.label ?? obj.value ?? "");
      }
    });
    return out;
  }
  if (typeof raw === "object") {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v !== null && v !== undefined) {
        out[k.toUpperCase()] = String(v);
      }
    }
    return out;
  }
  return {};
}

function normalizeCorrectIds(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x ?? "").trim().toUpperCase())
      .filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim().toUpperCase()];
  }
  return [];
}

function parseRawIds(input: string): {
  orderedUnique: string[];
  duplicates: string[];
  invalid: string[];
} {
  const tokens = input
    .split(/[\n,;\t\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const orderedUnique: string[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];

  for (const token of tokens) {
    // Allow alphanumeric, hyphens, underscores (e.g. QID-1021, AP-CHEM-001, cuid)
    if (token.length < 2 || token.length > 80 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      invalid.push(token);
      continue;
    }
    const key = token.toLowerCase();
    if (seen.has(key)) {
      duplicates.push(token);
      continue;
    }
    seen.add(key);
    orderedUnique.push(token);
  }

  return { orderedUnique, duplicates, invalid };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }
    const allowed = await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ);
    if (!allowed) {
      return apiError("Forbidden: Question Bank read permission required.", 403);
    }

    const body = (await req.json().catch(() => ({}))) as { rawInput?: string; ids?: string[] };
    const rawText =
      typeof body.rawInput === "string"
        ? body.rawInput
        : Array.isArray(body.ids)
        ? body.ids.join("\n")
        : "";

    if (!rawText.trim()) {
      return apiError("Please provide at least one Question ID.", 400);
    }

    const { orderedUnique, duplicates, invalid } = parseRawIds(rawText);
    if (orderedUnique.length === 0) {
      return apiSuccess({
        questions: [],
        missing: [],
        duplicates,
        invalid,
      });
    }

    if (orderedUnique.length > 200) {
      return apiError("Maximum 200 Question IDs can be loaded in a single batch.", 400);
    }

    const lowerCodes = orderedUnique.map((id) => id.toLowerCase());

    const rows = await prisma.question.findMany({
      where: {
        OR: [
          { id: { in: orderedUnique } },
          { slug: { in: orderedUnique } },
          { questionCode: { in: orderedUnique, mode: "insensitive" } },
        ],
      },
      include: {
        translations: true,
        assets: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Build lookup map by id, slug, and lowercase questionCode
    const byKey = new Map<string, (typeof rows)[number]>();
    for (const q of rows) {
      byKey.set(q.id.toLowerCase(), q);
      if (q.slug) byKey.set(q.slug.toLowerCase(), q);
      if (q.questionCode) byKey.set(q.questionCode.toLowerCase(), q);
    }

    const questions: PptQuestionItem[] = [];
    const missing: string[] = [];
    const matchedQuestionIds = new Set<string>();

    for (let i = 0; i < orderedUnique.length; i++) {
      const token = orderedUnique[i]!;
      const q = byKey.get(lowerCodes[i]!);
      if (!q) {
        missing.push(token);
        continue;
      }
      if (matchedQuestionIds.has(q.id)) {
        duplicates.push(token);
        continue;
      }
      matchedQuestionIds.add(q.id);

      const enTrans = q.translations.find((t) => t.language.toUpperCase() === "ENGLISH") || q.translations[0];
      const hiTrans = q.translations.find((t) => t.language.toUpperCase() === "HINDI");

      const english: PptQuestionTranslation | null = enTrans
        ? {
            statement: enTrans.statement || "",
            options: normalizeOptions(enTrans.options),
            correctOptionIds: normalizeCorrectIds(enTrans.correctOptionIds),
          }
        : null;

      const hindi: PptQuestionTranslation | null = hiTrans
        ? {
            statement: hiTrans.statement || "",
            options: normalizeOptions(hiTrans.options),
            correctOptionIds: normalizeCorrectIds(hiTrans.correctOptionIds),
          }
        : null;

      const diagramAsset = q.assets.find(
        (a) => a.type === "DIAGRAM" && a.publicUrl && !isReferenceImageUrl(a.publicUrl)
      );
      const imageUrl =
        diagramAsset?.publicUrl ||
        (q.imageUrl && !isReferenceImageUrl(q.imageUrl) ? q.imageUrl : null);

      const warnings: string[] = [];
      const primary = english || hindi;
      if (!primary || !primary.statement.trim()) {
        warnings.push("Missing question statement");
      }
      if (q.type !== "INTEGER" && q.type !== "NUMERICAL") {
        const optCount = Object.values(primary?.options ?? {}).filter((v) => v.trim().length > 0).length;
        if (optCount < 2) {
          warnings.push("Missing or incomplete options");
        }
      }
      const correctKeys = primary?.correctOptionIds ?? [];
      if (correctKeys.length === 0) {
        warnings.push("Missing correct answer in database");
      }

      questions.push({
        id: q.id,
        questionCode: q.questionCode,
        subject: q.subject,
        chapter: q.chapter,
        topic: q.topic,
        type: q.type,
        difficulty: q.difficulty,
        imageUrl,
        camDrawData: q.camDrawData ?? null,
        english,
        hindi,
        warnings,
      });
    }

    return apiSuccess({
      questions,
      missing,
      duplicates,
      invalid,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
