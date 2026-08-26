import { z } from "zod";

export const MEDIA_MAX_BYTES = 8 * 1024 * 1024; // 8MB
export const MEDIA_ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

export const mediaUpdateSchema = z.object({
  altText: z.string().max(200).nullable().optional(),
});
export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;
