import { z } from "zod";

export const broadcastCreateSchema = z
  .object({
    title: z.string().min(2, "Title is required").max(150),
    body: z.string().min(2, "Message body is required").max(2000),
    segmentType: z.enum(["ALL", "BATCH", "CLASS", "TARGET_EXAM", "STUDENTS"]),
    segmentValue: z.string().optional().nullable(),
    selectedUserIds: z.array(z.string()).optional(),
    channel: z.enum(["IN_APP", "PUSH", "WHATSAPP", "EMAIL", "ALL_CHANNELS"]).default("IN_APP"),
    channels: z.array(z.string()).optional(),
    category: z.string().optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional().default("NORMAL"),
    image: z.string().optional().nullable(),
    deepLink: z.string().optional().nullable(),
    actionType: z.string().optional().nullable(),
    actionUrl: z.string().optional().nullable(),
    executeAt: z.string().optional().nullable(), // ISO timestamp in future
  })
  .refine(
    (data) => {
      if (data.segmentType === "ALL") return true;
      if (data.segmentType === "STUDENTS") {
        return (data.selectedUserIds && data.selectedUserIds.length > 0) || !!data.segmentValue;
      }
      return !!data.segmentValue?.trim();
    },
    {
      message: "Pick an audience target or select students.",
      path: ["segmentValue"],
    }
  );

export type BroadcastCreateInput = z.infer<typeof broadcastCreateSchema>;
