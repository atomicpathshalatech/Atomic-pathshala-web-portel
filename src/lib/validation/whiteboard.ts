import { z } from "zod";

export const whiteboardSessionStartSchema = z.object({
  batchScheduleId: z.string().min(1, "batchScheduleId is required"),
});

export const whiteboardSessionPatchSchema = z
  .object({
    activePageNumber: z.number().int().positive().optional(),
    title: z.string().min(1, "Title cannot be empty").max(200).optional(),
    chatEnabled: z.boolean().optional(),
    handRaiseEnabled: z.boolean().optional(),
    // Only ever a client-driven transition into LIVE (the teacher's explicit
    // "Start Class" button, from the pre-class lobby). Every other livePhase
    // value is server-driven (session create/resume/end) — see
    // POST /api/whiteboard/sessions and .../end, not this route.
    livePhase: z.literal("LIVE").optional(),
  })
  .refine(
    (d) =>
      d.activePageNumber !== undefined ||
      d.title !== undefined ||
      d.chatEnabled !== undefined ||
      d.handRaiseEnabled !== undefined ||
      d.livePhase !== undefined,
    { message: "Provide at least one field to update" }
  );

/**
 * Loosely-typed on purpose: this mirrors the StrokeObject union defined in
 * src/lib/canvas/canvas-engine.ts, but that shape is expected to grow
 * (shapes, text, images in later phases) and re-declaring/duplicating it
 * here in lockstep would be exactly the kind of parallel system the spec
 * says not to build. The cap below exists purely to stop a runaway client
 * from writing an unbounded payload, not to validate stroke geometry.
 */
export const whiteboardPageAutosaveSchema = z.object({
  objects: z
    .array(z.record(z.string(), z.unknown()))
    .max(5000, "This page has too many objects to save — start a new page"),
  // Optional so a plain stroke-autosave PATCH doesn't have to resend it.
  // Either "light" / "dark" (slide theme) or an uploaded image URL from
  // src/lib/storage (whiteboard-backgrounds/ prefix) — the client decides
  // which; this schema just caps length against a runaway value.
  background: z.string().min(1).max(2000).optional(),
});

export const quizOptionSchema = z.object({
  key: z.string().min(1).max(4),
  label: z.string().min(1).max(300),
});

export const quizLaunchSchema = z
  .object({
    questionText: z.string().min(1).max(1000).optional(),
    isQuickQuiz: z.boolean().default(false),
    options: z.array(quizOptionSchema).min(2, "A quiz needs at least 2 options").max(6),
    correctOption: z.string().min(1).max(4).optional(),
    timeLimitSec: z.number().int().min(5).max(300).default(30),
  })
  .refine((d) => !d.correctOption || d.options.some((o) => o.key === d.correctOption), {
    message: "correctOption must match one of the option keys",
    path: ["correctOption"],
  });

export const quizResponseSchema = z.object({
  selectedOption: z.string().min(1).max(4),
});

export const messageCreateSchema = z.object({
  body: z.string().min(1, "Message cannot be empty").max(2000),
});
