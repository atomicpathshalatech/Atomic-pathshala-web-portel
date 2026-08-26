import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Reset your Atomic Pathshala account password.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
