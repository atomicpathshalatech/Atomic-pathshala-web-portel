import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your Atomic Pathshala account.",
};

export default function LoginPage() {
  return <LoginForm />;
}
