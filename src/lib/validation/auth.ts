import { z } from "zod";

/**
 * Login — role-agnostic. Every role (Student, Teacher, Admin, etc.) signs in
 * through the same form; NextAuth resolves the role server-side from the DB.
 * Password-only auth per locked policy — never SMS OTP.
 */
export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Step 1 of the forgot-password flow — just enough to look up which
 * security question to show next. See
 * src/lib/validation/student.ts for passwordResetVerificationSchema
 * (email + DOB + security answer) and passwordResetSchema (token + new
 * password), the other two steps of the same locked reset flow.
 */
export const forgotPasswordEmailSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});

export type ForgotPasswordEmailInput = z.infer<typeof forgotPasswordEmailSchema>;
