import { z } from "zod";

export const questionTypeEnum = z.enum(["MCQ", "INTEGER"]);
export const difficultyEnum = z.enum(["EASY", "MEDIUM", "HARD", "ADVANCED"]);
export const questionStatusEnum = z.enum(["PENDING", "VERIFIED", "FLAGGED"]);

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
    marksCorrect: z.coerce.number().int().default(4),
    marksIncorrect: z.coerce.number().int().default(-1),
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
