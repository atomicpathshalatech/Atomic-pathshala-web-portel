import { z } from "zod";

export const questionTypeEnum = z.enum(["MCQ", "INTEGER"]);
export const difficultyEnum = z.enum(["EASY", "MEDIUM", "HARD"]);
export const questionStatusEnum = z.enum(["PENDING", "VERIFIED", "FLAGGED"]);

// marksCorrect/marksIncorrect used to live on Question itself. The Test
// Portal schema moved marking to Test.correctMarks/incorrectMarks (with an
// optional per-question SectionQuestion override), so a question no longer
// carries its own marks — dropped from this schema accordingly.
export const questionSchema = z
  .object({
    body: z.string().min(10, "Question text should be at least 10 characters"),
    type: questionTypeEnum.default("MCQ"),
    optionA: z.string().optional(),
    optionB: z.string().optional(),
    optionC: z.string().optional(),
    optionD: z.string().optional(),
    correctOption: z.string().min(1, "Specify the correct answer"),
    explanation: z.string().optional(),
    difficulty: difficultyEnum.default("MEDIUM"),
    tags: z.array(z.string()).default([]),
    subjectId: z.string().optional().or(z.literal("")),
    chapterId: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.type === "MCQ") {
      if (!data.optionA || !data.optionB) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Options A and B are required for MCQ questions",
          path: ["optionA"],
        });
      }
      if (!["A", "B", "C", "D"].includes(data.correctOption)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Correct answer must be A, B, C, or D for MCQ questions",
          path: ["correctOption"],
        });
      }
    }
  });

export type QuestionInput = z.infer<typeof questionSchema>;
