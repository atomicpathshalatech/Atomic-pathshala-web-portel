import { z } from "zod";

export const BATCH_STATUS_OPTIONS = ["UPCOMING", "ACTIVE", "COMPLETED", "ARCHIVED"] as const;
export const BATCH_ENROLLMENT_STATUS_OPTIONS = ["ACTIVE", "COMPLETED", "DROPPED"] as const;
export const SCHEDULE_SESSION_TYPE_OPTIONS = [
  "LIVE_CLASS",
  "TEST",
  "DPP",
  "DOUBT_SESSION",
  "OTHER",
] as const;
export const SCHEDULE_SESSION_STATUS_OPTIONS = [
  "SCHEDULED",
  "LIVE",
  "COMPLETED",
  "CANCELLED",
] as const;

/**
 * A Batch groups a cohort of students under one or more Teachers for a
 * target exam/course, with its own enrollment list and timetable.
 */
export const batchCreateSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().min(2, "Batch code is required").max(40, "Keep the code under 40 characters"),
  description: z.string().max(1000, "Keep it under 1000 characters").optional(),
  targetExam: z.string().optional(),
  courseId: z.string().optional().or(z.literal("")),
  status: z.enum(BATCH_STATUS_OPTIONS).default("UPCOMING"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  capacity: z.coerce.number().int().positive("Capacity must be a positive number").optional(),
});

export type BatchCreateInput = z.infer<typeof batchCreateSchema>;

export const batchUpdateSchema = batchCreateSchema;
export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>;

/** Assign a Teacher to a Batch, optionally scoped to one subject. */
export const batchTeacherAssignSchema = z.object({
  teacherId: z.string().min(1, "Select a teacher"),
  subject: z.string().optional(),
});

export type BatchTeacherAssignInput = z.infer<typeof batchTeacherAssignSchema>;

/** Enroll an existing Student into a Batch. */
export const batchEnrollSchema = z.object({
  studentId: z.string().min(1, "Select a student"),
});

export type BatchEnrollInput = z.infer<typeof batchEnrollSchema>;

export const batchEnrollmentStatusSchema = z.object({
  status: z.enum(BATCH_ENROLLMENT_STATUS_OPTIONS),
});

export type BatchEnrollmentStatusInput = z.infer<typeof batchEnrollmentStatusSchema>;

/** One timetable entry (live class / test / DPP / doubt session) for a Batch. */
export const batchScheduleCreateSchema = z
  .object({
    title: z.string().min(2, "Title is required"),
    subject: z.string().optional(),
    type: z.enum(SCHEDULE_SESSION_TYPE_OPTIONS).default("LIVE_CLASS"),
    teacherId: z.string().optional().or(z.literal("")),
    chapterId: z.string().optional().or(z.literal("")),
    videoTransport: z.enum(["LIVEKIT", "YOUTUBE", "BOTH"]).default("LIVEKIT"),
    youtubeVideoId: z.string().optional(),
    startsAt: z.coerce.date({ required_error: "Start time is required" }),
    endsAt: z.coerce.date({ required_error: "End time is required" }),
    notes: z.string().max(1000, "Keep it under 1000 characters").optional(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "End time must be after the start time",
    path: ["endsAt"],
  });

export type BatchScheduleCreateInput = z.infer<typeof batchScheduleCreateSchema>;

export const batchScheduleUpdateSchema = z
  .object({
    title: z.string().min(2, "Title is required"),
    subject: z.string().optional(),
    type: z.enum(SCHEDULE_SESSION_TYPE_OPTIONS),
    status: z.enum(SCHEDULE_SESSION_STATUS_OPTIONS),
    teacherId: z.string().optional().or(z.literal("")),
    chapterId: z.string().optional().or(z.literal("")),
    videoTransport: z.enum(["LIVEKIT", "YOUTUBE", "BOTH"]).optional(),
    youtubeVideoId: z.string().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    notes: z.string().max(1000, "Keep it under 1000 characters").optional(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "End time must be after the start time",
    path: ["endsAt"],
  });

export type BatchScheduleUpdateInput = z.infer<typeof batchScheduleUpdateSchema>;
