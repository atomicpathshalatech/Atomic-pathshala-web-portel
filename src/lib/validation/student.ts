import { z } from "zod";

/**
 * Student Registration — field set is LOCKED by the master spec.
 * Mandatory: Full Name, Father Name, Mother Name, Email, Mobile, Password,
 *            DOB, Gender, Class, Target Exam, School, City, State.
 * Optional:  Photo, Address, Blood Group, Emergency Contact.
 */
export const studentRegistrationSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(120),
  fatherName: z.string().min(2, "Father's name is required").max(120),
  motherName: z.string().min(2, "Mother's name is required").max(120),
  email: z.string().email("Enter a valid email address"),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  dob: z.coerce.date().refine((d) => d < new Date(), "DOB must be in the past"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  class: z.string().min(1, "Class is required"),
  targetExam: z.string().min(1, "Target exam is required"),
  school: z.string().min(1, "School is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),

  // Optional
  photoUrl: z.string().url().optional(),
  address: z.string().max(500).optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  emergencyContact: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")
    .optional(),

  // Security question (used later for password reset, per locked policy)
  securityQuestion: z.string().min(4).optional(),
  securityAnswer: z.string().min(2).optional(),
});

export type StudentRegistrationInput = z.infer<typeof studentRegistrationSchema>;

/**
 * Password reset requires multiple verification layers per policy:
 * Email + DOB + Security Question.
 */
export const passwordResetVerificationSchema = z.object({
  email: z.string().email(),
  dob: z.coerce.date(),
  securityAnswer: z.string().min(2),
});

export const passwordResetSchema = z.object({
  token: z.string().min(10),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});
