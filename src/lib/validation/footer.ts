import { z } from "zod";

export const footerSettingsUpdateSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  copyrightText: z.string().max(200).nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  socialLinks: z.record(z.string()).nullable().optional(),
  appDownloadLinks: z.record(z.string()).nullable().optional(),
});
export type FooterSettingsUpdateInput = z.infer<typeof footerSettingsUpdateSchema>;

export const footerColumnCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(80),
  order: z.number().int().optional(),
});
export type FooterColumnCreateInput = z.infer<typeof footerColumnCreateSchema>;

export const footerColumnUpdateSchema = footerColumnCreateSchema.partial();
export type FooterColumnUpdateInput = z.infer<typeof footerColumnUpdateSchema>;

export const footerLinkCreateSchema = z.object({
  columnId: z.string().cuid(),
  label: z.string().trim().min(1, "Label is required").max(80),
  url: z.string().trim().min(1, "URL is required").max(500),
  icon: z.string().max(60).optional(),
  openNewTab: z.boolean().optional(),
  order: z.number().int().optional(),
});
export type FooterLinkCreateInput = z.infer<typeof footerLinkCreateSchema>;

export const footerLinkUpdateSchema = footerLinkCreateSchema.partial().omit({ columnId: true });
export type FooterLinkUpdateInput = z.infer<typeof footerLinkUpdateSchema>;
