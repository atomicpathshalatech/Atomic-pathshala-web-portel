import { z } from "zod";

export const testSeriesStatusEnum = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

export const testSeriesSchema = z.object({
  name: z.string().trim().min(3, "Name is required").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  targetBatch: z.string().trim().max(120).optional().or(z.literal("")),
  className: z.string().trim().max(60).optional().or(z.literal("")),
  course: z.string().trim().max(60).optional().or(z.literal("")),
  examType: z.string().trim().max(60).optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1)).default([]),
  visibility: z.enum(["PRIVATE", "PUBLIC"]).default("PRIVATE"),
  status: testSeriesStatusEnum.default("DRAFT"),
  startDate: z.string().datetime().optional().or(z.literal("")),
  endDate: z.string().datetime().optional().or(z.literal("")),
});

export type TestSeriesInput = z.infer<typeof testSeriesSchema>;

export const testSeriesStatusUpdateSchema = z.object({
  status: testSeriesStatusEnum,
});

export type TestSeriesStatusUpdateInput = z.infer<typeof testSeriesStatusUpdateSchema>;

/** A standalone test created directly under a TestSeries — no BatchSchedule. */
export const seriesTestCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  durationMin: z.coerce.number().int().min(1, "Duration must be at least 1 minute").max(600),
  instructions: z.string().trim().max(4000).optional().or(z.literal("")),
});

export type SeriesTestCreateInput = z.infer<typeof seriesTestCreateSchema>;
