import { z } from "zod";

const socialLink = z.object({
  label: z.string().trim().min(1).max(40),
  url: z.string().trim().url().max(500),
});

/**
 * Every text field is optional and free-form — the admin types verified,
 * factual copy. Nothing here fabricates or requires credentials.
 */
export const founderUpdateSchema = z.object({
  name: z.string().trim().max(120).default(""),
  designation: z.string().trim().max(160).default(""),
  photoUrl: z.string().trim().url().max(1000).or(z.literal("")).nullable().optional(),
  mobilePhotoUrl: z.string().trim().url().max(1000).or(z.literal("")).nullable().optional(),
  shortBio: z.string().trim().max(600).default(""),
  biography: z.string().trim().max(8000).default(""),
  education: z.string().trim().max(2000).default(""),
  experience: z.string().trim().max(2000).default(""),
  teachingPhilosophy: z.string().trim().max(2000).default(""),
  vision: z.string().trim().max(2000).default(""),
  founderMessage: z.string().trim().max(3000).default(""),
  socialLinks: z.array(socialLink).max(8).default([]),
  isActive: z.boolean().default(false),
  seoTitle: z.string().trim().max(160).or(z.literal("")).nullable().optional(),
  metaDescription: z.string().trim().max(320).or(z.literal("")).nullable().optional(),
  ogImageUrl: z.string().trim().url().max(1000).or(z.literal("")).nullable().optional(),
  canonicalUrl: z.string().trim().url().max(1000).or(z.literal("")).nullable().optional(),
});

export type FounderUpdateInput = z.infer<typeof founderUpdateSchema>;
