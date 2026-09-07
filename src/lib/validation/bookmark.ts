import { z } from "zod";

export const bookmarkCreateSchema = z.object({
  questionId: z.string().min(1, "questionId is required"),
});

export type BookmarkCreateInput = z.infer<typeof bookmarkCreateSchema>;
