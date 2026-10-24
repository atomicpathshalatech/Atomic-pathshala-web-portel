import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { uploadFile, storageConfigured } from "@/lib/storage";
import { parseFigure, renderFigure } from "./figures";
import type { RawAiGeneratedQuestion } from "./types";

/**
 * Gives a generated question its picture: the source/NCERT image it chose, or
 * the figure it described, drawn and stored as a PNG. When that is not
 * possible the reason goes into figureProblem (the validator then holds the
 * question back) — a visual question is never saved as if it had a picture.
 */
export async function attachFigure(q: RawAiGeneratedQuestion, batchKey: string): Promise<void> {
  if (q.sourceImageId) {
    const img = await prisma.aiSourcePdfImage.findUnique({ where: { id: q.sourceImageId }, select: { publicUrl: true } }).catch(() => null);
    if (img?.publicUrl) {
      q.imageUrl = img.publicUrl;
      return;
    }
    q.sourceImageId = undefined;
    q.figureProblem = "The chosen source image could not be found.";
  }
  if (!q.figure) return;
  const { figure, problem: parseProblem } = parseFigure(q.figure);
  if (!figure) {
    q.figureProblem = parseProblem ?? "The figure could not be read.";
    return;
  }
  q.figure = figure;
  const { png, problem } = await renderFigure(figure);
  if (!png) {
    q.figureProblem = problem ?? "The figure could not be drawn.";
    return;
  }
  if (problem) q.figureProblem = problem; // drawn, with a note (e.g. one structure skipped)
  if (!storageConfigured()) {
    q.figureProblem = "The figure was drawn but file storage is not set up, so it could not be saved.";
    return;
  }
  const hash = crypto.createHash("sha1").update(png).digest("hex").slice(0, 16);
  try {
    q.imageUrl = await uploadFile({ key: `ai-questions/${batchKey}/${hash}.png`, body: png, contentType: "image/png" });
  } catch (err) {
    q.figureProblem = `The figure was drawn but could not be saved (${err instanceof Error ? err.message : String(err)}).`;
  }
}
