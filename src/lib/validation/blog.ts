import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || /^https?:\/\//i.test(v) || v.startsWith("/"), "Must be an http(s) link or a site path.")
  .nullable()
  .optional();

export const blogSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only.");

export const blogPostSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  slug: blogSlugSchema,
  excerpt: optionalText(400),
  coverImageUrl: optionalUrl,
  content: z.string().max(100_000).default(""),
  category: optionalText(60),
  authorName: optionalText(80),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  seoTitle: optionalText(200),
  metaDescription: optionalText(300),
});
export type BlogPostInput = z.infer<typeof blogPostSchema>;

export const homeHeroSchema = z.object({
  imageUrl: optionalUrl,
  mobileImageUrl: optionalUrl,
  altText: optionalText(200),
});
