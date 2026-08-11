import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Register as a student at Atomic Pathshala.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
