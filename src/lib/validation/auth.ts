import { z } from "zod";

/** A 10-digit Indian mobile (optionally +91-prefixed) OR an email. */
const IDENTIFIER_RE = /^(?:\+?91)?[6-9]\d{9}$|^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Login — role-agnostic. Every role (Student, Teacher, Admin, etc.) signs in
 * through the same form; NextAuth resolves the role server-side from the DB.
 * The identifier can be the account's mobile number OR its email. Password
 * only — never SMS OTP.
 *
 * The field is still called `email` so the NextAuth CredentialsProvider and
 * every caller (LoginForm, RegisterForm auto sign-in) keep working; the
 * value is just treated as "email or phone" from here on.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your mobile number or email")
    .refine((v) => IDENTIFIER_RE.test(v), "Enter a valid mobile number or email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Forgot-password step 1: the account identifier (mobile or email). The
 *  reset link is always sent to the account's registered email. */
export const forgotPasswordSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Enter your mobile number or email")
    .refine((v) => IDENTIFIER_RE.test(v), "Enter a valid mobile number or email"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** Forgot-password step 2: the emailed token + a new password. */
export const emailResetPasswordSchema = z.object({
  token: z.string().trim().min(20, "Invalid or expired reset link"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Add an uppercase letter")
    .regex(/[0-9]/, "Add a number"),
});
export type EmailResetPasswordInput = z.infer<typeof emailResetPasswordSchema>;

// Kept for the legacy security-question reset routes that still exist.
export const forgotPasswordEmailSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});
export type ForgotPasswordEmailInput = z.infer<typeof forgotPasswordEmailSchema>;

/** "+91 98…" / "0098…" / spaces → bare 10-digit; anything else unchanged. */
export function normaliseLoginIdentifier(raw: string): { kind: "phone" | "email"; value: string } {
  const t = raw.trim();
  const digits = t.replace(/\D/g, "").replace(/^0+/, "").replace(/^91(?=\d{10}$)/, "");
  if (/^[6-9]\d{9}$/.test(digits)) return { kind: "phone", value: digits };
  return { kind: "email", value: t.toLowerCase() };
}
