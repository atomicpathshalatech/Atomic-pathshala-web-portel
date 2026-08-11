"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (!result || result.error) {
        toast.error("Invalid email or password. Please try again.");
        return;
      }

      toast.success("Welcome back!");

      // Role-based landing: Students go to their dashboard; every other
      // team role (Teacher, Sales, Finance, Super Admin, etc.) goes to the
      // shared Team Portal, which then shows only the modules their role
      // has permission for.
      const session = await getSession();
      const destination = session?.user?.role === "STUDENT" ? "/dashboard" : "/team";
      router.push(destination);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md glass-card rounded-2xl p-8 md:p-10 space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Welcome back</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Log in to continue your preparation
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="email" className="font-label-md text-label-md text-on-surface">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="you@example.com"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-label-sm font-label-sm text-error">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="font-label-md text-label-md text-on-surface">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="font-label-sm text-label-sm text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 pr-12 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary font-label-sm text-label-sm"
              tabIndex={-1}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && (
            <p className="text-label-sm font-label-sm text-error">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-on-primary font-label-md text-label-md px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Logging in..." : "Log In"}
        </button>
      </form>

      <p className="text-center font-label-sm text-label-sm text-on-surface-variant">
        New to Atomic Pathshala?{" "}
        <Link href="/register" className="text-primary font-bold hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
