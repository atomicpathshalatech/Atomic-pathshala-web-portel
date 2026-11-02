"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { loginSchema, normaliseLoginIdentifier, type LoginInput } from "@/lib/validation/auth";
import { sendMsg91Otp, verifyMsg91Otp } from "@/lib/msg91-widget";
import { detectDeviceMeta } from "@/lib/security/device-client";

interface ConflictingSession {
  id: string;
  deviceName: string | null;
  deviceCategory: string;
  createdAt: string;
  lastActiveAt: string;
}

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Log in by OTP (default) or by password.
  const [method, setMethod] = useState<"otp" | "password">("otp");
  const [otpIdentifier, setOtpIdentifier] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStage, setOtpStage] = useState<"enter" | "code">("enter");
  const [otpNote, setOtpNote] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Device replacement prompt modal state
  const [replacementModal, setReplacementModal] = useState<{
    conflictingSession: ConflictingSession;
    provider: "credentials" | "otp";
    fields: Record<string, string>;
  } | null>(null);
  const [replacingDevice, setReplacingDevice] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function handleLoginSuccess() {
    toast.success("Welcome back!");
    const session = await getSession();
    const userRole = (session?.user as any)?.role;
    const destination =
      !userRole || userRole === "STUDENT" || userRole === "PARENT" ? "/dashboard" : "/team";
    router.push(destination);
    router.refresh();
  }

  /** Returns true when signed in. */
  async function executeSignIn(provider: "credentials" | "otp", fields: Record<string, string>, replaceSessionId?: string): Promise<boolean> {
    const deviceMeta = detectDeviceMeta();

    const result = await signIn(provider, {
      ...fields,
      deviceId: deviceMeta.deviceId,
      deviceName: deviceMeta.deviceName,
      deviceCategory: deviceMeta.deviceCategory,
      replaceSessionId: replaceSessionId || "",
      redirect: false,
    });

    if (!result || result.error) {
      const err = result?.error || "";

      if (err.startsWith("DEVICE_RESTRICTION:")) {
        try {
          const payload = JSON.parse(err.replace("DEVICE_RESTRICTION:", ""));
          if (payload.code === "CATEGORY_LIMIT_REACHED" && payload.conflictingSession) {
            setReplacementModal({
              conflictingSession: payload.conflictingSession,
              provider,
              fields,
            });
            return false;
          }
          if (payload.code === "CATEGORY_NOT_ALLOWED") {
            toast.error(payload.message || "This device category is not permitted for your account.");
            return false;
          }
          if (payload.code === "DEVICE_BLOCKED") {
            toast.error("This device has been blocked by an administrator. Please contact support.");
            return false;
          }
          if (payload.code === "TOTAL_LIMIT_REACHED") {
            toast.error(payload.message || "Active device limit reached. Please sign out from another device.");
            return false;
          }
        } catch {
          // fallback to generic toast below
        }
      }

      toast.error(provider === "otp" ? "That code is not right, or it has expired. Please try again." : "Wrong mobile number / email or password. Please try again.");
      return false;
    }

    await handleLoginSuccess();
    return true;
  }

  // ---- Log in by OTP ---------------------------------------------------------
  // The code goes to the student's MOBILE NUMBER by SMS (MSG91, the same as at
  // sign-up) — first send and resend alike. Not every student can open email.
  async function sendOtp(resend = false) {
    const id = normaliseLoginIdentifier(otpIdentifier.trim());
    if (id.kind !== "phone") {
      toast.error("Enter your 10-digit mobile number.");
      return;
    }
    setSubmitting(true);
    setOtpNote(null);
    try {
      await sendMsg91Otp(`91${id.value}`);
      setOtpNote(`OTP ${resend ? "sent again" : "sent"} to +91 ${id.value.slice(0, 2)}******${id.value.slice(-2)} by SMS.`);
      setOtpStage("code");
      setOtpCode("");
      setResendIn(45);
    } catch (err) {
      toast.error((err as Error).message || "Could not send the OTP. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp() {
    const code = otpCode.trim();
    if (!/^\d{4,8}$/.test(code)) {
      toast.error("Enter the OTP you received.");
      return;
    }
    setSubmitting(true);
    try {
      const smsToken = await verifyMsg91Otp(code).catch((err: Error) => {
        toast.error(err.message || "That OTP is not right. Please try again.");
        return "";
      });
      if (!smsToken) return;
      await executeSignIn("otp", { identifier: otpIdentifier.trim(), smsToken });
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    try {
      await executeSignIn("credentials", { email: values.email, password: values.password });
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmReplacement() {
    if (!replacementModal) return;
    setReplacingDevice(true);
    try {
      await executeSignIn(replacementModal.provider, replacementModal.fields, replacementModal.conflictingSession.id);
      setReplacementModal(null);
    } catch {
      toast.error("Failed to replace device. Please try again.");
    } finally {
      setReplacingDevice(false);
    }
  }

  return (
    <>
      <div className="w-full max-w-md glass-card rounded-2xl p-8 md:p-10 space-y-6">
        <div className="space-y-3 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl overflow-hidden p-1 bg-white border border-slate-200/80 shadow-sm flex items-center justify-center">
            <img
              src="/brand/logo.png"
              alt="Atomic Pathshala Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Welcome back</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Log in to continue your preparation
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container-low p-1" role="tablist" aria-label="How to log in">
          {(["otp", "password"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={method === m}
              onClick={() => setMethod(m)}
              className={`rounded-lg py-2 text-sm font-bold transition ${method === m ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              {m === "otp" ? "Login by OTP" : "Login by Password"}
            </button>
          ))}
        </div>

        {method === "otp" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void (otpStage === "enter" ? sendOtp() : verifyOtp());
            }}
            className="space-y-5"
            noValidate
          >
            <div className="space-y-1.5">
              <label htmlFor="otp-identifier" className="font-label-md text-label-md text-on-surface">
                Mobile number
              </label>
              <input
                id="otp-identifier"
                type="text"
                autoComplete="username"
                value={otpIdentifier}
                onChange={(e) => {
                  setOtpIdentifier(e.target.value);
                  if (otpStage === "code") {
                    setOtpStage("enter");
                    setOtpNote(null);
                  }
                }}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                inputMode="numeric"
                placeholder="98XXXXXXXX"
              />
            </div>

            {otpStage === "code" && (
              <div className="space-y-1.5">
                <label htmlFor="otp-code" className="font-label-md text-label-md text-on-surface">
                  Enter OTP
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••"
                />
                {otpNote && <p className="text-label-sm font-label-sm text-on-surface-variant">{otpNote}</p>}
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={resendIn > 0 || submitting}
                    onClick={() => void sendOtp(true)}
                    className="font-label-sm text-label-sm text-primary hover:underline disabled:text-on-surface-variant disabled:no-underline"
                  >
                    {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-on-primary font-label-md text-label-md px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Please wait…" : otpStage === "enter" ? "Send OTP" : "Verify & Log In"}
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="font-label-md text-label-md text-on-surface">
              Mobile number or email
            </label>
            <input
              id="email"
              type="text"
              inputMode="text"
              autoComplete="username"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="98XXXXXXXX or you@example.com"
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
        )}

        <p className="text-center font-label-sm text-label-sm text-on-surface-variant">
          New to Atomic Pathshala?{" "}
          <Link href="/register" className="text-primary font-bold hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      {/* Device Limit & Replacement Modal */}
      {replacementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">devices</span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Device Limit Reached</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                You already have an active{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {replacementModal.conflictingSession.deviceCategory === "DESKTOP"
                    ? "Laptop/Desktop"
                    : replacementModal.conflictingSession.deviceCategory === "TABLET"
                    ? "Tablet"
                    : "Mobile"}
                </span>{" "}
                registered:
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
              <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-teal-600">
                  {replacementModal.conflictingSession.deviceCategory === "MOBILE"
                    ? "smartphone"
                    : replacementModal.conflictingSession.deviceCategory === "TABLET"
                    ? "tablet_mac"
                    : "computer"}
                </span>
                {replacementModal.conflictingSession.deviceName || "Previous Device"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Last active:{" "}
                {new Date(replacementModal.conflictingSession.lastActiveAt).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              To log in from this new device, your previous device will be logged out and replaced. Would you like to proceed?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={replacingDevice}
                onClick={() => setReplacementModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={replacingDevice}
                onClick={confirmReplacement}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm shadow-teal-600/20 transition disabled:opacity-50"
              >
                {replacingDevice ? (
                  <>
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    Replacing...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">sync</span>
                    Replace & Log In
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}