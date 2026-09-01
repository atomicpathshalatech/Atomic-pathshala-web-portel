import { z } from "zod";

export const broadcastCreateSchema = z
  .object({
    title: z.string().min(2, "Title is required").max(150),
    body: z.string().min(2, "Message body is required").max(2000),
    segmentType: z.enum(["ALL", "BATCH", "CLASS", "TARGET_EXAM"]),
    segmentValue: z.string().optional(),
    channel: z.enum(["IN_APP", "WHATSAPP", "EMAIL", "ALL_CHANNELS"]).default("IN_APP"),
  })
  .refine((data) => data.segmentType === "ALL" || !!data.segmentValue?.trim(), {
    message: "Pick a value for this segment.",
    path: ["segmentValue"],
  });

export type BroadcastCreateInput = z.infer<typeof broadcastCreateSchema>;
