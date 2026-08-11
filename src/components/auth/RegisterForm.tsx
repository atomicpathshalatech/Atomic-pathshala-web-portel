"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { z } from "zod";
import { studentRegistrationSchema } from "@/lib/validation/student";

// Client-side only: confirm-password + a mandatory security question, so the
// locked "Email + DOB + Security Question" password-reset flow always has
// something to verify against. The base fields still match the server schema
// exactly, field for field.
const registerFormSchema = studentRegistrationSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm your password"),
    securityQuestion: z.string().min(4, "Please choose a security question"),
    securityAnswer: z.string().min(2, "Please provide an answer"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormInput = z.infer<typeof registerFormSchema>;

const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite teacher's name?",
  "What city were you born in?",
];

const CLASS_OPTIONS = ["Class 9", "Class 10", "Class 11", "Class 12", "Dropper"];
const TARGET_EXAM_OPTIONS = ["NEET", "JEE Main", "JEE Advanced", "Foundation"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Chandigarh", "Puducherry",
];

type RegisteredResult = {
  enrollmentNumber: string;
  studentIdCode: string;
};

export function RegisterForm() {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<RegisteredResult | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerFormSchema),
  });

  async function onSubmit(values: RegisterFormInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const { confirmPassword, ...payload } = values;
      const res = await fetch("/api/students/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        if (body.issues) {
          for (const [field, messages] of Object.entries(body.issues) as [
            keyof RegisterFormInput,
            string[],
          ][]) {
            setError(field, { message: messages[0] });
          }
          setServerError("Please fix the highlighted fields.");
        } else {
          setServerError(body.error ?? "Registration failed. Please try again.");
        }
        return;
      }

      setRegistered({
        enrollmentNumber: body.data.enrollmentNumber,
        studentIdCode: body.data.studentIdCode,
      });
    } catch {
      setServerError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (registered) {
    return (
      <div className="w-full max-w-lg glass-card rounded-2xl p-8 md:p-10 space-y-6 text-center">
        <div className="w-16 h-16 bg-tertiary-container/10 rounded-full flex items-center justify-center mx-auto text-tertiary">
          <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
            check_circle
          </span>
        </div>
        <div className="space-y-2">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Registration successful!
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Save these details — you&apos;ll need them for future reference.
          </p>
        </div>
        <div className="bg-surface-container-low rounded-xl p-6 space-y-3 text-left">
          <div className="flex justify-between items-center">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Enrollment Number
            </span>
            <span className="font-headline-md text-headline-md text-primary">
              {registered.enrollmentNumber}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Student ID
            </span>
            <span className="font-headline-md text-headline-md text-primary">
              {registered.studentIdCode}
            </span>
          </div>
        </div>
        <Link
          href="/login"
          className="block w-full bg-primary text-on-primary font-label-md text-label-md px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl glass-card rounded-2xl p-8 md:p-10 space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          Create your student account
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Join thousands of students preparing for NEET &amp; JEE
        </p>
      </div>

      {serverError && (
        <div className="bg-error-container/40 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-label-sm font-label-sm text-error">{serverError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
        {/* Personal Details */}
        <fieldset className="space-y-4">
          <legend className="font-headline-md text-headline-md text-on-surface mb-2">
            Personal Details
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full Name" error={errors.fullName?.message}>
              <input className={inputClass} {...register("fullName")} />
            </Field>
            <Field label="Date of Birth" error={errors.dob?.message}>
              <input type="date" className={inputClass} {...register("dob")} />
            </Field>
            <Field label="Father's Name" error={errors.fatherName?.message}>
              <input className={inputClass} {...register("fatherName")} />
            </Field>
            <Field label="Mother's Name" error={errors.motherName?.message}>
              <input className={inputClass} {...register("motherName")} />
            </Field>
            <Field label="Gender" error={errors.gender?.message}>
              <select className={inputClass} {...register("gender")} defaultValue="">
                <option value="" disabled>
                  Select gender
                </option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
          </div>
        </fieldset>

        {/* Contact Details */}
        <fieldset className="space-y-4">
          <legend className="font-headline-md text-headline-md text-on-surface mb-2">
            Contact Details
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Email" error={errors.email?.message}>
              <input type="email" autoComplete="email" className={inputClass} {...register("email")} />
            </Field>
            <Field label="Mobile Number" error={errors.mobile?.message}>
              <input type="tel" className={inputClass} placeholder="10-digit number" {...register("mobile")} />
            </Field>
            <Field label="School" error={errors.school?.message}>
              <input className={inputClass} {...register("school")} />
            </Field>
            <Field label="City" error={errors.city?.message}>
              <input className={inputClass} {...register("city")} />
            </Field>
            <Field label="State" error={errors.state?.message}>
              <select className={inputClass} {...register("state")} defaultValue="">
                <option value="" disabled>
                  Select state
                </option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </fieldset>

        {/* Academic Details */}
        <fieldset className="space-y-4">
          <legend className="font-headline-md text-headline-md text-on-surface mb-2">
            Academic Details
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Current Class" error={errors.class?.message}>
              <select className={inputClass} {...register("class")} defaultValue="">
                <option value="" disabled>
                  Select class
                </option>
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Target Exam" error={errors.targetExam?.message}>
              <select className={inputClass} {...register("targetExam")} defaultValue="">
                <option value="" disabled>
                  Select target exam
                </option>
                {TARGET_EXAM_OPTIONS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </fieldset>

        {/* Account Security */}
        <fieldset className="space-y-4">
          <legend className="font-headline-md text-headline-md text-on-surface mb-2">
            Account Security
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Password" error={errors.password?.message}>
              <input type="password" autoComplete="new-password" className={inputClass} {...register("password")} />
            </Field>
            <Field label="Confirm Password" error={errors.confirmPassword?.message}>
              <input
                type="password"
                autoComplete="new-password"
                className={inputClass}
                {...register("confirmPassword")}
              />
            </Field>
            <Field label="Security Question" error={errors.securityQuestion?.message}>
              <select className={inputClass} {...register("securityQuestion")} defaultValue="">
                <option value="" disabled>
                  Choose a question
                </option>
                {SECURITY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Security Answer" error={errors.securityAnswer?.message}>
              <input className={inputClass} {...register("securityAnswer")} />
            </Field>
          </div>
          <p className="text-label-sm font-label-sm text-on-surface-variant">
            Used only to verify your identity if you ever need to reset your password.
          </p>
        </fieldset>

        {/* Optional Details */}
        <fieldset className="space-y-4">
          <legend className="font-headline-md text-headline-md text-on-surface mb-2">
            Optional Details
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Blood Group" error={errors.bloodGroup?.message}>
              <select className={inputClass} {...register("bloodGroup")} defaultValue="">
                <option value="">Prefer not to say</option>
                {BLOOD_GROUPS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Emergency Contact" error={errors.emergencyContact?.message}>
              <input type="tel" className={inputClass} placeholder="10-digit number" {...register("emergencyContact")} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Address" error={errors.address?.message}>
                <textarea rows={2} className={inputClass} {...register("address")} />
              </Field>
            </div>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-on-primary font-label-md text-label-md px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating your account..." : "Create Account"}
        </button>
      </form>

      <p className="text-center font-label-sm text-label-sm text-on-surface-variant">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-bold hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-label-md text-label-md text-on-surface">{label}</label>
      {children}
      {error && <p className="text-label-sm font-label-sm text-error">{error}</p>}
    </div>
  );
}
