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
