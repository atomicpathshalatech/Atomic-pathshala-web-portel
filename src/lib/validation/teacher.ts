import { z } from "zod";

export const DEPARTMENT_OPTIONS = [
  "Physics",
  "Chemistry",
  "Biology",
  "Mathematics",
  "General/Foundation",
] as const;

/**
 * Onboarding a new educator creates both the login (User, role TEACHER) and
 * the Teacher profile in one step — this is what an Academic Head/HR uses
 * instead of the manual create-team-user script.
 */
export const teacherCreateSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  employeeCode: z.string().min(2, "Employee code is required"),
  department: z.enum(DEPARTMENT_OPTIONS),
  subjects: z.array(z.string()).default([]),
  bio: z.string().optional(),
});

export type TeacherCreateInput = z.infer<typeof teacherCreateSchema>;

/** Admin edit — everything except login credentials. */
export const teacherAdminUpdateSchema = z.object({
  employeeCode: z.string().min(2, "Employee code is required"),
  department: z.enum(DEPARTMENT_OPTIONS),
  subjects: z.array(z.string()).default([]),
  bio: z.string().optional(),
});

export type TeacherAdminUpdateInput = z.infer<typeof teacherAdminUpdateSchema>;

/** Self-service — a teacher editing their own profile can't change their
 * employee code or department (HR-controlled), only their bio and subjects. */
export const teacherSelfUpdateSchema = z.object({
  subjects: z.array(z.string()).default([]),
  bio: z.string().optional(),
});

export type TeacherSelfUpdateInput = z.infer<typeof teacherSelfUpdateSchema>;

export const SUBJECT_EXPERTISE_OPTIONS = [
  "Physics",
  "Chemistry",
  "Biology",
  "Mathematics",
  "General/Foundation",
] as const;

/** Public application form — no auth, no password. */
export const teacherApplicationSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  phone: z.string().optional(),
  subject: z.enum(SUBJECT_EXPERTISE_OPTIONS),
  experienceYears: z.coerce.number().int().min(0, "Enter a valid number of years"),
  bio: z.string().max(1000, "Keep it under 1000 characters").optional(),
  resumeUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  portfolioUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

export type TeacherApplicationInput = z.infer<typeof teacherApplicationSchema>;

/** Team review — move an application to Interviewing/Rejected/Archived without hiring yet. */
export const applicationStatusSchema = z.object({
  status: z.enum(["INTERVIEWING", "REJECTED", "ARCHIVED", "PENDING"]),
  reviewNotes: z.string().optional(),
});

export type ApplicationStatusInput = z.infer<typeof applicationStatusSchema>;

/** Approve — turns an application into a real login + Teacher profile. */
export const applicationApproveSchema = z.object({
  employeeCode: z.string().min(2, "Employee code is required"),
  department: z.enum(DEPARTMENT_OPTIONS),
  subjects: z.array(z.string()).min(1, "Add at least one subject"),
  password: z.string().min(8, "Temporary password must be at least 8 characters"),
});

export type ApplicationApproveInput = z.infer<typeof applicationApproveSchema>;
